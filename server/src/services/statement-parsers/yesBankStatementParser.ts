/**
 * Deterministic YES Bank statement PDF parser.
 *
 * Handles YES Bank statements with columns:
 * Transaction Date | Value Date | Cheque No/Reference No | Description |
 * Withdrawals | Deposits | Running Balance
 *
 * This parser is intentionally text-layout aware:
 * - rows start with two YES date values: DD Mon YYYY DD Mon YYYY
 * - description can wrap across multiple lines
 * - transaction direction is classified using the running balance chain
 * - reference numbers inside description are never parsed as amounts
 */

// Some pdfjs builds used by pdf-parse expect DOMMatrix in non-browser runtime.
if (typeof (globalThis as any).DOMMatrix === 'undefined') {
  (globalThis as any).DOMMatrix = class DOMMatrix {} as any;
}

// @ts-ignore
import pdf from 'pdf-parse/lib/pdf-parse.js';
import type { ParsedStatementResult, ParsedStatementRow } from './types';

const DEBUG_YES_PARSER = false;

// -------------------- Helpers --------------------

const MONTHS: Record<string, string> = {
  jan: '01', january: '01',
  feb: '02', february: '02',
  mar: '03', march: '03',
  apr: '04', april: '04',
  may: '05',
  jun: '06', june: '06',
  jul: '07', july: '07',
  aug: '08', august: '08',
  sep: '09', sept: '09', september: '09',
  oct: '10', october: '10',
  nov: '11', november: '11',
  dec: '12', december: '12',
};

function cleanText(value: string): string {
  return value
    .replace(/\uFFFE/g, '-')
    .replace(/\u0000/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAmount(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const cleaned = raw.trim().replace(/,/g, '');
  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, decimal = ''] = cleaned.split('.');
  return `${whole}.${decimal.padEnd(2, '0')}`;
}

function parseYesDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = cleanText(raw).match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  if (!match) return null;

  const day = match[1]!.padStart(2, '0');
  const month = MONTHS[match[2]!.toLowerCase()];
  const year = match[3]!;
  if (!month) return null;
  return `${year}-${month}-${day}`;
}

function isMoneyToken(token: string): boolean {
  return /^[\d,]+\.\d{2}$/.test(token.trim());
}

function toNumber(amount: string | null | undefined): number {
  return amount ? parseFloat(amount.replace(/,/g, '')) : 0;
}

function nearlyEqual(a: number, b: number, tolerance = 0.02): boolean {
  return Math.abs(a - b) <= tolerance;
}

function extractAmountValue(rawText: string): string | null {
  const match = rawText.match(/[\d,]+\.\d{1,2}/);
  return match ? normalizeAmount(match[0]) : null;
}

function extractTrailingMoneyFields(text: string) {
  const cleaned = cleanText(text);

  const moneyMatches = [...cleaned.matchAll(/[\d,]+\.\d{2}/g)];
  if (moneyMatches.length < 2) return null;

  const balanceMatch = moneyMatches[moneyMatches.length - 1]!;
  const amountMatch = moneyMatches[moneyMatches.length - 2]!;

  const amount = normalizeAmount(amountMatch[0]);
  const balance = normalizeAmount(balanceMatch[0]);

  const narration = cleanText(cleaned.slice(0, amountMatch.index));

  if (!narration || !amount || !balance) return null;

  return { narration, amount, balance };
}

function unfuseReferenceNumber(token: string): { ref: string; desc: string } | null {
  const patterns = [
    // 1. Known long bank reference formats (YESI + 14 digits, or 3 digits + 4 letters + 9 digits)
    /^(YESI\d{14}|\d{3}[A-Z]{4}\d{9})(.+)$/,
    
    // 2. Pure 6-digit cheque number followed by alphabet
    /^(\d{6})([A-Za-z].*)$/,
    
    // 3. REF followed by digits and then alphabet
    /^(REF\d+)([A-Za-z].*)$/,
    
    // 4. Any alphanumeric block followed by a known transaction type keyword or slash
    /^([A-Z0-9]{4,20})(IMPS|NEFT|RTGS|UPI|BIL|REV|CASH|POS|ATM|\/)(.*)$/
  ];

  for (const regex of patterns) {
    const match = token.match(regex);
    if (match) {
       let desc = match[2]!;
       if (match[3]) desc += match[3];
       return { ref: match[1]!, desc };
    }
  }

  return null;
}

