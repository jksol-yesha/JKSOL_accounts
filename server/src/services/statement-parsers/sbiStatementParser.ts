/**
 * Deterministic SBI (State Bank of India) Statement PDF Parser.
 *
 * SBI statements have a tabular structure with columns:
 *   Txn Date | Value Date | Description | Ref/Cheque No. | Debit | Credit | Balance
 *
 * Key SBI-specific rules:
 *   - Date format: DD-MM-YY  (e.g. 01-08-23 → 2023-08-01)
 *   - Amounts may carry DR/CR suffix: "118.00 DR", "164211.00 CR"
 *   - Balance carries DR/CR suffix: "171191.04 CR"
 *   - "-" means no amount (null)
 *   - Ref/Cheque No. "000000" is preserved exactly
 *   - Description may wrap across multiple lines
 */

if (typeof (globalThis as any).DOMMatrix === 'undefined') {
  (globalThis as any).DOMMatrix = class DOMMatrix {} as any;
}

// @ts-ignore
import pdf from 'pdf-parse/lib/pdf-parse.js';
import type { ParsedStatementResult, ParsedStatementRow } from './types';

// ─── Helpers ───

/**
 * Normalize a raw amount string: strip commas, DR/CR suffix, validate format.
 * Returns decimal string with 2 places, or null if invalid/empty/"-".
 */
function normalizeAmount(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim() || raw.trim() === '-') return null;
  // Strip DR/CR suffix and commas
  const cleaned = raw.trim().replace(/\s*(DR|CR)\s*$/i, '').replace(/,/g, '').trim();
  if (!cleaned || cleaned === '-') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  // Ensure two decimal places
  if (!cleaned.includes('.')) return cleaned + '.00';
  const parts = cleaned.split('.');
  return parts[0] + '.' + parts[1]!.padEnd(2, '0');
}

/**
 * Parse SBI date format DD-MM-YY to YYYY-MM-DD.
 * Assumes 2000s century for 2-digit years (00-99 → 2000-2099).
 */
function parseSBIDate(dateStr: string): string | null {
  const trimmed = dateStr.trim();
  // Match DD-MM-YY or DD-MM-YYYY
  const match = trimmed.match(/^(\d{2})-(\d{2})-(\d{2,4})$/);
  if (!match) return null;

  const day = match[1]!;
  const month = match[2]!;
  let year = match[3]!;

  // Convert 2-digit year to 4-digit
  if (year.length === 2) {
    year = '20' + year;
  }

  // Basic validation
  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > 2099) return null;

  return `${year}-${month}-${day}`;
}

/**
 * Extract DR/CR suffix from a balance string.
 */
function extractBalanceType(raw: string): 'CR' | 'DR' | null {
  const trimmed = raw.trim().toUpperCase();
  if (trimmed.endsWith('CR')) return 'CR';
  if (trimmed.endsWith('DR')) return 'DR';
  return null;
}

/**
 * Determine if a raw amount string is a debit (has DR suffix or no suffix in debit column).
 */
function hasDebitSuffix(raw: string): boolean {
  return /\bDR\s*$/i.test(raw.trim());
}

function hasCreditSuffix(raw: string): boolean {
  return /\bCR\s*$/i.test(raw.trim());
}

// ─── Detection ───

export function isSBIStatement(text: string): boolean {
  const sample = text.substring(0, 5000);
  return (
    // Standard SBI header
    (sample.includes('State Bank of India') || sample.includes('STATE BANK OF INDIA')) &&
    (sample.includes('Txn Date') || sample.includes('TXN DATE') || sample.includes('Transaction Date'))
  ) || (
    // Alternative: IFSC starting with SBIN + typical SBI column headers
    /SBIN\d{7}/i.test(sample) &&
    (sample.includes('Ref/Cheque') || sample.includes('Ref No') || sample.includes('Cheque No'))
  ) || (
    // SBI branding with account statement context
    /\bSBI\b/i.test(sample) &&
    sample.includes('Account Statement') &&
    (sample.includes('Txn Date') || sample.includes('Value Date'))
  );
}

