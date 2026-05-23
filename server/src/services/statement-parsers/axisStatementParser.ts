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

  // Extract Opening Balance
  const obMatch = fullText.match(/OPENING BALANCE\s+([\d,]+\.\d{2})/i);
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
  const DATE_PREFIX = /^(\d{2}-\d{2}-\d{4})(\d{2}-\d{2}-\d{4})/;

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
    
    const dateMatch = combinedText.match(DATE_PREFIX);
    if (!dateMatch) continue;

    const transactionDate = parseAxisDate(dateMatch[1]!);
    const valueDateStr = parseAxisDate(dateMatch[2]!);
    
    // Remove the two dates (each is 10 chars, total 20)
    let remaining = combinedText.substring(20).trim();

    // Find Amount and Direction (DR/CR)
    const amtRegex = /(\d+(?:,\d+)*\.\d{2})(DR|CR)/i;
    const amtMatch = remaining.match(amtRegex);
    
    if (!amtMatch) {
      result.validation.warnings.push(`Row ${rowCounter}: Could not find amount and DR/CR indicator.`);
      continue;
    }

    const amt = normalizeAmount(amtMatch[1]);
    const dir = amtMatch[2]!.toUpperCase();
    const debitAmount = dir === 'DR' ? amt : null;
    const creditAmount = dir === 'CR' ? amt : null;

    // Narration is everything before the amount
    let narration = remaining.substring(0, amtMatch.index).trim();
    
    // ── Separate cheque number from narration ──
    // In Axis PDFs, the Chq No column value appears as a standalone numeric sequence
    // (typically 6 digits) at the end of the narration, separated by whitespace.
    // e.g., "SAK/CASH WDL/SAK468708991/848/VARACHHA /JATIN          820467"
    // The cheque number is "820467", narration is everything before it.
    let chequeNumber: string | null = null;
    
    // Look for a standalone number (3-10 digits) at the end of narration,
    // preceded by at least 2+ spaces (column gap in the PDF)
    const chqMatch = narration.match(/\s{2,}(\d{3,10})\s*$/);
    if (chqMatch) {
      chequeNumber = chqMatch[1]!;
      narration = narration.substring(0, chqMatch.index).trim();
    }

    // Remaining text after amount (contains closing balance and branch)
    const afterAmount = remaining.substring(amtMatch.index + amtMatch[0].length);
    const cbMatchLocal = afterAmount.match(/(\d+(?:,\d+)*\.\d{2})/);
    const closingBalanceStr = cbMatchLocal ? normalizeAmount(cbMatchLocal[1]) : null;

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

  // Set counts
  result.debitCount = result.rows.filter(r => r.debitAmount !== null).length;
  result.creditCount = result.rows.filter(r => r.creditAmount !== null).length;

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
