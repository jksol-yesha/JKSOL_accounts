/**
 * ICICI Detailed Statement Parser.
 *
 * Handles the "DETAILED STATEMENT" / "Transactions List" PDF format with columns:
 *   No. | Transaction ID | Value Date | Txn Posted Date | ChequeNo. |
 *   Description | Cr/Dr | Transaction Amount(INR) | Available Balance(INR)
 *
 * PDF text extraction layout per row:
 *   <balance>    (standalone amount, rendered BEFORE the serial due to column order)
 *   <serial>     (standalone 1-3 digit number)
 *   <txnId+dates> (may span 1-2 lines)
 *   <cheque>     (e.g. "-")
 *   <description lines>
 *   <DR|CR amount>
 *
 * The "Available Balance" column is rightmost in the PDF table, so pdf-parse
 * renders each row's balance BEFORE the next row's serial number.
 */

import type { ParsedStatementResult, ParsedStatementRow } from './types';

// ─── Helpers ───

function normalizeAmount(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const cleaned = raw.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  if (!cleaned.includes('.')) return cleaned + '.00';
  const parts = cleaned.split('.');
  return parts[0] + '.' + parts[1]!.padEnd(2, '0');
}

function parseSlashDate(dateStr: string): string | null {
  const m = dateStr.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function normalizeICICIDescription(desc: string): string {
  return desc
    .replace(/\u00AD/g, '')
    .replace(/\uFFFE/g, '')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Metadata ───

function extractDetailedMetadata(text: string) {
  const result = { accountHolderName: null as string | null, currency: null as string | null, accountNumber: null as string | null };
  const m = text.match(/Transactions\s+List\s*-\s*-?\s*(.+?)\s*\((\w{3})\)\s*-\s*(\d+)/i);
  if (m) {
    result.accountHolderName = m[1]!.trim();
    result.currency = m[2]!.toUpperCase();
    result.accountNumber = m[3]!;
  }
  return result;
}

// ─── Regexes for txnId+dates parsing ───

// Single line: S9867968007/05/202507/05/2025 10:28:31 AM
const SINGLE_LINE_RE = /^(S\d+)(\d{2}\/\d{2}\/\d{4})(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2}\s+[AP]M)(.*)/;
// Split line 1: S6338951726/05/2025
const SPLIT_LINE1_RE = /^(S\d+)(\d{2}\/\d{2}\/\d{4})$/;
// Split line 2: 26/05/2025 04:33:27 PM-
const SPLIT_LINE2_RE = /^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2}\s+[AP]M)(.*)/;

// ─── Main Parser ───

