/**
 * Deterministic Axis Bank Statement PDF Parser.
 *
 * Extracts rows, summary, and generates validation metrics for Axis Bank PDFs.
 */

if (typeof (globalThis as any).DOMMatrix === 'undefined') {
  (globalThis as any).DOMMatrix = class DOMMatrix {} as any;
}

// @ts-ignore
import pdf from 'pdf-parse/lib/pdf-parse.js';
import type { ParsedStatementResult, ParsedStatementRow } from './types';

const AXIS_DATE_TOKEN = '(\\d{2}-\\d{2}-\\d{4})';
const AXIS_DATE_PAIR_PREFIX = new RegExp(`^${AXIS_DATE_TOKEN}\\s*${AXIS_DATE_TOKEN}`);

function normalizeAmount(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const cleaned = raw.trim().replace(/,/g, '');
  if (!/^\d+\.\d{2}$/.test(cleaned)) return null;
  return cleaned;
}

function parseAxisDate(dateStr: string): string | null {
  const parts = dateStr.trim().split('-');
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return null;
}

export function extractAxisDatePair(text: string): {
  transactionDateRaw: string;
  valueDateRaw: string;
  remainder: string;
} | null {
  const match = text.match(AXIS_DATE_PAIR_PREFIX);
  if (!match) return null;

  return {
    transactionDateRaw: match[1]!,
    valueDateRaw: match[2]!,
    remainder: text.substring(match[0].length).trim(),
  };
}

export function extractAxisTrailingFields(text: string): {
  remainder: string;
  amount: string;
  drCr: 'DR' | 'CR';
  balance: string;
} | null {
  const match = text.match(
    /^(.*?)\s+([\d,]+\.\d{2})\s*(DR|CR)\s+([\d,]+\.\d{2})(?:\s+.*)?$/i
  );
  if (!match) return null;

  return {
    remainder: match[1]!.trim(),
    amount: match[2]!,
    drCr: match[3]!.toUpperCase() as 'DR' | 'CR',
    balance: match[4]!,
  };
}

function normalizeAxisBranchCandidate(raw: string): string | null {
  const candidate = raw.replace(/\s+/g, ' ').trim();
  if (!candidate) return null;
  if (!/[A-Za-z]/.test(candidate)) return null;
  if (/^\[?[A-Z]{2}\]?$/.test(candidate)) return null;
  if (AXIS_DATE_PAIR_PREFIX.test(candidate)) return null;
  if (extractAxisTrailingFields(candidate)) return null;
  if (/^(?:OPENING|CLOSING|TRANSACTION\s+TOTAL|STATEMENT\s+OF\s+AXIS|CUSTOMER\s+ID|IFSC|MICR|CURRENCY|SCHEME)\b/i.test(candidate)) {
    return null;
  }
  return candidate;
}

export function extractAxisBranchNameFromBlock(lines: string[]): string | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    const candidate = normalizeAxisBranchCandidate(lines[i] || '');
    if (candidate) return candidate;
  }
  return null;
}

export function pickDominantAxisBranchName(candidates: string[]): string | null {
  const counts = new Map<string, { value: string; count: number; firstSeen: number }>();

  candidates.forEach((rawCandidate, index) => {
    const candidate = normalizeAxisBranchCandidate(rawCandidate);
    if (!candidate) return;

    const key = candidate.toUpperCase();
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }

    counts.set(key, {
      value: candidate,
      count: 1,
      firstSeen: index,
    });
  });

  const winner = [...counts.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (b.value.length !== a.value.length) return b.value.length - a.value.length;
    return a.firstSeen - b.firstSeen;
  })[0];

  return winner?.value || null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasStandaloneAxisToken(text: string, token: string): boolean {
  if (!text || !token) return false;
  const pattern = new RegExp(`(^|[\\s/:()-])${escapeRegex(token)}(?=$|[\\s/:()-])`);
  return pattern.test(text);
}