// ─── Main Parser ───

export async function parseSBIStatement(buffer: Buffer): Promise<ParsedStatementResult> {
  const data = await pdf(buffer);
  const fullText: string = data.text;
  const numPages = data.numpages || 1;

  const result: ParsedStatementResult = {
    parser: 'SBI_DETERMINISTIC',
    bankName: 'SBI',
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

  // ─── Extract header metadata ───

  // Account Number: look for "Account Number" or "A/C No" followed by digits
  const accMatch = fullText.match(/Account\s*(?:Number|No\.?)\s*:?\s*(\d{10,18})/i);
  if (accMatch) {
    result.accountNumber = accMatch[1]!;
  }

  // IFSC
  const ifscMatch = fullText.match(/IFSC\s*:?\s*(SBIN\d{7})/i);

  // Currency
  const currencyMatch = fullText.match(/Currency\s*:?\s*(INR|USD|EUR|GBP)/i);

  // ── Extract account metadata ──
  // IFSC: "IFSC : SBIN0005411" or from the text "SBIN0XXXXXX"
  if (ifscMatch) result.ifsc = ifscMatch[1]!.toUpperCase();

  // Customer Name: "Customer Name : XXXX" or similar
  const customerMatch = fullText.match(/Customer\s*Name\s*:?\s*(.+?)(?:\n|$)/i);
  if (customerMatch) {
    const candidate = customerMatch[1]!.trim();
    if (candidate.length >= 3 && candidate.length <= 150) {
      result.accountHolderName = candidate;
    }
  }

  // Branch Name
  const branchMatch = fullText.match(/Branch\s*(?:Name)?\s*:?\s*(.+?)(?:\n|$)/i);
  if (branchMatch) {
    const candidate = branchMatch[1]!.trim();
    // Avoid matching header lines like "Branch | Account Number"
    if (candidate.length >= 3 && !/account|number|txn/i.test(candidate)) {
      result.bankBranchName = candidate;
    }
  }

  // ─── Parse transaction rows ───

  // SBI row pattern: starts with a date DD-MM-YY
  const DATE_PATTERN = /^(\d{2}-\d{2}-\d{2,4})/;

  // We need to identify the table structure. SBI rows typically look like:
  // DD-MM-YY  DD-MM-YY  Description text  RefNo  Amount DR/CR  Amount DR/CR  Balance DR/CR
  //
  // In extracted PDF text, columns often merge. We need to parse carefully.
  // Strategy: Identify lines starting with a date, then extract fields.

  interface RawBlock {
    txnDateStr: string;
    valueDateStr: string | null;
    descriptionLines: string[];
    refChequeNo: string | null;
    debitRaw: string | null;
    creditRaw: string | null;
    balanceRaw: string | null;
    startLineIdx: number;
    rawLines: string[];
  }

  const blocks: RawBlock[] = [];
  let currentBlock: RawBlock | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;

    // Skip header/footer lines
    if (
      /^(page\s+\d|account\s*statement|state\s*bank\s*of\s*india|customer\s*name|branch|account\s*number|ifsc|available\s*balance|account\s*description|currency|txn\s*date|value\s*date|description\s+ref|opening\s*balance|closing\s*balance)/i.test(line)
    ) {
      continue;
    }

    // Check if line starts with a transaction date
    const dateMatch = line.match(DATE_PATTERN);
    if (dateMatch) {
      // Save previous block
      if (currentBlock) {
        blocks.push(currentBlock);
      }

      // Parse the rest of the line after the first date
      const afterFirstDate = line.substring(dateMatch[0].length).trim();

      // Try to find the value date (second date in the line)
      let valueDateStr: string | null = null;
      let remainder = afterFirstDate;

      const valueDateMatch = afterFirstDate.match(DATE_PATTERN);
      if (valueDateMatch) {
        valueDateStr = valueDateMatch[1]!;
        remainder = afterFirstDate.substring(valueDateMatch[0].length).trim();
      }

      // Now parse the remainder: Description ... RefNo ... Debit ... Credit ... Balance
      // Strategy: extract amounts from the right side, everything else is description + ref
      const parsed = parseRowFields(remainder);

      currentBlock = {
        txnDateStr: dateMatch[1]!,
        valueDateStr,
        descriptionLines: parsed.description ? [parsed.description] : [],
        refChequeNo: parsed.refNo,
        debitRaw: parsed.debit,
        creditRaw: parsed.credit,
        balanceRaw: parsed.balance,
        startLineIdx: i,
        rawLines: [line],
      };
    } else if (currentBlock) {
      // Continuation line (wrapped description or additional data)
      // Check if it contains amounts (could be amounts on a continuation line)
      const hasAmounts = /\d+\.\d{2}\s*(DR|CR)?/i.test(line);

      if (hasAmounts && !currentBlock.balanceRaw) {
        // This might be the amounts line for the current block
        const parsed = parseRowFields(line);
        if (parsed.balance) {
          currentBlock.balanceRaw = parsed.balance;
          if (parsed.debit) currentBlock.debitRaw = parsed.debit;
          if (parsed.credit) currentBlock.creditRaw = parsed.credit;
          if (parsed.refNo && !currentBlock.refChequeNo) currentBlock.refChequeNo = parsed.refNo;
          if (parsed.description) currentBlock.descriptionLines.push(parsed.description);
        } else {
          currentBlock.descriptionLines.push(line);
        }
      } else {
        // Pure description continuation
        currentBlock.descriptionLines.push(line);
      }
      currentBlock.rawLines.push(line);
    }
  }

  // Push last block
  if (currentBlock) {
    blocks.push(currentBlock);
  }

  // ─── Convert blocks to rows ───

  const pageSize = lines.length / numPages;

  for (let idx = 0; idx < blocks.length; idx++) {
    const block = blocks[idx]!;

    const transactionDate = parseSBIDate(block.txnDateStr);
    if (!transactionDate) {
      result.validation.warnings.push(
        `Row ${idx + 1}: Could not parse transaction date "${block.txnDateStr}"`
      );
      continue;
    }

    const valueDate = block.valueDateStr ? parseSBIDate(block.valueDateStr) : null;

    const narration = block.descriptionLines.join(' ').trim();
    const debitAmount = normalizeAmount(block.debitRaw);
    const creditAmount = normalizeAmount(block.creditRaw);
    const closingBalanceRaw = block.balanceRaw || '';
    const closingBalance = normalizeAmount(closingBalanceRaw);
    const balanceType = extractBalanceType(closingBalanceRaw);

    if (!closingBalance) {
      result.validation.warnings.push(
        `Row ${idx + 1} (${transactionDate}): Could not parse closing balance from "${closingBalanceRaw}"`
      );
      continue;
    }

    const estimatedPage = Math.ceil((block.startLineIdx + 1) / pageSize);

    result.rows.push({
      sourcePage: estimatedPage,
      sourceRow: idx + 1,
      transactionDate,
      valueDate,
      narration,
      referenceNo: block.refChequeNo || null,
      debitAmount,
      creditAmount,
      closingBalance,
      rawText: block.rawLines.join('\n'),
    });
  }

  // ─── Calculate summary values ───

  if (result.rows.length > 0) {
    const firstRow = result.rows[0]!;
    const lastRow = result.rows[result.rows.length - 1]!;

    // Opening balance: derived from first row
    if (firstRow.creditAmount) {
      result.openingBalance = (
        parseFloat(firstRow.closingBalance) - parseFloat(firstRow.creditAmount)
      ).toFixed(2);
    } else if (firstRow.debitAmount) {
      result.openingBalance = (
        parseFloat(firstRow.closingBalance) + parseFloat(firstRow.debitAmount)
      ).toFixed(2);
    }

    // Closing balance: last row's balance
    result.closingBalance = lastRow.closingBalance;

    // Statement dates from first/last transaction
    result.statementFromDate = firstRow.transactionDate;
    result.statementToDate = lastRow.transactionDate;
  }

  // Counts and totals
  const debitRows = result.rows.filter(r => r.debitAmount !== null);
  const creditRows = result.rows.filter(r => r.creditAmount !== null);
  result.debitCount = debitRows.length;
  result.creditCount = creditRows.length;
  result.totalDebit = debitRows
    .reduce((sum, r) => sum + parseFloat(r.debitAmount!), 0)
    .toFixed(2);
  result.totalCredit = creditRows
    .reduce((sum, r) => sum + parseFloat(r.creditAmount!), 0)
    .toFixed(2);

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

  // ─── Validate ───
  validateSBIStatement(result);

  return result;
}

