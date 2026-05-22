/**
 * Statement Import Orchestrator Service.
 *
 * This service coordinates the multi-layered deduplication pipeline:
 * 1. File hash check (exact PDF reupload)
 * 2. Bank detection & deterministic parsing (HDFC)
 * 3. Statement fingerprint check (same period, different PDF)
 * 4. Per-row bankTransactionKey deduplication
 * 5. Transaction creation via existing TransactionService.create()
 *
 * For non-HDFC banks, the existing OpenAI pipeline is used unchanged.
 */

import { db } from '../../db';
import { importedStatements, transactions } from '../../db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { generateFileHash, generateStatementFingerprint, generateBankTransactionKey } from './statementHashUtils';
import { isHDFCStatement, parseHDFCStatement } from './hdfcStatementParser';
import type { StatementImportResult, ImportRowResult } from './types';

// Re-export for convenience
export { generateFileHash } from './statementHashUtils';

/**
 * Check if a file with this exact hash has already been imported for this org+account.
 */
export async function checkFileHashExists(orgId: number, fileHash: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: importedStatements.id })
    .from(importedStatements)
    .where(
      and(
        eq(importedStatements.orgId, orgId),
        eq(importedStatements.fileHash, fileHash),
        eq(importedStatements.status, 1) // Only active imports
      )
    )
    .limit(1);

  return !!existing;
}

/**
 * Check if a statement with this fingerprint has already been imported.
 */
export async function checkStatementFingerprintExists(
  orgId: number,
  fingerprint: string
): Promise<boolean> {
  const [existing] = await db
    .select({ id: importedStatements.id })
    .from(importedStatements)
    .where(
      and(
        eq(importedStatements.orgId, orgId),
        eq(importedStatements.statementFingerprint, fingerprint),
        eq(importedStatements.status, 1)
      )
    )
    .limit(1);

  return !!existing;
}

/**
 * Check which bankTransactionKeys already exist in the database.
 * Returns a Set of existing keys for fast lookup.
 */
export async function getExistingBankTransactionKeys(
  orgId: number,
  keys: string[]
): Promise<Set<string>> {
  if (keys.length === 0) return new Set();

  // Query in batches to avoid overly large IN clauses
  const BATCH_SIZE = 500;
  const existingKeys = new Set<string>();

  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    const batch = keys.slice(i, i + BATCH_SIZE);
    const results = await db
      .select({ key: transactions.bankTransactionKey })
      .from(transactions)
      .where(
        and(
          eq(transactions.orgId, orgId),
          isNotNull(transactions.bankTransactionKey)
        )
      );

    for (const row of results) {
      if (row.key && batch.includes(row.key)) {
        existingKeys.add(row.key);
      }
    }
  }

  return existingKeys;
}

/**
 * Detect bank type from PDF text.
 * Currently only HDFC has a deterministic parser.
 */
export async function detectBankType(buffer: Buffer): Promise<'HDFC' | 'UNKNOWN'> {
  // We need to extract text first to detect
  if (typeof (globalThis as any).DOMMatrix === 'undefined') {
    (globalThis as any).DOMMatrix = class DOMMatrix {} as any;
  }
  // @ts-ignore
  const pdf = (await import('pdf-parse/lib/pdf-parse.js')).default;
  const data = await pdf(buffer);
  const text: string = data.text;

  if (isHDFCStatement(text)) return 'HDFC';
  return 'UNKNOWN';
}

/**
 * Process an HDFC statement through the deterministic pipeline.
 *
 * This is called by the main importFromPDF flow when bank type is detected as HDFC.
 * It handles fingerprint checks and per-row deduplication, then returns results
 * for the caller to create transactions.
 */