export function parseICICIDetailedStatement(fullText: string, numPages: number): ParsedStatementResult {
  const result: ParsedStatementResult = {
    parser: 'ICICI_DETERMINISTIC',
    parserVariant: 'ICICI_DETAILED_STATEMENT',
    bankName: 'ICICI',
    accountNumber: null,
    accountHolderName: null,
    statementFromDate: null,
    statementToDate: null,
    openingBalance: null,
    closingBalance: null,
    debitCount: null,
    creditCount: null,
    totalDebit: null,
    totalCredit: null,
    rows: [],
    validation: { isValid: false, errors: [], warnings: [] },
  };

  const meta = extractDetailedMetadata(fullText);
  result.accountNumber = meta.accountNumber;
  result.accountHolderName = meta.accountHolderName;

  const lines = fullText.split('\n').map(l => l.trimEnd());

  // ── Phase 1: Find serial positions ──
  const serialPositions: { serialNo: number; lineIdx: number }[] = [];
  for (let idx = 0; idx < lines.length; idx++) {
    const trimmed = lines[idx]!.trim();
    if (!/^\d{1,3}$/.test(trimmed)) continue;
    const serialNo = parseInt(trimmed, 10);
    let nextIdx = idx + 1;
    while (nextIdx < lines.length && !lines[nextIdx]!.trim()) nextIdx++;
    if (nextIdx < lines.length && /^S\d+/.test(lines[nextIdx]!.trim())) {
      serialPositions.push({ serialNo, lineIdx: idx });
    }
  }

  // ── Phase 2: Build blocks with pre-serial balance ──
  interface RawBlock {
    serialNo: number;
    preSerialBalance: string | null;
    bodyLines: string[];
    startLineIdx: number;
  }

  const blocks: RawBlock[] = [];
  for (let s = 0; s < serialPositions.length; s++) {
    const { serialNo, lineIdx } = serialPositions[s]!;

    // Balance line immediately before serial
    let preSerialBalance: string | null = null;
    for (let prev = lineIdx - 1; prev >= 0; prev--) {
      const prevLine = lines[prev]!.trim();
      if (!prevLine) continue;
      if (/^[\d,]+\.\d{2}$/.test(prevLine)) preSerialBalance = prevLine;
      break;
    }

    // Collect body lines (after serial, before next row's balance)
    const nextSerialIdx = s + 1 < serialPositions.length ? serialPositions[s + 1]!.lineIdx : lines.length;
    const bodyLines: string[] = [];
    for (let j = lineIdx + 1; j < nextSerialIdx; j++) {
      const jTrimmed = lines[j]!.trim();
      if (!jTrimmed) continue;
      // Skip the next row's balance line (last non-empty line before next serial)
      if (s + 1 < serialPositions.length) {
        // Check if this is the balance for the next row
        let isNextBalance = false;
        if (/^[\d,]+\.\d{2}$/.test(jTrimmed)) {
          // Check if there are only empty lines between this and the next serial
          let allEmpty = true;
          for (let check = j + 1; check < nextSerialIdx; check++) {
            if (lines[check]!.trim()) { allEmpty = false; break; }
          }
          if (allEmpty) isNextBalance = true;
        }
        if (isNextBalance) break;
      }
      bodyLines.push(jTrimmed);
    }

    blocks.push({ serialNo, preSerialBalance, bodyLines, startLineIdx: lineIdx });
  }

  // ── Phase 3: Parse each block ──
  const pageSize = lines.length / numPages;

  for (const block of blocks) {
    if (block.bodyLines.length < 2) {
      result.validation.warnings.push(`Row ${block.serialNo}: Too few lines.`);
      continue;
    }

    // Parse txnId + dates from first line(s)
    const firstLine = block.bodyLines[0]!;
    let transactionId: string;
    let valueDateStr: string;
    let postedDateStr: string;
    let postedTimeStr: string;
    let bodyStartIdx: number;
    let firstLineRemainder = '';

    const singleMatch = firstLine.match(SINGLE_LINE_RE);
    if (singleMatch) {
      transactionId = singleMatch[1]!;
      valueDateStr = singleMatch[2]!;
      postedDateStr = singleMatch[3]!;
      postedTimeStr = singleMatch[4]!.trim();
      firstLineRemainder = (singleMatch[5] || '').trim();
      bodyStartIdx = 1;
    } else {
      const split1 = firstLine.match(SPLIT_LINE1_RE);
      if (split1 && block.bodyLines.length > 1) {
        transactionId = split1[1]!;
        valueDateStr = split1[2]!;
        const secondLine = block.bodyLines[1]!;
        const split2 = secondLine.match(SPLIT_LINE2_RE);
        if (split2) {
          postedDateStr = split2[1]!;
          postedTimeStr = split2[2]!.trim();
          firstLineRemainder = (split2[3] || '').trim();
          bodyStartIdx = 2;
        } else {
          result.validation.warnings.push(`Row ${block.serialNo}: Cannot parse posted date.`);
          continue;
        }
      } else {
        result.validation.warnings.push(`Row ${block.serialNo}: Cannot parse txnId/dates.`);
        continue;
      }
    }

    const valueDate = parseSlashDate(valueDateStr);
    const transactionDate = parseSlashDate(postedDateStr);
    if (!valueDate || !transactionDate) {
      result.validation.warnings.push(`Row ${block.serialNo}: Invalid dates.`);
      continue;
    }

    // Body: cheque + description + DR/CR amount
    const contentLines = block.bodyLines.slice(bodyStartIdx);
    if (firstLineRemainder) contentLines.unshift(firstLineRemainder);

    // Find DR/CR + amount (last matching line)
    let direction: 'DR' | 'CR' | null = null;
    let rawAmount: string | null = null;
    let drCrIdx = -1;
    for (let k = contentLines.length - 1; k >= 0; k--) {
      const drCrMatch = contentLines[k]!.trim().match(/^(DR|CR)\s+([\d,]+(?:\.\d{2})?)$/);
      if (drCrMatch) {
        direction = drCrMatch[1]! as 'DR' | 'CR';
        rawAmount = normalizeAmount(drCrMatch[2]!);
        drCrIdx = k;
        break;
      }
    }
    if (!direction || !rawAmount || drCrIdx < 0) {
      result.validation.warnings.push(`Row ${block.serialNo}: Cannot find DR/CR + amount.`);
      continue;
    }

    // Closing balance from pre-serial line
    const closingBalance = block.preSerialBalance ? normalizeAmount(block.preSerialBalance) : null;
    if (!closingBalance) {
      result.validation.warnings.push(`Row ${block.serialNo}: No closing balance.`);
      continue;
    }

    // Description = everything before DR/CR line
    const descText = contentLines.slice(0, drCrIdx).join(' ').trim();
    let chequeNumber: string | null = null;
    let description: string;
    const chequeMatch = descText.match(/^(-|[\d]+)\s*(.*)/s);
    if (chequeMatch) {
      chequeNumber = chequeMatch[1]!.trim() === '-' ? null : chequeMatch[1]!.trim();
      description = chequeMatch[2]!.trim();
    } else {
      description = descText;
    }

    const narration = normalizeICICIDescription(description);
    const estimatedPage = Math.ceil((block.startLineIdx + 1) / pageSize);

    result.rows.push({
      sourcePage: estimatedPage,
      sourceRow: block.serialNo,
      serialNo: block.serialNo,
      transactionDate,
      valueDate,
      narration,
      chequeNumber,
      referenceNo: transactionId,
      debitAmount: direction === 'DR' ? rawAmount : null,
      creditAmount: direction === 'CR' ? rawAmount : null,
      closingBalance,
      rawText: [
        `${block.serialNo} ${transactionId} ${valueDateStr} ${postedDateStr} ${postedTimeStr}`,
        ...contentLines,
      ].join('\n'),
    });
  }

  // ── Summary ──
  if (result.rows.length > 0) {
    const firstRow = result.rows[0]!;
    if (firstRow.debitAmount) {
      result.openingBalance = (parseFloat(firstRow.closingBalance) + parseFloat(firstRow.debitAmount)).toFixed(2);
    } else if (firstRow.creditAmount) {
      result.openingBalance = (parseFloat(firstRow.closingBalance) - parseFloat(firstRow.creditAmount)).toFixed(2);
    }
    result.closingBalance = result.rows[result.rows.length - 1]!.closingBalance;

    const dates = result.rows.map(r => r.transactionDate).sort();
    result.statementFromDate = dates[0] || null;
    result.statementToDate = dates[dates.length - 1] || null;
  }

  const debitRows = result.rows.filter(r => r.debitAmount !== null);
  const creditRows = result.rows.filter(r => r.creditAmount !== null);
  result.debitCount = debitRows.length;
  result.creditCount = creditRows.length;
  result.totalDebit = debitRows.reduce((s, r) => s + parseFloat(r.debitAmount!), 0).toFixed(2);
  result.totalCredit = creditRows.reduce((s, r) => s + parseFloat(r.creditAmount!), 0).toFixed(2);

  validateDetailedStatement(result);
  return result;
}