// ─── Field extraction ───

interface ParsedFields {
  description: string;
  refNo: string | null;
  debit: string | null;
  credit: string | null;
  balance: string | null;
}

/**
 * Parse the remainder of a row line to extract description, ref no, and amounts.
 *
 * SBI rows look like (after dates are removed):
 *   "NEFT CR-SBIN0005411-JAY... 000000  -  164211.00 CR  171191.04 CR"
 *   "INB Transfer  972969  118.00 DR  -  171073.04 CR"
 *
 * Strategy: Extract amounts + balance from the right side using regex,
 * then split the left side into description + ref number.
 */
function parseRowFields(text: string): ParsedFields {
  const result: ParsedFields = {
    description: '',
    refNo: null,
    debit: null,
    credit: null,
    balance: null,
  };

  if (!text.trim()) return result;

  // Pattern to find amount values: digits with optional commas, decimal point, optional DR/CR
  // We expect up to 3 amounts at the end: debit, credit, balance
  // "-" can substitute for debit or credit
  const amountPattern = /(?:[\d,]+\.\d{2}\s*(?:DR|CR)?|-)/g;

  // Find all amount-like tokens
  const amounts: { value: string; index: number; length: number }[] = [];
  let m;
  while ((m = amountPattern.exec(text)) !== null) {
    amounts.push({ value: m[0], index: m.index, length: m[0].length });
  }

  if (amounts.length === 0) {
    result.description = text.trim();
    return result;
  }

  // We expect the last 3 tokens to be: debit, credit, balance
  // But there could be amounts embedded in descriptions too.
  // Take the last 3 amount-like tokens.
  if (amounts.length >= 3) {
    const debitToken = amounts[amounts.length - 3]!;
    const creditToken = amounts[amounts.length - 2]!;
    const balanceToken = amounts[amounts.length - 1]!;

    result.debit = debitToken.value === '-' ? null : debitToken.value;
    result.credit = creditToken.value === '-' ? null : creditToken.value;
    result.balance = balanceToken.value === '-' ? null : balanceToken.value;

    // Everything before the first of these 3 amounts is description + ref
    const textBefore = text.substring(0, debitToken.index).trim();
    extractDescriptionAndRef(textBefore, result);
  } else if (amounts.length === 2) {
    // Could be: amount + balance (debit or credit is "-")
    const amountToken = amounts[amounts.length - 2]!;
    const balanceToken = amounts[amounts.length - 1]!;

    result.balance = balanceToken.value === '-' ? null : balanceToken.value;

    if (amountToken.value !== '-') {
      if (hasDebitSuffix(amountToken.value)) {
        result.debit = amountToken.value;
      } else if (hasCreditSuffix(amountToken.value)) {
        result.credit = amountToken.value;
      } else {
        // Ambiguous, store as debit by default (will be corrected by balance chain)
        result.debit = amountToken.value;
      }
    }

    const textBefore = text.substring(0, amountToken.index).trim();
    extractDescriptionAndRef(textBefore, result);
  } else if (amounts.length === 1) {
    // Only balance
    const balanceToken = amounts[0]!;
    result.balance = balanceToken.value === '-' ? null : balanceToken.value;
    const textBefore = text.substring(0, balanceToken.index).trim();
    extractDescriptionAndRef(textBefore, result);
  }

  return result;
}