function extractReferenceAndNarration(narration: string): { referenceNo: string | null; narration: string } {
  const tokens = cleanText(narration).split(/\s+/);
  
  if (tokens.length > 0) {
    const firstToken = tokens[0]!;
    
    // Try to un-fuse the reference number if pdf-parse squashed the columns
    const unfused = unfuseReferenceNumber(firstToken);
    
    if (unfused) {
      return {
        referenceNo: unfused.ref,
        narration: [unfused.desc, ...tokens.slice(1)].join(' ').trim()
      };
    }

    // A token is classified as a reference/cheque number if it contains at least one digit
    // and is not a money token.
    const isReferenceNumber = /\d/.test(firstToken) || firstToken.includes('-');
    
    if (isReferenceNumber && !isMoneyToken(firstToken)) {
      return {
        referenceNo: firstToken,
        narration: tokens.slice(1).join(' ').trim()
      };
    }
  }

  return { referenceNo: null, narration: narration.trim() };
}

function shouldStopParsing(line: string, hasParsedRows: boolean): boolean {
  const l = cleanText(line).toLowerCase();
  
  // If we see summary markers at the top of the page before any rows, don't stop parsing!
  const isSummaryMarker = l.startsWith('opening balance:') || 
                          l.startsWith('total withdrawals:') || 
                          l.startsWith('total deposits:') || 
                          l.startsWith('closing balance:');
  
  if (isSummaryMarker && !hasParsedRows) {
    return false;
  }

  return (
    isSummaryMarker ||
    l.startsWith('od limit:') ||
    l.startsWith('for non-resident customers') ||
    l.startsWith('for resident customers') ||
    l.includes('transaction codes in your account statement') ||
    l.startsWith('mandatory disclaimer') ||
    l.startsWith('have you registered a nominee') ||
    l.startsWith('benefits of nomination') ||
    l.startsWith('please check the entries') ||
    l.startsWith('* reward points') ||
    l.startsWith('to redeem your rewardz')
  );
}

function parseSummary(fullText: string): {
  openingBalance: string | null;
  totalWithdrawals: string | null;
  totalDeposits: string | null;
  closingBalance: string | null;
} {
  const summary = {
    openingBalance: null as string | null,
    totalWithdrawals: null as string | null,
    totalDeposits: null as string | null,
    closingBalance: null as string | null,
  };

  const oneLine = cleanText(fullText);
  const summaryMatch = oneLine.match(
    /Opening\s+Balance:\s*([\d,]+\.\d{1,2})\s*Total\s+Withdrawals:\s*([\d,]+\.\d{1,2})\s*Total\s+Deposits:\s*([\d,]+\.\d{1,2})\s*Closing\s+Balance:\s*([\d,]+\.\d{1,2})/i
  );

  if (summaryMatch) {
    summary.openingBalance = normalizeAmount(summaryMatch[1]);
    summary.totalWithdrawals = normalizeAmount(summaryMatch[2]);
    summary.totalDeposits = normalizeAmount(summaryMatch[3]);
    summary.closingBalance = normalizeAmount(summaryMatch[4]);
  }

  return summary;
}

function hasYesTableHeaderAt(lines: string[], startIndex: number): boolean {
  const headerWindow = lines
    .slice(startIndex, startIndex + 8)
    .map(line => cleanText(line).toLowerCase())
    .join(' ');

  return (
    headerWindow.includes('transaction date') &&
    headerWindow.includes('value date') &&
    headerWindow.includes('description') &&
    headerWindow.includes('running balance')
  );
}

