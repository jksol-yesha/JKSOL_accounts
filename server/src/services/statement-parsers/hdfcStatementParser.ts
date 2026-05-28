/**
 * Deterministic HDFC Bank Statement PDF Parser.
 *
 * IMPORTANT: pdf-parse extracts text from HDFC statements with columns
 * concatenated WITHOUT spaces. For example:
 *   "01/01/26NEFT DR-ICIC0001837-KALPESH...HDFCH0070724224001/01/26800,000.001,066,194.71"
 *
 * This parser uses regex-based extraction to handle this format.
 *
 * Key design decisions:
 * - Chq./Ref.No. is kept as `referenceNo`, NEVER merged into narration.
 * - Multi-line narrations are handled by continuing until the next date line.
 * - Amounts are normalized to plain decimal strings (no commas).
 * - Statement summary (opening/closing balance, totals) is extracted for fingerprinting.
 */

if (typeof (globalThis as any).DOMMatrix === 'undefined') {
  (globalThis as any).DOMMatrix = class DOMMatrix {} as any;
}

// @ts-ignore - pdf-parse doesn't have proper TypeScript definitions
import pdf from 'pdf-parse/lib/pdf-parse.js';
import type { ParsedStatementResult, ParsedStatementRow } from './types';

// ── Date regex: DD/MM/YY or DD/MM/YYYY ──
const DATE_REGEX = /^(\d{2})\/(\d{2})\/(\d{2,4})/;
// Date pattern that can appear anywhere (for finding embedded dates)
const DATE_PATTERN = /(\d{2}\/\d{2}\/\d{2,4})/;
// Amount pattern: Indian format like 1,23,456.78 or 800,000.00 or 43.00
const AMOUNT_PATTERN = /(\d{1,3}(?:,\d{2,3})*\.\d{2})/;

/**
 * Normalize an Indian-format amount string to a plain decimal.
 * "1,23,456.78" → "123456.78"
 */
function normalizeAmount(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const cleaned = raw.trim().replace(/,/g, '');
  if (!/^\d+\.\d{2}$/.test(cleaned)) return null;
  return cleaned;
}

/**
 * Parse a DD/MM/YY or DD/MM/YYYY date string to YYYY-MM-DD.
 */
function parseHDFCDate(dateStr: string): string | null {
  const match = dateStr.trim().match(DATE_REGEX);
  if (!match) return null;

  const dd = match[1]!;
  const mm = match[2]!;
  let yy = match[3]!;

  if (yy.length === 2) {
    const yearNum = parseInt(yy, 10);
    yy = yearNum > 50 ? `19${yy}` : `20${yy}`;
  }

  return `${yy}-${mm}-${dd}`;
}

/**
 * Detect if this PDF text looks like an HDFC bank statement.
 */
export function isHDFCStatement(text: string): boolean {
  const upper = text.substring(0, 3000).toUpperCase();
  return (
    upper.includes('HDFC BANK') &&
    (upper.includes('NARRATION') || upper.includes('CHQ./REF.NO') || upper.includes('WITHDRAWAL AMT') || upper.includes('DEPOSIT AMT'))
  ) || (
    // Also detect when columns are concatenated (no spaces)
    upper.includes('HDFC') &&
    (upper.includes('DATENARRATION') || upper.includes('WITHDRAWAL AMT') || upper.includes('CLOSING BALANCE'))
  );
}

/**
 * Main parser function. Returns a fully structured ParsedStatementResult.
 */