/**
 * Split text into description and reference number.
 * The ref number is typically the last "word" that looks like a number or alphanumeric code.
 */
function extractDescriptionAndRef(text: string, result: ParsedFields): void {
  if (!text.trim()) return;

  // Common SBI ref patterns: "000000", "972969", alphanumeric codes
  // The ref number is usually the last space-separated token before amounts
  const parts = text.trim().split(/\s+/);

  if (parts.length === 0) return;

  // Check if the last token looks like a reference number (all digits, or alphanumeric code)
  const lastToken = parts[parts.length - 1]!;
  if (/^\d{3,}$/.test(lastToken) || /^[A-Z0-9]{6,}$/i.test(lastToken)) {
    result.refNo = lastToken;
    result.description = parts.slice(0, -1).join(' ').trim();
  } else {
    result.description = text.trim();
  }
}

// ─── Validation ───

function validateSBIStatement(result: ParsedStatementResult): void {
  const errors: string[] = [];
  const warnings: string[] = [...result.validation.warnings];

  if (result.rows.length === 0) {
    errors.push('No transaction rows were parsed from the SBI statement.');
    result.validation = { isValid: false, errors, warnings };
    return;
  }

  // 1. Every row must have date and balance
  for (const row of result.rows) {
    if (!row.transactionDate) {
      errors.push(`Row ${row.sourceRow}: Missing transaction date.`);
    }
    if (!row.closingBalance) {
      errors.push(`Row ${row.sourceRow}: Missing closing balance.`);
    }
    if (row.debitAmount && row.creditAmount) {
      errors.push(`Row ${row.sourceRow}: Has both debit and credit amounts.`);
    }
    if (!row.debitAmount && !row.creditAmount) {
      errors.push(`Row ${row.sourceRow}: Missing both debit and credit amounts.`);
    }
  }

  // 2. Validate balance chain
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

  // 3. Every row should have either debit or credit
  for (const row of result.rows) {
    if (row.debitAmount === null && row.creditAmount === null) {
      errors.push(
        `Row ${row.sourceRow} (${row.transactionDate}): Neither debit nor credit amount found.`
      );
    }
  }

  // 4. Validate opening + credits - debits = closing
  if (result.openingBalance !== null && result.closingBalance !== null &&
      result.totalDebit !== null && result.totalCredit !== null) {
    const expectedClosing =
      parseFloat(result.openingBalance) +
      parseFloat(result.totalCredit) -
      parseFloat(result.totalDebit);
    const actualClosing = parseFloat(result.closingBalance);

    if (Math.abs(expectedClosing - actualClosing) > 0.01) {
      warnings.push(
        `Balance equation mismatch: Opening (${result.openingBalance}) + Credits (${result.totalCredit}) - Debits (${result.totalDebit}) = ${expectedClosing.toFixed(2)}, but closing balance is ${result.closingBalance}.`
      );
    }
  }

  // 5. Validate date conversions
  for (const row of result.rows) {
    if (row.transactionDate && !/^\d{4}-\d{2}-\d{2}$/.test(row.transactionDate)) {
      errors.push(
        `Row ${row.sourceRow}: Transaction date "${row.transactionDate}" is not in YYYY-MM-DD format.`
      );
    }
    if (row.valueDate && !/^\d{4}-\d{2}-\d{2}$/.test(row.valueDate)) {
      errors.push(
        `Row ${row.sourceRow}: Value date "${row.valueDate}" is not in YYYY-MM-DD format.`
      );
    }
  }

  result.validation = {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
