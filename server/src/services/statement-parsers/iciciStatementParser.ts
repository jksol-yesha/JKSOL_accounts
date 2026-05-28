/**
 * Deterministic ICICI Bank Statement PDF Parser.
 *
 * ICICI statements have a tabular structure with columns:
 *   S No. | Transaction Date | Cheque Number | Transaction Remarks |
 *   Withdrawal Amount (INR) | Deposit Amount (INR) | Balance (INR)
 *
 * In the extracted PDF text, each transaction block starts with a line like:
 *   <serialNo><DD.MM.YYYY>
 * e.g. "101.01.2026" means S.No=1, Date=01.01.2026
 *      "1216.01.2026" means S.No=12, Date=16.01.2026
 *
 * The narration follows on subsequent lines, and the last narration line
 * typically ends with the amount(s) and balance concatenated without spaces.
 */

if (typeof (globalThis as any).DOMMatrix === 'undefined') {
  (globalThis as any).DOMMatrix = class DOMMatrix {} as any;
}

// @ts-ignore
import pdf from 'pdf-parse/lib/pdf-parse.js';
import type { ParsedStatementResult, ParsedStatementRow } from './types';

// ─── Helpers ───

function normalizeAmount(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const cleaned = raw.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  // Ensure two decimal places
  if (!cleaned.includes('.')) return cleaned + '.00';
  const parts = cleaned.split('.');
  return parts[0] + '.' + parts[1]!.padEnd(2, '0');
}

/**
 * Parse ICICI date format DD.MM.YYYY to YYYY-MM-DD.
 */