function extractMetadata(fullText: string): {
  accountNumber: string | null;
  fromDate: string | null;
  toDate: string | null;
  accountHolderName: string | null;
  ifsc: string | null;
  micr: string | null;
  bankBranchName: string | null;
  customerId: string | null;
} {
  const accountMatch = fullText.match(/Statement\s+of\s+account:\s*(\d+)/i);
  const periodMatch = fullText.match(/Period:\s*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\s*-\s*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/i);

  // Customer/Account Holder Name:
  // YES Bank format: "Primary Account Holder Name: RINKALBEN ROSHAN KHUNT"
  // or name appears on the third non-empty line after the header
  const holderMatch = fullText.match(/Primary\s+(?:Account\s+)?Holder(?:\s+Name)?:\s*([A-Z][A-Z\s]+?)(?:\s*A\/C|\s*$)/im);
  // Fallback: name appears right after "Period:" line
  let accountHolderName: string | null = null;
  if (holderMatch) {
    accountHolderName = cleanText(holderMatch[1]!).replace(/\s+/g, ' ').trim();
  } else {
    // Try to get from the line right after period
    const afterPeriod = fullText.match(/Period:[^\n]+\n\s*([A-Z][A-Z\s]+)\n/);
    if (afterPeriod) {
      const candidate = cleanText(afterPeriod[1]!).trim();
      // Only accept if it looks like a name (2+ words, no numbers)
      if (candidate.split(/\s+/).length >= 2 && !/\d/.test(candidate)) {
        accountHolderName = candidate;
      }
    }
  }

  // IFSC Code: "IFSC Code: YESB0000400"
  const ifscMatch = fullText.match(/IFSC\s*Code\s*:?\s*([A-Z]{4}0[A-Z0-9]{6})/i);
  const ifsc = ifscMatch ? ifscMatch[1]!.toUpperCase() : null;

  // MICR Code: "MICR Code: 395532004"
  const micrMatch = fullText.match(/MICR\s*Code\s*:?\s*(\d{9})/i);
  const micr = micrMatch ? micrMatch[1]! : null;

  // Branch Name: "Name: YES BANK LTD - VARACCHA ROAD"
  // or "Your Branch details:\nName: ..."
  const branchMatch = fullText.match(/Your\s+Branch\s+details:\s*\n?\s*Name:\s*(.+?)(?:\n|Address)/i)
    || fullText.match(/(?:Branch\s+)?Name:\s*(YES\s+BANK[^\n]+)/i);
  const bankBranchName = branchMatch ? cleanText(branchMatch[1]!).trim() : null;

  // Customer ID: "Cust ID: 10557261"
  const custIdMatch = fullText.match(/Cust(?:omer)?\s*ID\s*:?\s*(\d+)/i);
  const customerId = custIdMatch ? custIdMatch[1]! : null;

  return {
    accountNumber: accountMatch ? accountMatch[1]! : null,
    fromDate: periodMatch ? parseYesDate(periodMatch[1]!) : null,
    toDate: periodMatch ? parseYesDate(periodMatch[2]!) : null,
    accountHolderName,
    ifsc,
    micr,
    bankBranchName,
    customerId,
  };
}

// -------------------- Detection --------------------

export function isYesBankStatement(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .replace(/\s+/g, ' ');

  const hasYesBank =
    normalized.includes('yes bank') ||
    normalized.includes('yes bank ltd') ||
    normalized.includes('yesbank');

  const hasStatement =
    normalized.includes('statement of account') ||
    normalized.includes('transaction details for your account number');

  const hasYesTable =
    normalized.includes('value date') ||
    normalized.includes('running balance') ||
    normalized.includes('cheque no/reference no') ||
    normalized.includes('withdrawals') ||
    normalized.includes('deposits');

  const isYesFallback = normalized.includes('yesb') && normalized.includes('statement of account');

  return (hasYesBank && hasStatement && hasYesTable) || isYesFallback;
}

// Alias if your bank registry prefers uppercase YES naming.
export const isYESBankStatement = isYesBankStatement;

// -------------------- Main parser --------------------

interface RawYesBlock {
  sourceRow: number;
  transactionDateRaw: string;
  valueDateRaw: string;
  chequeNumber: string | null;
  textLines: string[];
  startLineIdx: number;
}

