/**
 * Deterministic Axis Bank Corporate Statement PDF Parser.
 */

if (typeof (globalThis as any).DOMMatrix === 'undefined') {
  (globalThis as any).DOMMatrix = class DOMMatrix {} as any;
}

// @ts-ignore
import pdf from 'pdf-parse/lib/pdf-parse.js';
import type { ParsedStatementResult } from './types';
import { 
    extractOptionalAxisChequeNumber,
    extractAxisBranchNameFromBlock,
    pickDominantAxisBranchName,
} from './axisStatementParser';

// 1. PDF text normalization helpers
export function normalizePdfText(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

export function flatPdfText(text: string): string {
  return normalizePdfText(text)
    .replace(/\s+/g, ' ')
    .trim();
}

export function compactPdfText(text: string): string {
  return normalizePdfText(text)
    .replace(/\s+/g, '')
    .toUpperCase();
}

// 2. Amount normalization
export function normalizeAmount(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;

  const cleaned = raw
    .replace(/[^\d.]/g, '')
    .trim();

  if (!/^\d+\.\d{2}$/.test(cleaned)) return null;

  return cleaned;
}

// 3. Generic IFSC extraction
export function extractAxisIfsc(fullText: string): string | null {
  const compact = compactPdfText(fullText);

  const patterns = [
    /IFSCCODE[:\-]?([A-Z]{4}0[A-Z0-9]{6})/,
    /IFSC[:\-]?([A-Z]{4}0[A-Z0-9]{6})/,
    /(UTIB0[A-Z0-9]{6})/
  ];

  for (const pattern of patterns) {
    const match = compact.match(pattern);
    if (match && match[1]) return match[1];
  }

  return null;
}

// 4. Generic opening balance extraction
export function extractAxisOpeningBalance(fullText: string): string | null {
  const compact = compactPdfText(fullText);

  const patterns = [
    /OPENINGBALANCE[:\-]?(?:INR|RS\.?|₹)?([0-9,]+\.\d{2})/,
    /OPENINGBALANCE.{0,50}?([0-9,]+\.\d{2})/
  ];

  for (const pattern of patterns) {
    const match = compact.match(pattern);
    if (match) return normalizeAmount(match[1]);
  }

  return null;
}

// 5. Generic closing balance extraction
export function extractAxisClosingBalance(fullText: string): string | null {
  const compact = compactPdfText(fullText);

  const patterns = [
    /CLOSINGBALANCE[:\-]?(?:INR|RS\.?|₹)?([0-9,]+\.\d{2})/,
    /CLOSINGBALANCE.{0,50}?([0-9,]+\.\d{2})/
  ];

  for (const pattern of patterns) {
    const match = compact.match(pattern);
    if (match) return normalizeAmount(match[1]);
  }

  return null;
}

// 6. Generic account number extraction
export function extractAxisAccountNumber(fullText: string): string | null {
  const flat = flatPdfText(fullText);

  const patterns = [
    /Statement\s+of\s+Axis\s+Bank\s+Account\s+No\s*:?\s*(\d{6,20})/i,
    /Axis\s+Bank\s+Account\s+No\s*:?\s*(\d{6,20})/i,
    /Account\s+No\s*:?\s*(\d{6,20})/i
  ];

  for (const pattern of patterns) {
    const match = flat.match(pattern);
    if (match && match[1]) return match[1];
  }

  return null;
}

// 7. Generic account holder name extraction
export function cleanAxisAccountHolderName(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let value = raw
    .replace(/\s+/g, ' ')
    .replace(/^Account\s*Statement\s*Report\s*/i, '')
    .trim();

  value = value.replace(/[:\-]+$/g, '').trim();

  if (!value) return null;

  const invalidPatterns = [
    /Account\s*Statement\s*Report/i,
    /^Statement/i,
    /^Customer\s*No/i,
    /^IFSC/i,
    /^MICR/i,
    /^Opening\s*Balance/i,
    /^Closing\s*Balance/i,
    /^Joint\s*Holder/i,
    /^Scheme/i,
    /^Currency/i,
    /^Branch/i
  ];

  if (invalidPatterns.some(pattern => pattern.test(value))) {
    return null;
  }

  if (/\d{6,}/.test(value)) {
    return null;
  }

  return value.toUpperCase();
}

export function extractAxisAccountHolderName(fullText: string): string | null {
  const normalized = normalizePdfText(fullText);
  const flat = flatPdfText(fullText);
  const lines = normalized
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  // Strategy 1: line before Joint Holder
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line && /^Joint\s*Holder\s*[:-]/i.test(line)) {
      const previous = lines[i - 1];
      const cleaned = cleanAxisAccountHolderName(previous);
      if (cleaned) return cleaned;
    }
  }

  // Strategy 2: text immediately before Joint Holder in flattened text
  let match = flat.match(/([A-Z][A-Z0-9 .&'/-]{2,120}?)\s+Joint\s*Holder\s*[:-]/i);
  if (match) {
    const cleaned = cleanAxisAccountHolderName(match[1]);
    if (cleaned) return cleaned;
  }

  // Strategy 3: text after Account Statement Report and before Joint Holder
  match = flat.match(/Account\s*Statement\s*Report\s+(.+?)\s+Joint\s*Holder\s*[:-]/i);
  if (match) {
    const cleaned = cleanAxisAccountHolderName(match[1]);
    if (cleaned) return cleaned;
  }

  return null;
}

// 8. Generic statement date extraction
export function parseAxisDate(dateStr: string): string | null {
  const parts = dateStr.trim().split(/[\/-]/);
  if (parts.length !== 3) return null;

  const [dd, mm, yyyy] = parts;
  if (!dd || !mm || !yyyy) return null;
  if (!/^\d{2}$/.test(dd) || !/^\d{2}$/.test(mm) || !/^\d{4}$/.test(yyyy)) return null;

  return `${yyyy}-${mm}-${dd}`;
}

export function extractAxisStatementDates(fullText: string): {
  fromDate: string | null;
  toDate: string | null;
} {
  const flat = flatPdfText(fullText);

  const patterns = [
    /From\s*(?:Date)?\s*:?\s*(\d{2}[\/-]\d{2}[\/-]\d{4})\s*To\s*(?:Date)?\s*:?\s*(\d{2}[\/-]\d{2}[\/-]\d{4})/i,
    /period\s*\(?\s*From\s*:?\s*(\d{2}[\/-]\d{2}[\/-]\d{4})\s*To\s*:?\s*(\d{2}[\/-]\d{2}[\/-]\d{4})/i
  ];

  for (const pattern of patterns) {
    const match = flat.match(pattern);
    if (match && match[1] && match[2]) {
      return {
        fromDate: parseAxisDate(match[1]),
        toDate: parseAxisDate(match[2])
      };
    }
  }

  return {
    fromDate: null,
    toDate: null
  };
}

export function extractAxisCorporateBranchName(fullText: string): string | null {
  const lines = normalizePdfText(fullText)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const candidates: string[] = [];
  const stateSolPattern = /^\[?[A-Z]{2}\]?\s*(?:\(\d+\))?$/;
  const trailingBranchPattern = /(?:CR|DR)\s*[\d,]+\.\d{2}\s*([A-Z][A-Z0-9 ,.&'/-]{2,})$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trailingBranchMatch = line.match(trailingBranchPattern);
    if (trailingBranchMatch?.[1]) {
      candidates.push(trailingBranchMatch[1]);
    }

    if (stateSolPattern.test(line) && i > 0) {
      const previousLine = lines[i - 1]!;
      const previousTrailingMatch = previousLine.match(trailingBranchPattern);
      candidates.push(previousTrailingMatch?.[1] || previousLine);
    }
  }

  return pickDominantAxisBranchName(candidates);
}

function extractAxisCorporateDatePair(text: string): {
  serialNo: string | null;
  transactionDateRaw: string;
  valueDateRaw: string;
  remainder: string;
} | null {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  const match = normalized.match(
    /^(?:(\d+)\s*)?(\d{2}[\/-]\d{2}[\/-]\d{4})\s*(\d{2}[\/-]\d{2}[\/-]\d{4})(.*)$/i
  );

  if (!match) return null;

  return {
    serialNo: match[1] || null,
    transactionDateRaw: match[2]!,
    valueDateRaw: match[3]!,
    remainder: (match[4] || '').trim(),
  };
}

function extractAxisCorporateTrailingFields(text: string): {
  remainder: string;
  amount: string;
  drCr: 'DR' | 'CR';
  balance: string;
} | null {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  const match = normalized.match(
    /^(.*?)\s+([\d,]+\.\d{2})\s*(DR|CR)\s*([\d,]+\.\d{2})(.*)$/i
  );

  if (!match) return null;

  return {
    remainder: match[1]!.trim(),
    amount: match[2]!,
    drCr: match[3]!.toUpperCase() as 'DR' | 'CR',
    balance: match[4]!,
  };
}

export function isAxisCorporateStatement(text: string): boolean {
  const flat = flatPdfText(text);
  const hasCorpHeader = /Account\s*Statement\s*Report/i.test(flat);
  const hasCustomerNo = /Customer\s*No\s*:/i.test(flat);
  const hasSerialHeader = /(?:^|\s)S\.?\s*NO(?:\s|$)/i.test(flat);
  const hasRetailHeader = /Statement\s+of\s+Axis\s+Account\s+No/i.test(flat);

  return hasCorpHeader || (hasCustomerNo && hasSerialHeader && !hasRetailHeader);
}

export async function parseAxisCorporateStatement(buffer: Buffer): Promise<ParsedStatementResult> {
  const data = await pdf(buffer);
  const fullText: string = data.text;
  const numPages = data.numpages || 1;

  if (process.env.DEBUG_AXIS_CORP === '1') {
    console.log('AXIS_CORP_TEXT_FIRST_3000:', JSON.stringify(fullText.slice(0, 3000)));
  }

  const result: ParsedStatementResult = {
    parser: 'AXIS_CORP_DETERMINISTIC',
    bankName: 'AXIS', // Standardized to AXIS for routing logic
    accountNumber: null,
    statementFromDate: null,
    statementToDate: null,
    openingBalance: null,
    closingBalance: null,
    ifsc: null,
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

  result.accountHolderName = extractAxisAccountHolderName(fullText);
  result.accountNumber = extractAxisAccountNumber(fullText);
  result.ifsc = extractAxisIfsc(fullText);
  result.bankBranchName = extractAxisCorporateBranchName(fullText);

  const dates = extractAxisStatementDates(fullText);
  result.statementFromDate = dates.fromDate;
  result.statementToDate = dates.toDate;

  result.openingBalance = extractAxisOpeningBalance(fullText);
  result.closingBalance = extractAxisClosingBalance(fullText);

  if (process.env.DEBUG_AXIS_CORP === '1') {
    console.log('AXIS_CORP_HEADER_DEBUG:', {
      accountHolderName: result.accountHolderName,
      accountNumber: result.accountNumber,
      ifsc: result.ifsc,
      statementFromDate: result.statementFromDate,
      statementToDate: result.statementToDate,
      openingBalance: result.openingBalance,
      closingBalance: result.closingBalance
    });
  }

  // 10. Transaction start detection
  const normalizedText = normalizePdfText(fullText);
  const lines = normalizedText.split('\n').map(l => l.trimEnd());
  
  let transactionStartIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (/Opening\s*Balance/i.test(lines[i]!)) {
      transactionStartIdx = i + 1;
      break;
    }
  }

  if (transactionStartIdx === -1) {
    for (let i = 0; i < lines.length; i++) {
      if (/S\.?\s*NO/i.test(lines[i]!) && /Transaction/i.test(lines[i]!)) {
        transactionStartIdx = i + 1;
        break;
      }
    }
  }

  if (transactionStartIdx === -1) {
    result.validation.errors.push('Could not find Opening Balance or table header marker to start transactions.');
    return result;
  }

  interface RawTxnBlock {
    lines: string[];
    startIdx: number;
  }

  const txnBlocks: RawTxnBlock[] = [];
  let currentBlock: RawTxnBlock | null = null;
  const branchCandidates: string[] = [];

  for (let i = transactionStartIdx; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    
    if (
      /TRANSACTION\s*TOTAL/i.test(line) || 
      /Closing\s*Balance/i.test(line) ||
      /Cheque\s*Return\s*Details/i.test(line) ||
      /Unless\s*the\s*constituent/i.test(line) ||
      /REGISTERED\s*OFFICE/i.test(line) ||
      /Legend/i.test(line)
    ) {
      break;
    }

    const dateParts = extractAxisCorporateDatePair(line);
    if (dateParts) {
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
    const combinedText = block.lines.join(' ').replace(/\s+/g, ' ').trim();
    const branchName = extractAxisBranchNameFromBlock(block.lines);
    if (branchName) branchCandidates.push(branchName);
    const dateParts = extractAxisCorporateDatePair(combinedText);
    if (!dateParts) continue;

    const transactionDateRaw = dateParts.transactionDateRaw;
    const valueDateRaw = dateParts.valueDateRaw;
    const remainderText = dateParts.remainder;

    const transactionDate = parseAxisDate(transactionDateRaw);
    const valueDateStr = parseAxisDate(valueDateRaw);

    const trailingFields = extractAxisCorporateTrailingFields(remainderText);
    if (!trailingFields) {
      result.validation.warnings.push(`Row ${rowCounter}: Could not find amount and DR/CR indicator.`);
      continue;
    }

    const amt = normalizeAmount(trailingFields.amount);
    const dir = trailingFields.drCr;
    const debitAmount = dir === 'DR' ? amt : null;
    const creditAmount = dir === 'CR' ? amt : null;

    let narration = trailingFields.remainder;
    
    const {
      narration: narrationWithoutCheque,
      chequeNumber,
    } = extractOptionalAxisChequeNumber(narration);
    narration = narrationWithoutCheque;

    const closingBalanceStr = normalizeAmount(trailingFields.balance);

    if (!closingBalanceStr) {
      result.validation.warnings.push(`Row ${rowCounter}: Could not normalize closing balance`);
    }

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

  validateAxisCorporateStatement(result);

  return result;
}

function validateAxisCorporateStatement(result: ParsedStatementResult): void {
  const errors: string[] = [];
  const warnings: string[] = [...result.validation.warnings];

  if (!result.accountHolderName) warnings.push('Missing account holder name.');
  if (!result.accountNumber) warnings.push('Missing account number.');
  if (!result.ifsc) warnings.push('Missing IFSC code.');
  if (!result.statementFromDate || !result.statementToDate) warnings.push('Missing statement dates.');
  if (!result.openingBalance) warnings.push('Missing opening balance.');
  if (!result.closingBalance) warnings.push('Missing closing balance.');

  if (result.rows.length === 0) {
    errors.push('No transaction rows were parsed from the corporate statement.');
    result.validation.errors = errors;
    result.validation.warnings = warnings;
    result.validation.isValid = false;
    return;
  }

  if (result.openingBalance !== null) {
    let prevBal = parseFloat(result.openingBalance);
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows[i]!;
      const debit = row.debitAmount ? parseFloat(row.debitAmount) : 0;
      const credit = row.creditAmount ? parseFloat(row.creditAmount) : 0;
      
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
  }

  result.validation.errors = errors;
  result.validation.warnings = warnings;
  result.validation.isValid = errors.length === 0;
}