// ─── Validation ───

function validateDetailedStatement(result: ParsedStatementResult): void {
  const errors: string[] = [];
  const warnings: string[] = [...result.validation.warnings];

  if (result.rows.length === 0) {
    errors.push('No transaction rows were parsed from the ICICI detailed statement.');
    result.validation = { isValid: false, errors, warnings };
    return;
  }

  for (const row of result.rows) {
    if (!row.referenceNo) errors.push(`Row ${row.sourceRow}: Missing transactionId.`);
    if (!row.transactionDate) errors.push(`Row ${row.sourceRow}: Missing transactionDate.`);
    if (!row.valueDate) errors.push(`Row ${row.sourceRow}: Missing valueDate.`);
    if (!row.debitAmount && !row.creditAmount) errors.push(`Row ${row.sourceRow}: Missing amount.`);
    if (row.debitAmount && row.creditAmount) errors.push(`Row ${row.sourceRow}: Has both debit and credit.`);
    if (!row.closingBalance) errors.push(`Row ${row.sourceRow}: Missing closingBalance.`);
    if (!row.narration) warnings.push(`Row ${row.sourceRow}: Empty description.`);
    if (!row.chequeNumber) warnings.push(`Row ${row.sourceRow}: No cheque number.`);
  }

  const serials = result.rows.map(r => r.serialNo).filter(s => s != null) as number[];
  if (serials.length === result.rows.length) {
    for (let i = 0; i < serials.length; i++) {
      if (serials[i] !== i + 1) {
        warnings.push(`Serial discontinuity: expected ${i + 1}, got ${serials[i]}.`);
        break;
      }
    }
  }

  if (result.openingBalance !== null) {
    let prevBal = parseFloat(result.openingBalance);
    for (const row of result.rows) {
      const debit = row.debitAmount ? parseFloat(row.debitAmount) : 0;
      const credit = row.creditAmount ? parseFloat(row.creditAmount) : 0;
      const expected = prevBal - debit + credit;
      const actual = parseFloat(row.closingBalance);
      if (Math.abs(expected - actual) > 0.01) {
        errors.push(`Row ${row.sourceRow}: Balance chain broken. Expected ${expected.toFixed(2)} but got ${actual.toFixed(2)}.`);
      }
      prevBal = actual;
    }
  }

  if (result.openingBalance && result.closingBalance && result.totalDebit && result.totalCredit) {
    const expected = parseFloat(result.openingBalance) + parseFloat(result.totalCredit) - parseFloat(result.totalDebit);
    const actual = parseFloat(result.closingBalance);
    if (Math.abs(expected - actual) > 0.01) {
      errors.push(`Balance equation mismatch: Opening (${result.openingBalance}) + Credits (${result.totalCredit}) - Debits (${result.totalDebit}) = ${expected.toFixed(2)}, but closing is ${result.closingBalance}.`);
    }
  }

  result.validation = { isValid: errors.length === 0, errors, warnings };
}
