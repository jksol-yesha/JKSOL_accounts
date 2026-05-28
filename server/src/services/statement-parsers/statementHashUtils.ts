/**
 * Hash utilities for bank statement import deduplication.
 * 
 * Four layers of idempotency:
 * 1. fileHash - SHA-256 of raw file bytes (exact file dedup)
 * 2. statementFingerprint - SHA-256 of normalized statement metadata (same statement, different file)
 * 3. bankTransactionKey - SHA-256 of deterministic row identity with referenceNo (per-row dedup)
 * 4. sourceRowSignature - SHA-256 of stable row fields without referenceNo (OpenAI fallback dedup)
 */

import crypto from 'crypto';

/**
 * Layer 1: Generate SHA-256 hash from raw file bytes.
 * Prevents the exact same PDF from being processed twice.
 */
export function generateFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Layer 2: Generate statement-level fingerprint from normalized metadata.
 * Prevents the same statement period from being imported even if the PDF is regenerated/renamed.
 * Returns null if insufficient metadata is available.
 */
export function generateStatementFingerprint(params: {
  bankName?: string | null;
  accountNumber?: string | null;
  statementFromDate?: string | null;
  statementToDate?: string | null;
  openingBalance?: string | null;
  closingBalance?: string | null;
  totalDebit?: string | null;
  totalCredit?: string | null;
  debitCount?: number | null;
  creditCount?: number | null;
}): string | null {
  // Need at least bankName + accountNumber + date range + balances for a meaningful fingerprint
  if (!params.bankName || !params.accountNumber || !params.statementFromDate || !params.statementToDate ||
      !params.openingBalance || !params.closingBalance) {
    return null;
  }

  const input = [
    (params.bankName || '').toUpperCase().trim(),
    (params.accountNumber || '').trim(),
    (params.statementFromDate || '').trim(),
    (params.statementToDate || '').trim(),
    normalizeAmount(params.openingBalance || '0'),
    normalizeAmount(params.closingBalance || '0'),
    String(params.debitCount ?? ''),
    String(params.creditCount ?? ''),
    normalizeAmount(params.totalDebit || ''),
    normalizeAmount(params.totalCredit || ''),
  ].join('|');

  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Layer 3: Generate deterministic row identity for a bank transaction.
 * Does NOT use narration/notes/description to avoid OpenAI interpretation variance.
 * Includes referenceNo for maximum specificity where available.
 * 
 * Uses: orgId + accountId + bankName + accountNumber + txnDate + valueDate + debitOrCredit + amount + closingBalance + referenceNo
 */
export function generateBankTransactionKey(params: {
  organizationId: number | string;
  accountId: number | string;
  bankName?: string | null;
  accountNumber?: string | null;
  transactionDate: string;
  valueDate?: string | null;
  debitOrCredit: 'DEBIT' | 'CREDIT';
  amount: string;
  closingBalance?: string | null;
  referenceNo?: string | null;
}): string {
  const input = [
    String(params.organizationId),
    String(params.accountId),
    (params.bankName || '').toUpperCase().trim(),
    (params.accountNumber || '').trim(),
    (params.transactionDate || '').trim(),
    (params.valueDate || '').trim(),
    params.debitOrCredit,
    normalizeAmount(params.amount),
    normalizeAmount(params.closingBalance || ''),
    (params.referenceNo || '').trim(),
  ].join('|');

  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Layer 4: Generate stable row signature without referenceNo.
 * Used as fallback dedup for OpenAI rows and rows without reference numbers.
 * Includes sourcePage/sourceRow for positional stability.
 * 
 * Uses: orgId + accountId + bankName + accountNumber + txnDate + debitOrCredit + amount + closingBalance + sourcePage + sourceRow
 */
export function generateSourceRowSignature(params: {
  organizationId: number | string;
  accountId: number | string;
  bankName?: string | null;
  accountNumber?: string | null;
  transactionDate: string;
  valueDate?: string | null;
  debitOrCredit: 'DEBIT' | 'CREDIT';
  amount: string;
  closingBalance?: string | null;
  sourcePage?: number | null;
  sourceRow?: number | null;
}): string {
  const input = [
    String(params.organizationId),
    String(params.accountId),
    (params.bankName || '').toUpperCase().trim(),
    (params.accountNumber || '').trim(),
    (params.transactionDate || '').trim(),
    (params.valueDate || '').trim(),
    params.debitOrCredit,
    normalizeAmount(params.amount),
    normalizeAmount(params.closingBalance || ''),
    String(params.sourcePage ?? ''),
    String(params.sourceRow ?? ''),
  ].join('|');

  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Normalize an amount string for consistent hashing.
 * Removes commas, trims whitespace, parses to fixed 2 decimal places.
 */
function normalizeAmount(amount: string): string {
  if (!amount || amount.trim() === '') return '';
  const cleaned = amount.replace(/,/g, '').trim();
  const num = Number(cleaned);
  if (isNaN(num)) return cleaned;
  return num.toFixed(2);
}