export async function parseYesBankStatement(buffer: Buffer): Promise<ParsedStatementResult> {
  const data = await pdf(buffer);
  const fullText: string = data.text || '';
  const numPages = data.numpages || 1;

  console.log('[YES PARSER CALLED]', {
    textLength: fullText.length,
    first500: fullText.slice(0, 500),
  });

  console.log('[YES TEXT CHECK]', {
    length: fullText.length,
    hasYes: fullText.toLowerCase().includes('yes'),
    hasOct: fullText.includes('Oct'),
    datePairCount: [...fullText.matchAll(/\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\s+\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}/g)].length,
  });

  if (DEBUG_YES_PARSER) {
    console.log(`[YES Bank Parser Debug] isYesBankStatement: ${isYesBankStatement(fullText)}`);
    console.log(`[YES Bank Parser Debug] First 120 lines:\n${fullText.split('\n').slice(0, 120).join('\n')}`);
  }

  const result: ParsedStatementResult = {
    parser: 'YESBANK_DETERMINISTIC',
    bankName: 'YES BANK',
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

  const metadata = extractMetadata(fullText);
  result.accountNumber = metadata.accountNumber;
  result.statementFromDate = metadata.fromDate;
  result.statementToDate = metadata.toDate;
  result.accountHolderName = metadata.accountHolderName;
  result.ifsc = metadata.ifsc;
  result.micr = metadata.micr;
  result.bankBranchName = metadata.bankBranchName;
  result.customerId = metadata.customerId;

  const summary = parseSummary(fullText);
  result.openingBalance = summary.openingBalance;
  result.closingBalance = summary.closingBalance;

  const lines = fullText
    .split('\n')
    .map(line => cleanText(line))
    .filter(Boolean);

  const rowStartRegex = /^(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+(.+)$/;

  const blocks: RawYesBlock[] = [];
  let inTable = false;
  let currentBlock: RawYesBlock | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (!inTable) {
      if (hasYesTableHeaderAt(lines, i)) {
        inTable = true;
        continue;
      } else if (line.match(rowStartRegex)) {
        inTable = true;
      } else {
        continue;
      }
    }

    if (shouldStopParsing(line, blocks.length > 0 || currentBlock !== null)) {
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = null;
      break;
    }

    const rowMatch = line.match(rowStartRegex);
    if (rowMatch) {
      if (currentBlock) blocks.push(currentBlock);

      currentBlock = {
        sourceRow: blocks.length + 1,
        transactionDateRaw: rowMatch[1]!,
        valueDateRaw: rowMatch[2]!,
        chequeNumber: null,
        textLines: [rowMatch[3] || ''],
        startLineIdx: i,
      };
      continue;
    }

    if (currentBlock) {
      currentBlock.textLines.push(line);
    }
  }

  if (currentBlock) blocks.push(currentBlock);

  if (DEBUG_YES_PARSER) {
    console.log(`[YES Bank Parser Debug] Line-by-line block extraction found ${blocks.length} blocks.`);
  }

  // Fallback: If line-by-line fails due to irregular newlines, run full-text extraction
  if (blocks.length === 0) {
    if (DEBUG_YES_PARSER) {
      console.log(`[YES Bank Parser Debug] 0 blocks found. Running full-text fallback extraction...`);
    }
    const fallbackBlocks = parseYesBlocksFromFullText(fullText);
    blocks.push(...fallbackBlocks);
    
    if (DEBUG_YES_PARSER) {
      console.log(`[YES Bank Parser Debug] Fallback extraction found ${fallbackBlocks.length} blocks.`);
    }
  }

  if (blocks.length === 0) {
    result.validation.errors.push('No YES Bank transaction blocks found. Check parser routing or PDF text extraction.');
    return result;
  }

  const pageSize = Math.max(1, Math.ceil(lines.length / numPages));

  for (const block of blocks) {
    const transactionDate = parseYesDate(block.transactionDateRaw);
    const valueDate = parseYesDate(block.valueDateRaw);

    if (!transactionDate) {
      result.validation.warnings.push(
        `YES row ${block.sourceRow}: Could not parse transaction date "${block.transactionDateRaw}".`
      );
      continue;
    }

    const combined = cleanText(block.textLines.join(' '));
    const extracted = extractTrailingMoneyFields(combined);

    if (!extracted) {
      result.validation.warnings.push(
        `YES row ${block.sourceRow}: Could not extract amount and running balance from "${combined.slice(-100)}".`
      );
      continue;
    }

    const narration = cleanText(extracted.narration);
    const closingBalance = normalizeAmount(extracted.balance);
    const amount = normalizeAmount(extracted.amount);

    if (!narration || !closingBalance || !amount) {
      result.validation.warnings.push(
        `YES row ${block.sourceRow}: Invalid narration/amount/balance after extraction.`
      );
      continue;
    }

    const { referenceNo, narration: finalNarration } = extractReferenceAndNarration(narration);

    const row: ParsedStatementRow = {
      sourcePage: Math.ceil((block.startLineIdx + 1) / pageSize),
      sourceRow: block.sourceRow,
      serialNo: block.sourceRow,
      transactionDate,
      valueDate,
      narration: finalNarration,
      chequeNumber: null,
      referenceNo,
      debitAmount: null,
      creditAmount: null,
      closingBalance,
      rawText: [block.transactionDateRaw, block.valueDateRaw, ...block.textLines]
        .filter(Boolean)
        .join('\n'),
    };

    (row as any)._tempAmount = amount;
    result.rows.push(row);
  }

  classifyYesRows(result, summary.openingBalance);
  calculateYesTotals(result);
  validateYesStatement(result, summary);

  // Remove parser-only temporary fields.
  for (const row of result.rows) {
    delete (row as any)._tempAmount;
  }

  // Generate statement fingerprint for dedup
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

  return result;
}