export function extractOptionalAxisChequeNumber(prefix: string): {
  narration: string;
  chequeNumber: string | null;
} {
  const trimmed = prefix.trim();

  const spacedMatch = trimmed.match(/^(.*?)\s+(\d{3,10})$/);
  if (spacedMatch) {
    return {
      narration: spacedMatch[1]!.trim(),
      chequeNumber: spacedMatch[2]!,
    };
  }

  const slashSegments = trimmed.split('/');
  const lastSlashSegment = [...slashSegments].reverse().find(segment => segment.trim().length > 0) || null;

  if (lastSlashSegment) {
    const lastSlashIndex = trimmed.lastIndexOf(lastSlashSegment);
    const leadingText = lastSlashIndex >= 0 ? trimmed.slice(0, lastSlashIndex) : '';
    const fusedSegmentMatch = lastSlashSegment.match(/^([A-Za-z][A-Za-z .&-]{1,60}?)(\d{3,10})$/);

    if (
      fusedSegmentMatch &&
      hasStandaloneAxisToken(leadingText, fusedSegmentMatch[2]!)
    ) {
      return {
        narration: `${leadingText}${fusedSegmentMatch[1]}`.trim(),
        chequeNumber: fusedSegmentMatch[2]!,
      };
    }
  }

  return {
    narration: trimmed,
    chequeNumber: null,
  };
}

export function isAxisStatement(text: string): boolean {
  return text.includes('Statement of Axis Account No') || 
         (text.includes('AXIS BANK') && text.includes('OPENING BALANCE') && text.includes('TRANSACTION TOTAL DR/CR'));
}