function parseICICIDate(dateStr: string): string | null {
  const parts = dateStr.trim().split('.');
  if (parts.length === 3 && parts[0]!.length === 2 && parts[1]!.length === 2 && parts[2]!.length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return null;
}

/**
 * Parse ICICI month name date format "January 1, 2026" to YYYY-MM-DD.
 */
function parseICICIHeaderDate(dateStr: string): string | null {
  const months: Record<string, string> = {
    january: '01', february: '02', march: '03', april: '04',
    may: '05', june: '06', july: '07', august: '08',
    september: '09', october: '10', november: '11', december: '12',
  };
  const match = dateStr.trim().match(/^(\w+)\s+(\d{1,2}),?\s+(\d{4})$/i);
  if (!match) return null;
  const monthNum = months[match[1]!.toLowerCase()];
  if (!monthNum) return null;
  const day = match[2]!.padStart(2, '0');
  return `${match[3]}-${monthNum}-${day}`;
}

type TrailingAmountFields = {
  narration: string;
  amount: string | null;
  closingBalance: string | null;
  ambiguousAmountToken: string | null;
  ambiguousNarrationPrefix: string | null;
};

function isAmountLikeToken(value: string): boolean {
  return /^[\d,]+\.\d{2}$/i.test(String(value || '').trim());
}

function splitTokenByAmountSuffix(rawToken: string, amount: string): { prefix: string, suffix: string } | null {
  const token = String(rawToken || '');
  const normalizedToken = token.replace(/,/g, '');
  const normalizedAmount = String(amount || '').replace(/,/g, '');

  if (!normalizedToken || !normalizedAmount || !normalizedToken.endsWith(normalizedAmount)) {
    return null;
  }

  let remaining = normalizedAmount.length;
  let splitIndex = token.length;

  for (let i = token.length - 1; i >= 0; i--) {
    if (token[i] !== ',') {
      remaining -= 1;
    }
    if (remaining === 0) {
      splitIndex = i;
      break;
    }
  }

  return {
    prefix: token.slice(0, splitIndex),
    suffix: token.slice(splitIndex),
  };
}

function restoreNarrationFromAmbiguousToken(row: ParsedStatementRow, amount: string | null): void {
  if (!amount) return;

  const ambiguousToken = (row as any)._ambiguousAmountToken as string | undefined;
  if (!ambiguousToken) return;

  const split = splitTokenByAmountSuffix(ambiguousToken, amount);
  if (!split) return;

  const narrationPrefix = String((row as any)._ambiguousNarrationPrefix || '').trim();
  row.narration = [narrationPrefix, split.prefix.trim()].filter(Boolean).join(' ').trim();
}

function extractICICITrailingFields(combinedText: string): TrailingAmountFields {
  const workingText = String(combinedText || '')
    .trim()
    .replace(/\s+(?:CR|DR)$/i, '')
    .trim();

  const fallback: TrailingAmountFields = {
    narration: workingText,
    amount: null,
    closingBalance: null,
    ambiguousAmountToken: null,
    ambiguousNarrationPrefix: null,
  };

  if (!workingText) return fallback;

  const amountPattern = /[\d,]+\.\d{2}/g;
  const amountMatches = Array.from(workingText.matchAll(amountPattern));
  if (amountMatches.length === 0) return fallback;

  const balanceMatch = amountMatches[amountMatches.length - 1]!;
  const rawBalance = balanceMatch[0]!;
  const closingBalance = normalizeAmount(rawBalance);
  if (!closingBalance || balanceMatch.index == null) {
    return fallback;
  }

  const beforeBalance = workingText.slice(0, balanceMatch.index).trimEnd();
  if (!beforeBalance) {
    return {
      ...fallback,
      narration: '',
      closingBalance,
    };
  }

  const tokens = beforeBalance.split(/\s+/).filter(Boolean);
  const lastToken = tokens[tokens.length - 1] || '';
  const lastTokenPrefix = tokens.slice(0, -1).join(' ').trim();

  if (lastToken && isAmountLikeToken(lastToken) && lastToken.replace(/,/g, '').length < 15) {
    return {
      narration: lastTokenPrefix,
      amount: normalizeAmount(lastToken),
      closingBalance,
      ambiguousAmountToken: null,
      ambiguousNarrationPrefix: null,
    };
  }

  const fusedRemarkAmountMatch = lastToken.match(/^(.+?)([\d,]+\.\d{2})$/);
  if (fusedRemarkAmountMatch) {
    const candidateAmount = fusedRemarkAmountMatch[2]!;

    if (candidateAmount.replace(/,/g, '').length < 15) {
      return {
        narration: [lastTokenPrefix, fusedRemarkAmountMatch[1]!.trim()].filter(Boolean).join(' ').trim(),
        amount: normalizeAmount(candidateAmount),
        closingBalance,
        ambiguousAmountToken: null,
        ambiguousNarrationPrefix: null,
      };
    }
  }

  return {
    narration: beforeBalance,
    amount: null,
    closingBalance,
    ambiguousAmountToken: lastToken || null,
    ambiguousNarrationPrefix: lastTokenPrefix || null,
  };
}

// ─── Detection ───

export function isICICIStatement(text: string): boolean {
  return (
    text.includes('Statement of Transactions in Saving Account') ||
    text.includes('Statement of Transactions in Current Account') ||
    (text.includes('ICICI Bank') && text.includes('S No.') && text.includes('Transaction Remarks'))
  );
}

// ─── Main Parser ───

export async function parseICICIStatement(buffer: Buffer): Promise<ParsedStatementResult> {
  const data = await pdf(buffer);
  const fullText: string = data.text;
  const numPages = data.numpages || 1;

  const result: ParsedStatementResult = {
    parser: 'ICICI_DETERMINISTIC',
    bankName: 'ICICI',
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

  // Account number and period from header like:
  // "Statement of Transactions in Saving Account no. 019301522041 in INR for the period January 1, 2026 - January 31, 2026"
  const headerMatch = fullText.match(
    /Statement of Transactions in (?:Saving|Current) Account no\.\s*(\d+)\s*in\s*\w+\s*for the period\s*(.+?)\s*-\s*(.+?)(?:\n|$)/i
  );
  if (headerMatch) {
    result.accountNumber = headerMatch[1]!;
    result.statementFromDate = parseICICIHeaderDate(headerMatch[2]!.trim());
    result.statementToDate = parseICICIHeaderDate(headerMatch[3]!.trim());
  }

  // ── Extract account metadata ──
  // Branch: "BRANCH, TRINITY BUSINESS PARKG -2, L P" or "BRANCH,  SARTHANA CHOKDI"
  const branchMatch = fullText.match(/^BRANCH,\s*(.+?)(?:\n|$)/im);
  if (branchMatch) {
    const branchName = branchMatch[1]!.replace(/\s+/g, ' ').trim();
    if (branchName.length >= 3) result.bankBranchName = branchName;
  }

  // Account Holder: The name typically appears a few lines after branch address
  // Pattern: appears as standalone line with uppercase name after address block
  const nameBlock = fullText.match(/BRANCH[^\n]+\n[^\n]+\n\s*\d{6}\s*\n\s*([A-Z][A-Z\s]+?)\s*\n/m);
  if (nameBlock) {
    const candidate = nameBlock[1]!.trim();
    if (candidate.split(/\s+/).length >= 2 && candidate.length <= 150) {
      result.accountHolderName = candidate;
    }
  }

  // IFSC (if present): "IFSC: ICIC0001234"
  const ifscMatch = fullText.match(/IFSC\s*:?\s*([A-Z]{4}0[A-Z0-9]{6})/i);
  if (ifscMatch) result.ifsc = ifscMatch[1]!.toUpperCase();

  // Customer ID (if present)
  const custMatch = fullText.match(/Customer\s*(?:Id|ID)\s*:?\s*(\d+)/i);
  if (custMatch) result.customerId = custMatch[1]!;

  // ─── Parse transaction rows ───

  // ICICI rows in extracted text start with a line matching:
  //   <serialNo><DD.MM.YYYY><rest> OR just <DD.MM.YYYY><rest>
  // where serialNo is 1+ digits immediately followed by DD.MM.YYYY
  // e.g., "101.01.2026" => serialNo=1, date=01.01.2026
  //       "16.01.2026"  => no serialNo, date=16.01.2026

  // The pattern: optional serialNo (1+ digits) then DD.MM.YYYY
  const ROW_START = /^(?:(\d+)\s*)?(\d{2}\.\d{2}\.\d{4})(.*)$/;

  interface RawBlock {
    serialNo: number;
    dateStr: string;     // DD.MM.YYYY
    textLines: string[]; // all lines including first line remainder
    startLineIdx: number;
  }

  const blocks: RawBlock[] = [];
  let currentBlock: RawBlock | null = null;

  // Skip header lines until we find the first row
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;

    // Stop at footer/legend content
    if (line.startsWith('BRANCH,') || line.startsWith('Statement of Transactions') ||
        line.startsWith('Sincerly') || line.startsWith('Your Base Branch') ||
        line.startsWith('Never share') || line.includes('Legends for transactions') ||
        line.startsWith('RCHG -') || line.startsWith('DTAX -') ||
        line.startsWith('BPAY -') || line.startsWith('IDTX -')) {
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = null;
      continue;
    }

    const rowMatch = line.match(ROW_START);
    if (rowMatch) {
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = {
        serialNo: rowMatch[1] ? parseInt(rowMatch[1], 10) : (blocks.length + 1),
        dateStr: rowMatch[2]!,
        textLines: [rowMatch[3] || ''],
        startLineIdx: i,
      };
    } else if (currentBlock) {
      currentBlock.textLines.push(line);
    }
  }
  if (currentBlock) blocks.push(currentBlock);

  // ─── Parse each block into a row ───

  const pageSize = lines.length / numPages;

  for (const block of blocks) {
    const transactionDate = parseICICIDate(block.dateStr);
    if (!transactionDate) {
      result.validation.warnings.push(
        `Row S.No ${block.serialNo}: Could not parse date "${block.dateStr}"`
      );
      continue;
    }

    // Combine all text lines for this block
    let combinedText = block.textLines.join(' ').trim();
    // 7. Repair split balance decimal handling: merge split decimals
    combinedText = combinedText.replace(/(\d+\.\d)\s+(\d)$/, '$1$2').replace(/(\d+\.)\s+(\d{1,2})$/, '$1$2');

    const extractedFields = extractICICITrailingFields(combinedText);
    const narration = extractedFields.narration;
    const closingBalance = extractedFields.closingBalance;
    const amount1 = extractedFields.amount;

    if (!closingBalance || !narration) {
      result.validation.warnings.push(
        `Row S.No ${block.serialNo}: Could not extract valid non-fused amounts from end of text: "${combinedText.slice(-60)}"`
      );
      continue;
    }

    const estimatedPage = Math.ceil((block.startLineIdx + 1) / pageSize);

    result.rows.push({
      sourcePage: estimatedPage,
      sourceRow: block.serialNo,
      serialNo: block.serialNo,
      transactionDate,
      valueDate: null, // ICICI doesn't have a separate value date column
      narration,
      chequeNumber: null, // Will be extracted below if present
      referenceNo: null, // Will attempt extraction from narration
      debitAmount: null, // Will be classified below
      creditAmount: null,
      closingBalance: closingBalance!,
      rawText: [block.dateStr, ...block.textLines].join('\n'),
    });

    const currentRow = result.rows[result.rows.length - 1] as ParsedStatementRow & Record<string, any>;

    // Store temporary amount for balance-chain classification
    currentRow._tempAmount = amount1;
    currentRow._ambiguousAmountToken = extractedFields.ambiguousAmountToken;
    currentRow._ambiguousNarrationPrefix = extractedFields.ambiguousNarrationPrefix;

    if (!amount1) {
      result.validation.warnings.push(
        `Row S.No ${block.serialNo}: Could not isolate transaction amount cleanly; will infer from balance chain if possible.`
      );
    }
  }

  // ─── Classify debit vs credit using balance chain ───
  classifyDebitsCredits(result);

  // ─── Extract cheque numbers and reference numbers from narration ───
  for (const row of result.rows) {
    extractICICIReferences(row);
  }

  // ─── Calculate summary values ───

  // Opening balance: derived from first row
  if (result.rows.length > 0) {
    const firstRow = result.rows[0]!;
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
    result.closingBalance = result.rows[result.rows.length - 1]!.closingBalance;
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
  validateICICIStatement(result);

  return result;
}

// ─── Internal helpers ───

/**
 * Classify each row as debit or credit using balance chain logic.
 * Since ICICI concatenates the amount and balance without column separation,
 * we use the running balance to determine direction.
 */
function classifyDebitsCredits(result: ParsedStatementResult): void {
  if (result.rows.length === 0) return;

  // We need to determine debit/credit for each row.
  // Strategy: Use balance changes between consecutive rows.
  // If balance decreased, it's a debit (withdrawal).
  // If balance increased, it's a credit (deposit).

  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows[i]!;
    const tempAmount = (row as any)._tempAmount as string | null | undefined;
    let amount = normalizeAmount(tempAmount);

    let prevBalance: number;
    if (i === 0) {
      if (!amount) {
        delete (row as any)._tempAmount;
        continue;
      }

      // For the first row, we don't have a previous balance.
      // We can infer: if balance = prevBal - amount => debit, if balance = prevBal + amount => credit
      // Try both and see which one gives a consistent chain.
      // Method: check if amount + balance or balance - amount gives a round-ish opening balance
      const bal = parseFloat(row.closingBalance);
      const amt = parseFloat(amount);

      // If it's a credit: openingBalance = balance - amount
      const asCredit = bal - amt;
      // If it's a debit: openingBalance = balance + amount
      const asDebit = bal + amt;

      // Look at the second row to validate
      if (result.rows.length > 1) {
        const nextRow = result.rows[1]!;
        const nextAmt = parseFloat((nextRow as any)._tempAmount);
        const nextBal = parseFloat(nextRow.closingBalance);

        // Try: first is credit => opening = bal - amt
        const tryDebitNext = asCredit - nextAmt;
        const tryCreditNext = asCredit + nextAmt;

        if (Math.abs(tryDebitNext - nextBal) < 0.01) {
          // First is credit, second is debit
          row.creditAmount = amount;
        } else if (Math.abs(tryCreditNext - nextBal) < 0.01) {
          // First is credit, second is credit
          row.creditAmount = amount;
        } else {
          // Try: first is debit => opening = bal + amt
          const tryDebitNext2 = asDebit - nextAmt;
          const tryCreditNext2 = asDebit + nextAmt;
          if (Math.abs(tryDebitNext2 - nextBal) < 0.01 || Math.abs(tryCreditNext2 - nextBal) < 0.01) {
            row.debitAmount = amount;
          } else {
            // Default: use balance comparison with next
            if (nextBal < bal) {
              row.creditAmount = amount;
            } else {
              row.debitAmount = amount;
            }
          }
        }
      } else {
        // Single row, can't determine. Use a heuristic.
        row.creditAmount = amount;
      }

      // Clean up temp
      delete (row as any)._tempAmount;
      continue;
    }

    // For subsequent rows, use previous row's closing balance
    prevBalance = parseFloat(result.rows[i - 1]!.closingBalance);
    const currentBalance = parseFloat(row.closingBalance);
    const balanceDelta = Math.abs(prevBalance - currentBalance);
    const derivedAmount = balanceDelta > 0.009
      ? normalizeAmount(balanceDelta.toFixed(2))
      : null;

    if (!amount && derivedAmount) {
      amount = derivedAmount;
      restoreNarrationFromAmbiguousToken(row, amount);
    }

    if (!amount) {
      delete (row as any)._tempAmount;
      continue;
    }

    let amt = parseFloat(amount);

    // Check: prevBalance - amt ≈ currentBalance => debit
    // Check: prevBalance + amt ≈ currentBalance => credit
    if (Math.abs(prevBalance - amt - currentBalance) < 0.01) {
      row.debitAmount = amount;
    } else if (Math.abs(prevBalance + amt - currentBalance) < 0.01) {
      row.creditAmount = amount;
    } else if (derivedAmount) {
      amount = derivedAmount;
      amt = parseFloat(amount);
      restoreNarrationFromAmbiguousToken(row, amount);

      if (Math.abs(prevBalance - amt - currentBalance) < 0.01) {
        row.debitAmount = amount;
      } else if (Math.abs(prevBalance + amt - currentBalance) < 0.01) {
        row.creditAmount = amount;
      } else if (currentBalance < prevBalance) {
        row.debitAmount = amount;
      } else {
        row.creditAmount = amount;
      }
    } else {
      // Fallback: if balance decreased, it's a debit
      if (currentBalance < prevBalance) {
        row.debitAmount = amount;
      } else {
        row.creditAmount = amount;
      }
      result.validation.warnings.push(
        `Row S.No ${row.sourceRow}: Balance chain discrepancy. Prev: ${prevBalance.toFixed(2)}, Amount: ${amount}, Current: ${currentBalance}. Classified by direction.`
      );
    }

    delete (row as any)._tempAmount;
  }
}

/**
 * Extract cheque numbers and reference identifiers from ICICI narration text.
 */
function extractICICIReferences(row: ParsedStatementRow): void {
  const narration = row.narration;

  // NEFT references: "NEFT-HDFCH00707093773-..." or "NEFT-CITIN26606207419-..."
  const neftMatch = narration.match(/NEFT[/-]([A-Z0-9]+)/i);
  // IMPS references: "MMT/IMPS/600609028784/..."
  const impsMatch = narration.match(/IMPS\/(\d{12})/i);
  // BIL/NEFT with transaction ID: "BIL/NEFT/IN12600116342024/..."
  const bilNeftMatch = narration.match(/BIL\/NEFT\/([A-Z0-9]+)\//i);
  // BIL/INFT: "BIL/INFT/FAZ7146560/..."
  const bilInftMatch = narration.match(/BIL\/INFT\/([A-Z0-9]+)\//i);
  // GIB reference: "GIB/002056736337/..."
  const gibMatch = narration.match(/GIB\/(\d+)\//i);
  // CMS reference: "CMS/ 19732289/..."
  const cmsMatch = narration.match(/CMS\/\s*(\d+)\//i);

  if (neftMatch) row.referenceNo = neftMatch[1]!;
  else if (impsMatch) row.referenceNo = impsMatch[1]!;
  else if (bilNeftMatch) row.referenceNo = bilNeftMatch[1]!;
  else if (bilInftMatch) row.referenceNo = bilInftMatch[1]!;
  else if (gibMatch) row.referenceNo = gibMatch[1]!;
  else if (cmsMatch) row.referenceNo = cmsMatch[1]!;

  // Cheque number: ICICI statements may include cheque numbers embedded in narration
  // For electronic transactions, chequeNumber stays null
  row.chequeNumber = null;
}

/**
 * Validate the parsed ICICI statement.
 */
function validateICICIStatement(result: ParsedStatementResult): void {
  const errors: string[] = [];
  const warnings: string[] = [...result.validation.warnings];

  if (result.rows.length === 0) {
    errors.push('No transaction rows were parsed from the ICICI statement.');
    result.validation = { isValid: false, errors, warnings };
    return;
  }

  // 1. Check serial number continuity
  const serialNos = result.rows.map(r => r.serialNo).filter(s => s != null) as number[];
  if (serialNos.length === result.rows.length) {
    for (let i = 0; i < serialNos.length; i++) {
      if (serialNos[i] !== i + 1) {
        warnings.push(
          `Serial number discontinuity: expected ${i + 1}, got ${serialNos[i]} at row index ${i}.`
        );
        break;
      }
    }
  }

  // 2. Check every row has date and balance
  for (const row of result.rows) {
    if (!row.transactionDate) {
      errors.push(`Row S.No ${row.sourceRow}: Missing transaction date.`);
    }
    if (!row.closingBalance) {
      errors.push(`Row S.No ${row.sourceRow}: Missing closing balance.`);
    }
    if (row.debitAmount && row.creditAmount) {
      errors.push(`Row S.No ${row.sourceRow}: Has both debit and credit amounts.`);
    }
    if (!row.debitAmount && !row.creditAmount) {
      errors.push(`Row S.No ${row.sourceRow}: Missing both debit and credit amounts.`);
    }
  }

  // 3. Validate balance chain
  if (result.openingBalance !== null) {
    let prevBal = parseFloat(result.openingBalance);
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows[i]!;
      const debit = row.debitAmount ? parseFloat(row.debitAmount) : 0;
      const credit = row.creditAmount ? parseFloat(row.creditAmount) : 0;
      const expectedBal = prevBal - debit + credit;
      const actualBal = parseFloat(row.closingBalance);

      if (Math.abs(expectedBal - actualBal) > 0.01) {
        errors.push(
          `Row S.No ${row.sourceRow} (${row.transactionDate}): Balance chain broken. Expected ${expectedBal.toFixed(2)} but got ${actualBal.toFixed(2)}.`
        );
      }
      prevBal = actualBal;
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
      errors.push(
        `Balance equation mismatch: Opening (${result.openingBalance}) + Credits (${result.totalCredit}) - Debits (${result.totalDebit}) = ${expectedClosing.toFixed(2)}, but closing balance is ${result.closingBalance}.`
      );
    }
  }

  result.validation = {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export const __test__ = {
  extractICICITrailingFields,
  classifyDebitsCredits,
};