export const parseYESBankStatement = parseYesBankStatement;
export const __test__ = {
  extractTrailingMoneyFields,
  classifyYesRows,
  hasYesTableHeaderAt,
  parseYesBlocksFromFullText
};

// -------------------- Fallback Extractor --------------------

function parseYesBlocksFromFullText(fullText: string): RawYesBlock[] {
  const tableStart = fullText.search(/Transaction\s*Date|Value\s*Date|Cheque\s*No\/Reference\s*No|Running\s*Balance/i);
  let text = tableStart >= 0 ? fullText.slice(tableStart) : fullText;

  const stopIndex = text.search(/Opening\s+Balance:|OD\s+Limit:|For\s+Non-Resident|For\s+Resident|Mandatory\s+disclaimer|Transaction\s+codes/i);
  if (stopIndex >= 0) text = text.slice(0, stopIndex);

  text = text
    .replace(/\uFFFE/g, '-')
    .replace(/\u0000/g, '')
    .replace(/\r/g, '\n');

  const rowStartRegex = /(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\s*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\s*/g;

  const matches = [...text.matchAll(rowStartRegex)];
  const blocks: RawYesBlock[] = [];

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!;
    const start = m.index!;
    const contentStart = start + m[0]!.length;
    const end = i + 1 < matches.length ? matches[i + 1]!.index! : text.length;

    const rest = cleanText(text.slice(contentStart, end));

    blocks.push({
      sourceRow: i + 1,
      transactionDateRaw: m[1]!,
      valueDateRaw: m[2]!,
      chequeNumber: null,
      textLines: [rest],
      startLineIdx: i,
    });
  }

  return blocks;
}

// -------------------- Classification and validation --------------------

function classifyYesRows(result: ParsedStatementResult, openingBalance: string | null): void {
  if (result.rows.length === 0) return;

  // YES Bank sample is newest-to-oldest. For row i, the older balance is:
  // - row i + 1 closing balance, or
  // - statement opening balance for the oldest row.
  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows[i]!;
    const amount = normalizeAmount((row as any)._tempAmount);
    if (!amount) continue;

    const amountNum = toNumber(amount);
    const currentBal = toNumber(row.closingBalance);

    let olderBal: number | null = null;
    if (i + 1 < result.rows.length) {
      olderBal = toNumber(result.rows[i + 1]!.closingBalance);
    } else if (openingBalance) {
      olderBal = toNumber(openingBalance);
    }

    if (olderBal !== null) {
      const diff = currentBal - olderBal;
      if (nearlyEqual(diff, amountNum)) {
        row.creditAmount = amount;
      } else if (nearlyEqual(-diff, amountNum)) {
        row.debitAmount = amount;
      } else {
        // Fallback by direction, but keep warning for review.
        if (currentBal >= olderBal) row.creditAmount = amount;
        else row.debitAmount = amount;

        result.validation.warnings.push(
          `YES row ${row.sourceRow}: Balance chain difference ${diff.toFixed(2)} does not match amount ${amount}. Classified by direction.`
        );
      }
    } else {
      // Single-row statement without opening balance: cannot know direction from text alone.
      // Keep it as credit by default and warn.
      row.creditAmount = amount;
      result.validation.warnings.push(
        `YES row ${row.sourceRow}: Could not infer debit/credit direction from running balance; defaulted to credit.`
      );
    }
  }
}

