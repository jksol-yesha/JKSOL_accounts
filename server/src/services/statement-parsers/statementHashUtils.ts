/**
 * Hash utilities for bank statement import deduplication.
 * 
 * Three layers of idempotency:
 * 1. fileHash - SHA-256 of raw file bytes (exact file dedup)
 * 2. statementFingerprint - SHA-256 of normalized statement metadata (same statement, different file)
 * 3. bankTransactionKey - SHA-256 of deterministic row identity (per-row dedup)
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
 */
export function generateStatementFingerprint(params: {
  bankName: string;
  accountNumber: string;
  statementFromDate: string;
  statementToDate: string;
  openingBalance: string;
  closingBalance: string;
  debitCount: number;
  creditCount: number;
  totalDebit: string;
  totalCredit: string;
}): string {
  const input = [
    params.bankName,
    params.accountNumber,
    params.statementFromDate,
    params.statementToDate,
    params.openingBalance,
    params.closingBalance,
    String(params.debitCount),
    String(params.creditCount),
    params.totalDebit,
    params.totalCredit,
  ].join('|');

  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Layer 3: Generate deterministic row identity for a bank transaction.
 * Does NOT use narration/notes/description to avoid OpenAI interpretation variance.
 * 
 * Uses: orgId + accountId + bankName + accountNumber + txnDate + valueDate + debitOrCredit + amount + closingBalance + referenceNo
 */
export function generateBankTransactionKey(params: {
  organizationId: number;
  accountId: number;
  bankName: string;
  accountNumber: string;
  transactionDate: string;
  valueDate: string | null;
  debitOrCredit: 'DEBIT' | 'CREDIT';
  amount: string;
  closingBalance: string;
  referenceNo: string | null;
}): string {
  const input = [
    String(params.organizationId),
    String(params.accountId),
    params.bankName,
    params.accountNumber,
    params.transactionDate,
    params.valueDate || '',
    params.debitOrCredit,
    params.amount,
    params.closingBalance,
    params.referenceNo || '',
  ].join('|');

  return crypto.createHash('sha256').update(input).digest('hex');
}