export async function parseHDFCStatement(buffer: Buffer): Promise<ParsedStatementResult> {
  const data = await pdf(buffer);
  const fullText: string = data.text;
  const numPages = data.numpages || 1;

  const result: ParsedStatementResult = {
    parser: 'HDFC_DETERMINISTIC',
    bankName: 'HDFC',
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

  // ── Extract account number ──
  const accMatch = fullText.match(/(?:Account\s*(?:No|Number|#)\.?\s*:?\s*)(\d{9,18})/i);
  if (accMatch) {
    result.accountNumber = accMatch[1]!;
  } else {
    // Fallback: look for long number sequences near header
    const headerText = lines.slice(0, 30).join(' ');
    const fallbackMatch = headerText.match(/(?:A\/C|ACCOUNT|ACC)\s*[:\-]?\s*(\d{9,18})/i);
    if (fallbackMatch) result.accountNumber = fallbackMatch[1]!;
  }

  // ── Extract statement period ──
  // Handle concatenated format: "From  :  01/01/2026To  :  31/01/2026"
  const periodMatch = fullText.match(
    /From\s*:?\s*(\d{2}\/\d{2}\/\d{2,4})\s*(?:To|[-–])\s*:?\s*(\d{2}\/\d{2}\/\d{2,4})/i
  );
  if (periodMatch) {
    result.statementFromDate = parseHDFCDate(periodMatch[1]!);
    result.statementToDate = parseHDFCDate(periodMatch[2]!);
  }

  // ── Extract account metadata ──
  // IFSC: "RTGS/NEFT IFSC :  HDFC0004693" or "IFSC:HDFC0004693"
  const ifscMatch = fullText.match(/IFSC\s*:?\s*([A-Z]{4}0[A-Z0-9]{6})/i);
  if (ifscMatch) result.ifsc = ifscMatch[1]!.toUpperCase();

  // MICR: "MICR : 395240029"
  const micrMatch = fullText.match(/MICR\s*:?\s*(\d{9})/i);
  if (micrMatch) result.micr = micrMatch[1]!;

  // Account Holder: "M/S.    SWAINFO SOLUTIONS" or line after a known header
  const holderMatch = fullText.match(/(?:M\/S\.?\s*)([\w\s]+?)(?:\n|$)/i)
    || fullText.match(/(?:Account\s*(?:Holder|Name)\s*:?\s*)([\w\s]+?)(?:\n|$)/i);
  if (holderMatch) {
    const candidate = holderMatch[1]!.trim();
    if (candidate.length >= 3 && candidate.length <= 150) {
      result.accountHolderName = candidate;
    }
  }

  // Branch Name: "Account Branch  :  SARTHANA CHOKDI BRANCH"
  const branchMatch = fullText.match(/Account\s*Branch\s*:?\s*(.+?)(?:\n|$)/i);
  if (branchMatch) result.bankBranchName = branchMatch[1]!.trim();

  // Customer ID: "Cust ID:  161272245"
  const custMatch = fullText.match(/Cust(?:omer)?\s*ID\s*:?\s*(\d+)/i);
  if (custMatch) result.customerId = custMatch[1]!;

  // ── Extract statement summary ──
  // Real format: "Opening BalanceDr CountCr CountDebitsCreditsClosing Bal"
  // Values:      "1,866,194.71321,600,043.00360,688.00626,839.71"
  // This is tricky — we need to parse the summary line carefully

  // Try to find the summary section
  const summaryIdx = fullText.toUpperCase().indexOf('STATEMENT SUMMARY');
  if (summaryIdx !== -1) {
    const summaryBlock = fullText.substring(summaryIdx, summaryIdx + 500);

    // Extract opening balance (first amount on the values line after headers)
    // The summary header: "Opening BalanceDr CountCr CountDebitsCreditsClosing Bal"
    // The values line contains amounts concatenated
    const summaryLines = summaryBlock.split('\n').filter(l => l.trim());

    // Find the line with amounts (contains digits and commas, no letters except in header)
    for (const sLine of summaryLines) {
      // Skip header-like lines
      if (sLine.toUpperCase().includes('OPENING BALANCE') && sLine.toUpperCase().includes('CLOSING')) continue;
      if (sLine.toUpperCase().includes('STATEMENT SUMMARY')) continue;
      if (sLine.toUpperCase().includes('GENERATED')) continue;

      // Try to extract all amounts from this line
      const amounts = sLine.match(/(\d{1,3}(?:,\d{2,3})*\.\d{2})/g);
      if (amounts && amounts.length >= 4) {
        // Format: OpeningBalance, [DrCount is integer, skip], Debits, Credits, ClosingBalance
        // Real example: "1,866,194.71321,600,043.00360,688.00626,839.71"
        // The integers (DrCount=3, CrCount=2) are embedded between amounts

        // Better approach: extract from known positions
        // Opening balance is first amount
        result.openingBalance = normalizeAmount(amounts[0]!);

        // Closing balance is last amount
        result.closingBalance = normalizeAmount(amounts[amounts.length - 1]!);

        // Find Dr/Cr counts - look for single digits between amounts
        const countMatch = sLine.match(/(\d{1,3}(?:,\d{2,3})*\.\d{2})(\d{1,3})(\d{1,3})/);
        if (countMatch) {
          // Try a simpler approach: get the full numeric string and parse manually
        }

        // Total debits and credits
        if (amounts.length >= 4) {
          // Assume: opening, debits, credits, closing (simplest case)
          result.totalDebit = normalizeAmount(amounts[amounts.length - 3]!);
          result.totalCredit = normalizeAmount(amounts[amounts.length - 2]!);
        }

        break;
      }
    }
  }

  // Fallback regex-based extraction for summary values
  if (!result.openingBalance) {
    const obMatch = fullText.match(/Opening\s*Balance\s*[:\s]*(\d{1,3}(?:,\d{2,3})*\.\d{2})/i);
    if (obMatch) result.openingBalance = normalizeAmount(obMatch[1]!);
  }
  if (!result.closingBalance) {
    const cbMatch = fullText.match(/Closing\s*Bal(?:ance)?\s*[:\s]*(\d{1,3}(?:,\d{2,3})*\.\d{2})/i);
    if (cbMatch) result.closingBalance = normalizeAmount(cbMatch[1]!);
  }
  if (!result.totalDebit) {
    const tdMatch = fullText.match(/Debits?\s*[:\s]*(\d{1,3}(?:,\d{2,3})*\.\d{2})/i);
    if (tdMatch) result.totalDebit = normalizeAmount(tdMatch[1]!);
  }
  if (!result.totalCredit) {
    const tcMatch = fullText.match(/Credits?\s*[:\s]*(\d{1,3}(?:,\d{2,3})*\.\d{2})/i);
    if (tcMatch) result.totalCredit = normalizeAmount(tcMatch[1]!);
  }

  // Extract Dr/Cr counts
  const drCountMatch = fullText.match(/Dr\s*Count\s*[:\s]*(\d+)/i);
  if (drCountMatch) result.debitCount = parseInt(drCountMatch[1]!, 10);
  const crCountMatch = fullText.match(/Cr\s*Count\s*[:\s]*(\d+)/i);
  if (crCountMatch) result.creditCount = parseInt(crCountMatch[1]!, 10);

  // ── Parse transaction rows ──
  // Find the header line to know where transactions start
  let transactionStartIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.toUpperCase();
    if (
      (line.includes('NARRATION') && (line.includes('WITHDRAWAL') || line.includes('DEPOSIT') || line.includes('CLOSING'))) ||
      (line.includes('DATE') && line.includes('NARRATION') && line.includes('CHQ')) ||
      // Concatenated header: "DateNarrationChq./Ref.No.Value DtWithdrawal Amt.Deposit Amt.Closing Balance"
      (line.includes('DATENARRATION') && line.includes('CLOSING'))
    ) {
      transactionStartIdx = i + 1;
      break;
    }
  }

  if (transactionStartIdx === -1) {
    result.validation.errors.push('Could not find transaction header row in HDFC statement.');
    return result;
  }

  // ── Parse rows using concatenated-text-aware logic ──
  // Each transaction starts with DD/MM/YY and may span multiple lines.
  // Real format: "01/01/26NEFT DR-ICIC0001837-...HDFCH0070724224001/01/26800,000.001,066,194.71"
  //
  // Strategy: collect blocks that start with a date, then parse each block
  // using regex to extract: txnDate, narration, refNo, valueDate, amounts, closingBalance.

  interface RawTxnBlock {
    lines: string[];
    startIdx: number;
  }

  const txnBlocks: RawTxnBlock[] = [];
  let currentBlock: RawTxnBlock | null = null;

  for (let i = transactionStartIdx; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Stop at summary/footer sections
    const upper = trimmed.toUpperCase();
    if (
      upper.startsWith('STATEMENT SUMMARY') ||
      upper.startsWith('LEGENDS') ||
      upper.startsWith('****') ||
      upper.startsWith('THIS IS A COMPUTER') ||
      upper.startsWith('UNLESS THE CONSTITUENT')
    ) {
      break;
    }

    // Check if this line starts with a date (DD/MM/YY)
    const dateMatch = trimmed.match(DATE_REGEX);
    if (dateMatch) {
      if (currentBlock) {
        txnBlocks.push(currentBlock);
      }
      currentBlock = { lines: [trimmed], startIdx: i };
    } else if (currentBlock) {
      // Continuation of current transaction (multi-line narration)
      currentBlock.lines.push(trimmed);
    }
  }
  if (currentBlock) {
    txnBlocks.push(currentBlock);
  }

  // ── Process each block into a ParsedStatementRow ──
  let rowCounter = 0;
  const pageSize = lines.length / numPages;

  for (const block of txnBlocks) {
    rowCounter++;

    // Join all lines for amount/date extraction (amounts may be on any line)
    const combinedText = block.lines.join(' ');

    // Extract transaction date from the start
    const txnDateStr = combinedText.match(DATE_REGEX)?.[0];
    if (!txnDateStr) continue;
    const transactionDate = parseHDFCDate(txnDateStr);
    if (!transactionDate) continue;

    // Remove the transaction date prefix
    const remaining = combinedText.substring(txnDateStr.length);

    // ── Extract ALL amounts from the combined text ──
    const allAmounts: { value: string; index: number; length: number }[] = [];
    const amtRegex = /(\d{1,3}(?:,\d{2,3})*\.\d{2})/g;
    let amtMatch;
    while ((amtMatch = amtRegex.exec(remaining)) !== null) {
      allAmounts.push({
        value: amtMatch[1]!,
        index: amtMatch.index,
        length: amtMatch[0].length,
      });
    }

    if (allAmounts.length === 0) {
      result.validation.warnings.push(`Row ${rowCounter}: No amounts found`);
      continue;
    }

    // Closing balance is the LAST amount
    const closingBalanceRaw = allAmounts[allAmounts.length - 1]!;
    const closingBalanceStr = normalizeAmount(closingBalanceRaw.value);
    if (!closingBalanceStr) {
      result.validation.warnings.push(`Row ${rowCounter}: Could not normalize closing balance`);
      continue;
    }

    // The transaction amount(s) are the amounts before closing balance
    let debitAmount: string | null = null;
    let creditAmount: string | null = null;

    if (allAmounts.length >= 2) {
      const txnAmountRaw = allAmounts[allAmounts.length - 2]!;
      const txnAmountStr = normalizeAmount(txnAmountRaw.value);

      if (allAmounts.length >= 3) {
        const amt1 = normalizeAmount(allAmounts[allAmounts.length - 3]!.value);
        const amt2 = txnAmountStr;
        debitAmount = amt1;
        creditAmount = amt2;
      } else {
        debitAmount = txnAmountStr;
      }
    }

    // ── Extract value date ──
    // Find all dates in the remaining text
    const allDates: { value: string; index: number }[] = [];
    const dateRegexGlobal = /(\d{2}\/\d{2}\/\d{2,4})/g;
    let dateMatchG;
    while ((dateMatchG = dateRegexGlobal.exec(remaining)) !== null) {
      allDates.push({ value: dateMatchG[1]!, index: dateMatchG.index });
    }

    let valueDateStr: string | null = null;
    let referenceNo: string | null = null;

    // Value date is the LAST date before the amounts section
    if (allDates.length > 0) {
      const lastDate = allDates[allDates.length - 1]!;
      valueDateStr = parseHDFCDate(lastDate.value);

      // Reference number is right before the value date
      const textBeforeValueDate = remaining.substring(0, lastDate.index);

      // Extract reference using known HDFC reference patterns:
      // HDFCH followed by digits, CITIN followed by digits, CINB followed by digits,
      // NB followed by digits, all-zero sequences (cash deposits)
      const refPatterns = [
        /(?:HDFCH\d{10,})\s*$/i,       // HDFC internal ref
        /(?:CITIN\d{10,})\s*$/i,        // Citibank NEFT ref
        /(?:CINB\d{10,})\s*$/i,         // CINB ref
        /(?:NB\d{10,})\s*$/i,           // NB ref
        /(?:0{10,})\s*$/,               // Cash deposit (all zeros)
        /(?:[A-Z]{4,5}\d{10,})\s*$/i,   // Generic: 4-5 letter prefix + 10+ digits
      ];

      for (const pattern of refPatterns) {
        const refMatch = textBeforeValueDate.match(pattern);
        if (refMatch) {
          referenceNo = refMatch[0]!.trim();
          break;
        }
      }
    }

    // ── Build narration ──
    // Narration = all text between txn date and the ref/valueDate/amounts section
    // Plus any continuation text after the last amount

    // Find where the structural portion starts
    let narrationEndIdx = remaining.length;

    if (referenceNo) {
      // Find the FIRST occurrence of refNo (on the first line, before amounts)
      const refIdx = remaining.indexOf(referenceNo);
      if (refIdx !== -1) {
        narrationEndIdx = refIdx;
      }
    } else if (allDates.length > 0) {
      narrationEndIdx = allDates[allDates.length - 1]!.index;
    } else if (allAmounts.length > 0) {
      narrationEndIdx = allAmounts[0]!.index;
    }

    // Get the narration portion (before ref/dates/amounts)
    let narrationBefore = remaining.substring(0, narrationEndIdx).trim();

    // Also collect any text AFTER the last amount (continuation narration lines)
    const lastAmountEnd = closingBalanceRaw.index + closingBalanceRaw.length;
    let narrationAfter = remaining.substring(lastAmountEnd).trim();

    // Combine narration parts
    let narration = narrationBefore;
    if (narrationAfter) {
      narration = narration ? `${narration} ${narrationAfter}` : narrationAfter;
    }

    // Clean up narration: remove trailing commas, extra spaces, embedded amounts/dates
    narration = narration
      .replace(/\d{2}\/\d{2}\/\d{2,4}/g, '') // Remove any leftover dates
      .replace(/\d{1,3}(?:,\d{2,3})*\.\d{2}/g, '') // Remove any leftover amounts
      .replace(/\s+/g, ' ')
      .replace(/^[,\s]+|[,\s]+$/g, '')
      .trim();

    const estimatedPage = Math.ceil((block.startIdx + 1) / pageSize);

    const row: ParsedStatementRow = {
      sourcePage: estimatedPage,
      sourceRow: rowCounter,
      transactionDate,
      valueDate: valueDateStr,
      narration,
      referenceNo,
      debitAmount,
      creditAmount,
      closingBalance: closingBalanceStr,
      rawText: combinedText,
    };

    result.rows.push(row);
  }

  // ── Post-processing: use balance chain to fix debit/credit classification ──
  if (result.rows.length > 0) {
    let prevBalance = result.openingBalance ? parseFloat(result.openingBalance) : null;

    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows[i]!;
      const currentClosing = parseFloat(row.closingBalance);

      // If we have opening balance, use balance chain to determine debit/credit
      if (prevBalance !== null) {
        const amt1 = row.debitAmount ? parseFloat(row.debitAmount) : 0;
        const amt2 = row.creditAmount ? parseFloat(row.creditAmount) : 0;

        if (amt1 > 0 && amt2 > 0) {
          // Two amounts found — one is the real txn, other might be from narration
          // Test which one correctly chains the balance
          const testAsDebit1 = prevBalance - amt1;
          const testAsCredit1 = prevBalance + amt1;
          const testAsDebit2 = prevBalance - amt2;
          const testAsCredit2 = prevBalance + amt2;

          if (Math.abs(testAsDebit1 - currentClosing) < 0.01) {
            row.debitAmount = row.debitAmount;
            row.creditAmount = null;
          } else if (Math.abs(testAsCredit1 - currentClosing) < 0.01) {
            row.creditAmount = row.debitAmount;
            row.debitAmount = null;
          } else if (Math.abs(testAsDebit2 - currentClosing) < 0.01) {
            row.debitAmount = row.creditAmount;
            row.creditAmount = null;
          } else if (Math.abs(testAsCredit2 - currentClosing) < 0.01) {
            row.creditAmount = row.creditAmount;
            row.debitAmount = null;
          } else {
            // Neither fits — use the second amount (more likely the transaction amount)
            // and determine direction from balance movement
            const balanceDelta = currentClosing - prevBalance;
            if (balanceDelta < 0) {
              row.debitAmount = normalizeAmount(Math.abs(balanceDelta).toFixed(2));
              row.creditAmount = null;
            } else {
              row.creditAmount = normalizeAmount(Math.abs(balanceDelta).toFixed(2));
              row.debitAmount = null;
            }
          }
        } else if (amt1 > 0 && amt2 === 0) {
          // Single amount — determine direction from balance chain
          const testAsDebit = prevBalance - amt1;
          const testAsCredit = prevBalance + amt1;

          if (Math.abs(testAsDebit - currentClosing) < 0.01) {
            row.debitAmount = row.debitAmount;
            row.creditAmount = null;
          } else if (Math.abs(testAsCredit - currentClosing) < 0.01) {
            row.creditAmount = row.debitAmount;
            row.debitAmount = null;
          } else {
            // Amount doesn't match — derive from balance delta
            const balanceDelta = currentClosing - prevBalance;
            if (balanceDelta < 0) {
              row.debitAmount = normalizeAmount(Math.abs(balanceDelta).toFixed(2));
              row.creditAmount = null;
            } else {
              row.creditAmount = normalizeAmount(Math.abs(balanceDelta).toFixed(2));
              row.debitAmount = null;
            }
          }
        } else {
          // No amounts parsed — derive entirely from balance
          const balanceDelta = currentClosing - prevBalance;
          if (balanceDelta < 0) {
            row.debitAmount = normalizeAmount(Math.abs(balanceDelta).toFixed(2));
            row.creditAmount = null;
          } else if (balanceDelta > 0) {
            row.creditAmount = normalizeAmount(Math.abs(balanceDelta).toFixed(2));
            row.debitAmount = null;
          }
        }
      }

      prevBalance = currentClosing;
    }
  }

  // ── Derive from/to dates from rows if not found in header ──
  if (!result.statementFromDate && result.rows.length > 0) {
    result.statementFromDate = result.rows[0]!.transactionDate;
  }
  if (!result.statementToDate && result.rows.length > 0) {
    result.statementToDate = result.rows[result.rows.length - 1]!.transactionDate;
  }

  // ── Derive totals from rows ──
  const rowDebits = result.rows.filter(r => r.debitAmount !== null);
  const rowCredits = result.rows.filter(r => r.creditAmount !== null);

  if (result.debitCount === null) result.debitCount = rowDebits.length;
  if (result.creditCount === null) result.creditCount = rowCredits.length;

  if (result.totalDebit === null) {
    const sum = rowDebits.reduce((acc, r) => acc + parseFloat(r.debitAmount!), 0);
    result.totalDebit = sum.toFixed(2);
  }
  if (result.totalCredit === null) {
    const sum = rowCredits.reduce((acc, r) => acc + parseFloat(r.creditAmount!), 0);
    result.totalCredit = sum.toFixed(2);
  }

  // ── Derive closing balance from last row if not found ──
  if (result.closingBalance === null && result.rows.length > 0) {
    result.closingBalance = result.rows[result.rows.length - 1]!.closingBalance;
  }

  // ── Generate statement fingerprint for dedup ──
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

  // ── Run validation ──
  validateStatement(result);

  return result;
}

/**
 * Validate the parsed HDFC statement for accounting-grade integrity.
 */
function validateStatement(result: ParsedStatementResult): void {
  const errors: string[] = [];
  const warnings: string[] = [...result.validation.warnings];

  if (result.rows.length === 0) {
    errors.push('No transaction rows were parsed from the statement.');
    result.validation.errors = errors;
    result.validation.warnings = warnings;
    result.validation.isValid = false;
    return;
  }

  // 1. Validate balance chain (each row's closing follows from previous)
  if (result.openingBalance !== null) {
    let prevBal = parseFloat(result.openingBalance);
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows[i]!;
      const debit = row.debitAmount ? parseFloat(row.debitAmount) : 0;
      const credit = row.creditAmount ? parseFloat(row.creditAmount) : 0;
      const expectedBal = prevBal - debit + credit;
      const actualBal = parseFloat(row.closingBalance);
      const diff = Math.abs(expectedBal - actualBal);

      if (diff > 0.01) {
        warnings.push(
          `Row ${row.sourceRow} (${row.transactionDate}): Balance chain broken. Expected ${expectedBal.toFixed(2)} but got ${actualBal}. (prev=${prevBal.toFixed(2)}, debit=${debit.toFixed(2)}, credit=${credit.toFixed(2)})`
        );
      }
      prevBal = actualBal;
    }
  }

  // 2. Ensure every row has either debit or credit
  for (const row of result.rows) {
    if (row.debitAmount === null && row.creditAmount === null) {
      errors.push(
        `Row ${row.sourceRow} (${row.transactionDate}): Neither debit nor credit amount found.`
      );
    }
  }

  // 3. Validate opening + credits - debits = closing
  if (result.openingBalance !== null && result.closingBalance !== null) {
    const actualTotalDebit = result.rows
      .filter(r => r.debitAmount !== null)
      .reduce((sum, r) => sum + parseFloat(r.debitAmount!), 0);
    const actualTotalCredit = result.rows
      .filter(r => r.creditAmount !== null)
      .reduce((sum, r) => sum + parseFloat(r.creditAmount!), 0);
    const expectedClosing = parseFloat(result.openingBalance) + actualTotalCredit - actualTotalDebit;
    const actualClosing = parseFloat(result.closingBalance);
    const diff = Math.abs(expectedClosing - actualClosing);
    if (diff > 0.01) {
      warnings.push(
        `Balance equation mismatch: Opening (${result.openingBalance}) + Credits (${actualTotalCredit.toFixed(2)}) - Debits (${actualTotalDebit.toFixed(2)}) = ${expectedClosing.toFixed(2)}, but closing balance is ${result.closingBalance}.`
      );
    }
  }

  result.validation.errors = errors;
  result.validation.warnings = warnings;
  result.validation.isValid = errors.length === 0;
}