export async function parseAxisStatement(buffer: Buffer): Promise<ParsedStatementResult> {
  const data = await pdf(buffer);
  const fullText: string = data.text;
  const numPages = data.numpages || 1;

  const result: ParsedStatementResult = {
    parser: 'AXIS_DETERMINISTIC',
    bankName: 'AXIS',
    accountNumber: null,
    statementFromDate: null,
    statementToDate: null,
    openingBalance: null,
    closingBalance: null,
    debitCount: null,
    creditCount: null,
    totalDebit: null,
    totalCredit: null,
    rows: [],
    validation: {
      isValid: false,
      errors: [],
      warnings: [],
    },
  };

  const lines = fullText.split('\n').map(l => l.trimEnd());

  // Extract Account Number and Period
  const headerMatch = fullText.match(/Statement of Axis Account No\s*:\s*(\d+)\s*for the period\s*\(From\s*:\s*(\d{2}-\d{2}-\d{4})\s*To\s*:\s*(\d{2}-\d{2}-\d{4})\)/i);
  if (headerMatch) {
    result.accountNumber = headerMatch[1]!;
    result.statementFromDate = parseAxisDate(headerMatch[2]!);
    result.statementToDate = parseAxisDate(headerMatch[3]!);
  }

  // ── Extract account metadata ──
  // Account Holder: First meaningful line — e.g. "KHUNT JITENDRA CHANDUBHAI"
  const holderMatch = fullText.match(/^([A-Z][A-Z\s]+?)(?:\n|\r)/m);
  if (holderMatch) {
    const candidate = holderMatch[1]!.trim();
    // Accept if it looks like a name (at least 2 words, no special keywords)
    if (candidate.split(/\s+/).length >= 2 && !/(?:OPENING|CLOSING|STATEMENT|TRANSACTION|DATE)/i.test(candidate)) {
      result.accountHolderName = candidate;
    }
  }

  // IFSC: "IFSC Code :UTIB0000848"
  const ifscMatch = fullText.match(/IFSC\s*(?:Code)?\s*:?\s*([A-Za-z]{4}0[A-Za-z0-9]{6})/i);
  if (ifscMatch) result.ifsc = ifscMatch[1]!.toUpperCase();

  // MICR: "MICR Code :395211005"
  const micrMatch = fullText.match(/MICR\s*(?:Code)?\s*:?\s*(\d{9})/i);
  if (micrMatch) result.micr = micrMatch[1]!;

  // Customer ID: "Customer ID :897090725"
  const custMatch = fullText.match(/Customer\s*ID\s*:?\s*(\d+)/i);
  if (custMatch) result.customerId = custMatch[1]!;

  // Extract Opening Balance
  const obMatch = fullText.match(/OPENING\s+BALANCE\s*:?\s*(?:INR\s*)?([\d,]+\.\d{2})/i);
  if (obMatch) result.openingBalance = normalizeAmount(obMatch[1]);

  // Extract Closing Balance
  const cbMatch = fullText.match(/CLOSING BALANCE\s+([\d,]+\.\d{2})/i);
  if (cbMatch) result.closingBalance = normalizeAmount(cbMatch[1]);

  // Extract Totals
  const totalsMatch = fullText.match(/TRANSACTION TOTAL DR\/CR\s+([\d,]+\.\d{2})\/([\d,]+\.\d{2})/i);
  if (totalsMatch) {
    result.totalDebit = normalizeAmount(totalsMatch[1]);
    result.totalCredit = normalizeAmount(totalsMatch[2]);
  }

  // Find transaction start
  let transactionStartIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.includes('OPENING BALANCE')) {
      transactionStartIdx = i + 1;
      break;
    }
  }

  if (transactionStartIdx === -1) {
    result.validation.errors.push('Could not find OPENING BALANCE marker to start transactions.');
    return result;
  }

  // Group lines into transaction blocks
  interface RawTxnBlock {
    lines: string[];
    startIdx: number;
  }

  const txnBlocks: RawTxnBlock[] = [];
  let currentBlock: RawTxnBlock | null = null;
  const DATE_PREFIX = AXIS_DATE_PAIR_PREFIX;
  const branchCandidates: string[] = [];

  for (let i = transactionStartIdx; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    if (line.includes('TRANSACTION TOTAL DR/CR')) break;
    if (line.includes('Unless the constituent notifies')) break;

    const dateMatch = line.match(DATE_PREFIX);
    if (dateMatch) {
      if (currentBlock) txnBlocks.push(currentBlock);
      currentBlock = { lines: [line], startIdx: i };
    } else if (currentBlock) {
      currentBlock.lines.push(line);
    }
  }
  if (currentBlock) txnBlocks.push(currentBlock);

  // Parse blocks
  const pageSize = lines.length / numPages;
  let rowCounter = 0;

  for (const block of txnBlocks) {
    rowCounter++;
    const combinedText = block.lines.join(' ');
    const branchName = extractAxisBranchNameFromBlock(block.lines);
    if (branchName) branchCandidates.push(branchName);
    
    const dateParts = extractAxisDatePair(combinedText);
    if (!dateParts) continue;

    const transactionDate = parseAxisDate(dateParts.transactionDateRaw);
    const valueDateStr = parseAxisDate(dateParts.valueDateRaw);
    const remaining = dateParts.remainder;

    const trailingFields = extractAxisTrailingFields(remaining);
    if (!trailingFields) {
      result.validation.warnings.push(`Row ${rowCounter}: Could not find amount and DR/CR indicator.`);
      continue;
    }

    const amt = normalizeAmount(trailingFields.amount);
    const dir = trailingFields.drCr;
    const debitAmount = dir === 'DR' ? amt : null;
    const creditAmount = dir === 'CR' ? amt : null;

    // Narration is everything before the amount
    let narration = trailingFields.remainder;
    
    // ── Separate cheque number from narration ──
    // In Axis PDFs, the Chq No column value appears as a standalone numeric sequence
    // (typically 6 digits) at the end of the narration, separated by whitespace.
    // e.g., "SAK/CASH WDL/SAK468708991/848/VARACHHA /JATIN          820467"
    // The cheque number is "820467", narration is everything before it.
    const {
      narration: narrationWithoutCheque,
      chequeNumber,
    } = extractOptionalAxisChequeNumber(narration);
    narration = narrationWithoutCheque;

    const closingBalanceStr = normalizeAmount(trailingFields.balance);

    if (!closingBalanceStr) {
      result.validation.warnings.push(`Row ${rowCounter}: Could not normalize closing balance`);
    }

    // Try extracting reference number from narration
    let referenceNo: string | null = null;
    const upiMatch = narration.match(/UPI\/(?:P2A|P2M|P2V|P2P)\/(\d{12})\//i);
    const neftMatch = narration.match(/NEFT\/([A-Z0-9]+)\//i);
    const impsMatch = narration.match(/IMPS\/(?:P2A|P2P)\/(\d{12})\//i);
    
    if (upiMatch) referenceNo = upiMatch[1]!;
    else if (neftMatch) referenceNo = neftMatch[1]!;
    else if (impsMatch) referenceNo = impsMatch[1]!;

    const estimatedPage = Math.ceil((block.startIdx + 1) / pageSize);

    result.rows.push({
      sourcePage: estimatedPage,
      sourceRow: rowCounter,
      transactionDate: transactionDate!,
      valueDate: valueDateStr,
      narration,
      chequeNumber,
      referenceNo,
      debitAmount,
      creditAmount,
      closingBalance: closingBalanceStr!,
      rawText: combinedText,
    });
  }

  if (!result.bankBranchName) {
    result.bankBranchName = pickDominantAxisBranchName(branchCandidates);
  }

  // Set counts
  result.debitCount = result.rows.filter(r => r.debitAmount !== null).length;
  result.creditCount = result.rows.filter(r => r.creditAmount !== null).length;

  // Calculate total debit/credit
  const computedTotalDebit = result.rows
    .reduce((sum, r) => sum + (r.debitAmount ? parseFloat(r.debitAmount) : 0), 0)
    .toFixed(2);
  const computedTotalCredit = result.rows
    .reduce((sum, r) => sum + (r.creditAmount ? parseFloat(r.creditAmount) : 0), 0)
    .toFixed(2);

  if (result.totalDebit === null) result.totalDebit = computedTotalDebit;
  if (result.totalCredit === null) result.totalCredit = computedTotalCredit;

  // Generate statement fingerprint
  const { generateStatementFingerprint } = await import('./statementHashUtils');
  result.statementFingerprint = generateStatementFingerprint({
    bankName: result.bankName,
    accountNumber: result.accountNumber,
    statementFromDate: result.statementFromDate,
    statementToDate: result.statementToDate,
    openingBalance: result.openingBalance,
    closingBalance: result.closingBalance,
    totalDebit: result.totalDebit,
    totalCredit: result.totalCredit,
    debitCount: result.debitCount,
    creditCount: result.creditCount,
  });

  validateAxisStatement(result);

  return result;
}

function validateAxisStatement(result: ParsedStatementResult): void {
  const errors: string[] = [];
  const warnings: string[] = [...result.validation.warnings];

  if (result.rows.length === 0) {
    errors.push('No transaction rows were parsed from the statement.');
    result.validation.errors = errors;
    result.validation.warnings = warnings;
    result.validation.isValid = false;
    return;
  }

  // 1. Validate balance chain
  if (result.openingBalance !== null) {
    let prevBal = parseFloat(result.openingBalance);
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows[i]!;
      const debit = row.debitAmount ? parseFloat(row.debitAmount) : 0;
      const credit = row.creditAmount ? parseFloat(row.creditAmount) : 0;
      
      // Expected Balance = Prev Balance - Debit + Credit
      const expectedBal = prevBal - debit + credit;
      const actualBal = row.closingBalance ? parseFloat(row.closingBalance) : NaN;
      
      if (isNaN(actualBal) || Math.abs(expectedBal - actualBal) > 0.01) {
        warnings.push(
          `Row ${row.sourceRow} (${row.transactionDate}): Balance chain broken. Expected ${expectedBal.toFixed(2)} but got ${actualBal}.`
        );
      }
      prevBal = isNaN(actualBal) ? expectedBal : actualBal;
    }
  }

  // 2. Validate opening + credits - debits = closing
  if (result.openingBalance !== null && result.closingBalance !== null) {
    const actualTotalDebit = result.rows.reduce((sum, r) => sum + (r.debitAmount ? parseFloat(r.debitAmount) : 0), 0);
    const actualTotalCredit = result.rows.reduce((sum, r) => sum + (r.creditAmount ? parseFloat(r.creditAmount) : 0), 0);
    const expectedClosing = parseFloat(result.openingBalance) + actualTotalCredit - actualTotalDebit;
    const actualClosing = parseFloat(result.closingBalance);
    
    if (Math.abs(expectedClosing - actualClosing) > 0.01) {
      warnings.push(
        `Balance equation mismatch: Opening (${result.openingBalance}) + Credits (${actualTotalCredit.toFixed(2)}) - Debits (${actualTotalDebit.toFixed(2)}) = ${expectedClosing.toFixed(2)}, but closing balance is ${result.closingBalance}.`
      );
    }
    
    // Also validate against stated totals if available
    if (result.totalDebit && Math.abs(parseFloat(result.totalDebit) - actualTotalDebit) > 0.01) {
      errors.push(`Total debit mismatch: Header claims ${result.totalDebit}, rows sum to ${actualTotalDebit.toFixed(2)}`);
    }
    if (result.totalCredit && Math.abs(parseFloat(result.totalCredit) - actualTotalCredit) > 0.01) {
      errors.push(`Total credit mismatch: Header claims ${result.totalCredit}, rows sum to ${actualTotalCredit.toFixed(2)}`);
    }
  } else {
    errors.push('Missing opening or closing balance in statement header/footer.');
  }

  result.validation.errors = errors;
  result.validation.warnings = warnings;
  result.validation.isValid = errors.length === 0;
}