export async function processHDFCImport(params: {
  buffer: Buffer;
  orgId: number;
  accountId: number;
  branchId: number;
  fileHash: string;
  accountNumber: string;
}): Promise<StatementImportResult> {
  const { buffer, orgId, accountId, branchId, fileHash, accountNumber } = params;

  // Parse the statement
  const parsed = await parseHDFCStatement(buffer);

  // Use account number from parser if available, otherwise use the one from params
  const effectiveAccountNumber = parsed.accountNumber || accountNumber;

  // Check validation
  if (!parsed.validation.isValid) {
    return {
      success: false,
      message: 'HDFC statement parsed but validation failed. No transactions were imported.',
      importedCount: 0,
      duplicateCount: 0,
      invalidCount: parsed.rows.length,
      parser: 'HDFC_DETERMINISTIC',
      statementAlreadyImported: false,
      fileAlreadyImported: false,
      validationErrors: parsed.validation.errors,
      validationWarnings: parsed.validation.warnings,
      rows: parsed.rows.map(r => ({
        transactionDate: r.transactionDate,
        referenceNo: r.referenceNo,
        debitAmount: r.debitAmount,
        creditAmount: r.creditAmount,
        closingBalance: r.closingBalance,
        narration: r.narration,
        status: 'invalid' as const,
        reason: 'Validation failed: ' + parsed.validation.errors.join('; '),
        bankTransactionKey: '',
      })),
    };
  }

  // Generate statement fingerprint
  let statementFingerprint: string | null = null;
  if (
    parsed.accountNumber &&
    parsed.statementFromDate &&
    parsed.statementToDate &&
    parsed.openingBalance &&
    parsed.closingBalance &&
    parsed.debitCount !== null &&
    parsed.creditCount !== null &&
    parsed.totalDebit &&
    parsed.totalCredit
  ) {
    statementFingerprint = generateStatementFingerprint({
      bankName: 'HDFC',
      accountNumber: parsed.accountNumber,
      statementFromDate: parsed.statementFromDate,
      statementToDate: parsed.statementToDate,
      openingBalance: parsed.openingBalance,
      closingBalance: parsed.closingBalance,
      debitCount: parsed.debitCount,
      creditCount: parsed.creditCount,
      totalDebit: parsed.totalDebit,
      totalCredit: parsed.totalCredit,
    });

    // Check if this statement period was already imported
    const fingerprintExists = await checkStatementFingerprintExists(orgId, statementFingerprint);
    if (fingerprintExists) {
      return {
        success: true,
        message: 'This bank statement period was already imported. No new transactions were created.',
        importedCount: 0,
        duplicateCount: parsed.rows.length,
        invalidCount: 0,
        parser: 'HDFC_DETERMINISTIC',
        statementAlreadyImported: true,
        fileAlreadyImported: false,
        validationErrors: [],
        validationWarnings: parsed.validation.warnings,
        rows: parsed.rows.map(r => ({
          transactionDate: r.transactionDate,
          referenceNo: r.referenceNo,
          debitAmount: r.debitAmount,
          creditAmount: r.creditAmount,
          closingBalance: r.closingBalance,
          narration: r.narration,
          status: 'duplicate' as const,
          reason: 'Statement fingerprint already exists',
          bankTransactionKey: '',
        })),
      };
    }
  }

  // Generate bankTransactionKey for each row
  const rowsWithKeys: (ImportRowResult & { parsedRow: typeof parsed.rows[0] })[] = parsed.rows.map(row => {
    const debitOrCredit = row.debitAmount ? 'DEBIT' : 'CREDIT';
    const amount = row.debitAmount || row.creditAmount || '0';

    const key = generateBankTransactionKey({
      organizationId: orgId,
      accountId,
      bankName: 'HDFC',
      accountNumber: effectiveAccountNumber,
      transactionDate: row.transactionDate,
      valueDate: row.valueDate,
      debitOrCredit: debitOrCredit as 'DEBIT' | 'CREDIT',
      amount,
      closingBalance: row.closingBalance,
      referenceNo: row.referenceNo,
    });

    return {
      transactionDate: row.transactionDate,
      referenceNo: row.referenceNo,
      debitAmount: row.debitAmount,
      creditAmount: row.creditAmount,
      closingBalance: row.closingBalance,
      narration: row.narration,
      status: 'imported' as const,
      reason: null,
      bankTransactionKey: key,
      parsedRow: row,
    };
  });

  // Check existing keys in bulk
  const allKeys = rowsWithKeys.map(r => r.bankTransactionKey);
  const existingKeys = await getExistingBankTransactionKeys(orgId, allKeys);

  // Classify rows
  for (const row of rowsWithKeys) {
    if (existingKeys.has(row.bankTransactionKey)) {
      row.status = 'duplicate';
      row.reason = 'Transaction with this bank key already exists';
    }
  }

  return {
    success: true,
    message: '',
    importedCount: 0, // Will be updated after actual insertion
    duplicateCount: rowsWithKeys.filter(r => r.status === 'duplicate').length,
    invalidCount: rowsWithKeys.filter(r => r.status === 'invalid').length,
    parser: 'HDFC_DETERMINISTIC',
    statementAlreadyImported: false,
    fileAlreadyImported: false,
    validationErrors: parsed.validation.errors,
    validationWarnings: parsed.validation.warnings,
    rows: rowsWithKeys,
  };
}