function calculateYesTotals(result: ParsedStatementResult): void {
  const debitRows = result.rows.filter(r => r.debitAmount !== null);
  const creditRows = result.rows.filter(r => r.creditAmount !== null);

  result.debitCount = debitRows.length;
  result.creditCount = creditRows.length;
  result.totalDebit = debitRows.reduce((sum, row) => sum + toNumber(row.debitAmount), 0).toFixed(2);
  result.totalCredit = creditRows.reduce((sum, row) => sum + toNumber(row.creditAmount), 0).toFixed(2);

  if (!result.closingBalance && result.rows.length > 0) {
    // Since YES rows are newest-to-oldest, first row has the statement closing balance.
    result.closingBalance = result.rows[0]!.closingBalance;
  }

  if (!result.openingBalance && result.rows.length > 0) {
    // Best effort: derive opening from oldest row.
    const oldest = result.rows[result.rows.length - 1]!;
    const debit = toNumber(oldest.debitAmount);
    const credit = toNumber(oldest.creditAmount);
    const bal = toNumber(oldest.closingBalance);
    result.openingBalance = (bal + debit - credit).toFixed(2);
  }
}

function validateYesStatement(result: ParsedStatementResult, summary: any): void {
  // Never clear rows due to validation failure.
  // We only add warnings/errors to the validation object.
  result.validation.isValid = true;

  if (result.rows.length === 0) {
    result.validation.isValid = false;
    return;
  }

  const errors: string[] = result.validation.errors;
  const warnings: string[] = result.validation.warnings;

  for (const row of result.rows) {
    if (!row.transactionDate) errors.push(`YES row ${row.sourceRow}: Missing transaction date.`);
    if (!row.valueDate) warnings.push(`YES row ${row.sourceRow}: Missing value date.`);
    if (!row.narration) errors.push(`YES row ${row.sourceRow}: Missing narration.`);
    if (!row.closingBalance) errors.push(`YES row ${row.sourceRow}: Missing running balance.`);
    if (row.debitAmount && row.creditAmount) errors.push(`YES row ${row.sourceRow}: Has both debit and credit amount.`);
    if (!row.debitAmount && !row.creditAmount) errors.push(`YES row ${row.sourceRow}: Missing debit/credit amount.`);
  }

  // Check running balances in newest-to-oldest display order.
  if (result.rows.length > 0 && result.openingBalance) {
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows[i]!;
      const olderBal = i + 1 < result.rows.length
        ? toNumber(result.rows[i + 1]!.closingBalance)
        : toNumber(result.openingBalance);
      const expected = olderBal - toNumber(row.debitAmount) + toNumber(row.creditAmount);
      const actual = toNumber(row.closingBalance);

      if (!nearlyEqual(expected, actual, 0.05)) {
        warnings.push(
          `YES row ${row.sourceRow}: Running balance mismatch. Expected ${expected.toFixed(2)}, got ${actual.toFixed(2)}.`
        );
      }
    }
  }

  if (summary.totalWithdrawals && result.totalDebit && !nearlyEqual(toNumber(summary.totalWithdrawals), toNumber(result.totalDebit), 0.05)) {
    warnings.push(`YES total withdrawals mismatch. Statement ${summary.totalWithdrawals}, parsed ${result.totalDebit}.`);
  }

  if (summary.totalDeposits && result.totalCredit && !nearlyEqual(toNumber(summary.totalDeposits), toNumber(result.totalCredit), 0.05)) {
    warnings.push(`YES total deposits mismatch. Statement ${summary.totalDeposits}, parsed ${result.totalCredit}.`);
  }

  if (summary.closingBalance && result.closingBalance && !nearlyEqual(toNumber(summary.closingBalance), toNumber(result.closingBalance), 0.05)) {
    warnings.push(`YES closing balance mismatch. Statement ${summary.closingBalance}, parsed ${result.closingBalance}.`);
  }

  result.validation = {
    isValid: result.rows.length > 0, // IMPORTANT: Even if there are errors, we return true so the UI can review the rows
    errors,
    warnings,
  };
}
