/**
 * Statement Import Orchestrator Service.
 *
 * This service coordinates the multi-layered deduplication pipeline:
 * 1. File hash check (exact PDF reupload)
 * 2. Bank detection & deterministic parsing (HDFC, AXIS, ICICI)
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
import { isAxisStatement, parseAxisStatement } from './axisStatementParser';
import { isICICIStatement, parseICICIStatement } from './iciciStatementParser';
import { isSBIStatement, parseSBIStatement } from './sbiStatementParser';
import { isYesBankStatement, parseYesBankStatement } from './yesBankStatementParser';
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
export async function detectBankType(buffer: Buffer): Promise<'HDFC' | 'AXIS' | 'ICICI' | 'SBI' | 'YES_BANK' | 'UNKNOWN'> {
  // We need to extract text first to detect
  if (typeof (globalThis as any).DOMMatrix === 'undefined') {
    (globalThis as any).DOMMatrix = class DOMMatrix {} as any;
  }
  // @ts-ignore
  const pdf = (await import('pdf-parse/lib/pdf-parse.js')).default;
  const data = await pdf(buffer);
  const text: string = data.text;

  console.log('[BANK DETECT]', {
    isYES: isYesBankStatement?.(text),
    textStart: text.slice(0, 500),
  });

  if (isHDFCStatement(text)) return 'HDFC';
  if (isAxisStatement(text)) return 'AXIS';
  if (isICICIStatement(text)) return 'ICICI';
  if (isSBIStatement(text)) return 'SBI';
  if (isYesBankStatement(text)) return 'YES_BANK';
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
    const fingerprintExists = statementFingerprint ? await checkStatementFingerprintExists(orgId, statementFingerprint) : false;
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

/**
 * Process an Axis statement through the deterministic pipeline.
 */
export async function processAxisImport(params: {
  buffer: Buffer;
  orgId: number;
  accountId: number;
  branchId: number;
  fileHash: string;
  accountNumber: string;
}): Promise<StatementImportResult> {
  const { buffer, orgId, accountId, branchId, fileHash, accountNumber } = params;

  // Parse the statement
  const parsed = await parseAxisStatement(buffer);

  // Use account number from parser if available, otherwise use the one from params
  const effectiveAccountNumber = parsed.accountNumber || accountNumber;

  // Check validation
  if (!parsed.validation.isValid) {
    return {
      success: false,
      message: 'Axis statement parsed but validation failed. No transactions were imported.',
      importedCount: 0,
      duplicateCount: 0,
      invalidCount: parsed.rows.length,
      parser: 'AXIS_DETERMINISTIC',
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
      bankName: 'AXIS',
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
    const fingerprintExists = statementFingerprint ? await checkStatementFingerprintExists(orgId, statementFingerprint) : false;
    if (fingerprintExists) {
      return {
        success: true,
        message: 'This Axis statement period was already imported. No new transactions were created.',
        importedCount: 0,
        duplicateCount: parsed.rows.length,
        invalidCount: 0,
        parser: 'AXIS_DETERMINISTIC',
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
      bankName: 'AXIS',
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
    importedCount: 0,
    duplicateCount: rowsWithKeys.filter(r => r.status === 'duplicate').length,
    invalidCount: rowsWithKeys.filter(r => r.status === 'invalid').length,
    parser: 'AXIS_DETERMINISTIC',
    statementAlreadyImported: false,
    fileAlreadyImported: false,
    validationErrors: parsed.validation.errors,
    validationWarnings: parsed.validation.warnings,
    rows: rowsWithKeys,
  };
}

/**
 * Process an ICICI statement through the deterministic pipeline.
 *
 * ICICI key generation uses serialNo and chequeNumber instead of valueDate/referenceNo
 * to match the ICICI-specific column structure.
 */
export async function processICICIImport(params: {
  buffer: Buffer;
  orgId: number;
  accountId: number;
  branchId: number;
  fileHash: string;
  accountNumber: string;
}): Promise<StatementImportResult> {
  const { buffer, orgId, accountId, branchId, fileHash, accountNumber } = params;

  // Parse the statement
  const parsed = await parseICICIStatement(buffer);

  // Use account number from parser if available, otherwise use the one from params
  const effectiveAccountNumber = parsed.accountNumber || accountNumber;

  // Check validation
  if (!parsed.validation.isValid) {
    return {
      success: false,
      message: 'ICICI statement parsed but validation failed. No transactions were imported.',
      importedCount: 0,
      duplicateCount: 0,
      invalidCount: parsed.rows.length,
      parser: 'ICICI_DETERMINISTIC',
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
      bankName: 'ICICI',
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
    const fingerprintExists = statementFingerprint ? await checkStatementFingerprintExists(orgId, statementFingerprint) : false;
    if (fingerprintExists) {
      return {
        success: true,
        message: 'This ICICI statement period was already imported. No new transactions were created.',
        importedCount: 0,
        duplicateCount: parsed.rows.length,
        invalidCount: 0,
        parser: 'ICICI_DETERMINISTIC',
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
  // For detailed variant: use generateBankTransactionKey with transactionId as referenceNo
  // For retail variant: use serialNo + chequeNumber (existing approach)
  const isDetailed = parsed.parserVariant === 'ICICI_DETAILED_STATEMENT';

  const rowsWithKeys: (ImportRowResult & { parsedRow: typeof parsed.rows[0] })[] = parsed.rows.map(row => {
    const debitOrCredit = row.debitAmount ? 'DEBIT' : 'CREDIT';
    const amount = row.debitAmount || row.creditAmount || '0';

    let key: string;
    if (isDetailed) {
      key = generateBankTransactionKey({
        organizationId: orgId,
        accountId,
        bankName: 'ICICI',
        accountNumber: effectiveAccountNumber,
        transactionDate: row.transactionDate,
        valueDate: row.valueDate,
        debitOrCredit: debitOrCredit as 'DEBIT' | 'CREDIT',
        amount,
        closingBalance: row.closingBalance,
        referenceNo: row.referenceNo,
      });
    } else {
      const crypto = require('crypto');
      const keyInput = [
        String(orgId),
        String(accountId),
        'ICICI',
        effectiveAccountNumber,
        String(row.serialNo ?? ''),
        row.transactionDate,
        debitOrCredit,
        amount,
        row.closingBalance,
        row.chequeNumber || '',
      ].join('|');
      key = crypto.createHash('sha256').update(keyInput).digest('hex');
    }

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
    importedCount: 0,
    duplicateCount: rowsWithKeys.filter(r => r.status === 'duplicate').length,
    invalidCount: rowsWithKeys.filter(r => r.status === 'invalid').length,
    parser: 'ICICI_DETERMINISTIC',
    statementAlreadyImported: false,
    fileAlreadyImported: false,
    validationErrors: parsed.validation.errors,
    validationWarnings: parsed.validation.warnings,
    rows: rowsWithKeys,
  };
}



/**
 * Process an SBI statement through the deterministic pipeline.
 */
export async function processSBIImport(params: {
  buffer: Buffer;
  orgId: number;
  accountId: number;
  branchId: number;
  fileHash: string;
  accountNumber: string;
}): Promise<StatementImportResult> {
  const { buffer, orgId, accountId, branchId, fileHash, accountNumber } = params;

  // Parse the statement
  const parsed = await parseSBIStatement(buffer);

  // Use account number from parser if available, otherwise use the one from params
  const effectiveAccountNumber = parsed.accountNumber || accountNumber;

  // Check validation
  if (!parsed.validation.isValid) {
    return {
      success: false,
      message: 'SBI statement parsed but validation failed. No transactions were imported.',
      importedCount: 0,
      duplicateCount: 0,
      invalidCount: parsed.rows.length,
      parser: 'SBI_DETERMINISTIC',
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
      bankName: 'SBI',
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
    const fingerprintExists = statementFingerprint ? await checkStatementFingerprintExists(orgId, statementFingerprint) : false;
    if (fingerprintExists) {
      return {
        success: true,
        message: 'This SBI statement period was already imported. No new transactions were created.',
        importedCount: 0,
        duplicateCount: parsed.rows.length,
        invalidCount: 0,
        parser: 'SBI_DETERMINISTIC',
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
      bankName: 'SBI',
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
    parser: 'SBI_DETERMINISTIC',
    statementAlreadyImported: false,
    fileAlreadyImported: false,
    validationErrors: parsed.validation.errors,
    validationWarnings: parsed.validation.warnings,
    rows: rowsWithKeys,
  };
}

/**
 * Process a YES Bank statement through the deterministic pipeline.
 */
export async function processYESBankImport(params: {
  buffer: Buffer;
  orgId: number;
  accountId: number;
  branchId: number;
  fileHash: string;
  accountNumber: string;
}): Promise<StatementImportResult> {
  const { buffer, orgId, accountId, branchId, fileHash, accountNumber } = params;

  // Parse the statement
  const parsed = await parseYesBankStatement(buffer);

  // Use account number from parser if available, otherwise use the one from params
  const effectiveAccountNumber = parsed.accountNumber || accountNumber;

  // Check validation
  if (!parsed.validation.isValid) {
    return {
      success: false,
      message: 'YES Bank statement parsed but validation failed. No transactions were imported.',
      importedCount: 0,
      duplicateCount: 0,
      invalidCount: parsed.rows.length,
      parser: 'YES_BANK_DETERMINISTIC_TEXT',
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
      bankName: 'YES BANK',
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
    const fingerprintExists = statementFingerprint ? await checkStatementFingerprintExists(orgId, statementFingerprint) : false;
    if (fingerprintExists) {
      return {
        success: true,
        message: 'This YES Bank statement period was already imported. No new transactions were created.',
        importedCount: 0,
        duplicateCount: parsed.rows.length,
        invalidCount: 0,
        parser: 'YES_BANK_DETERMINISTIC_TEXT',
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
      bankName: 'YES BANK',
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
    parser: 'YES_BANK_DETERMINISTIC_TEXT',
    statementAlreadyImported: false,
    fileAlreadyImported: false,
    validationErrors: parsed.validation.errors,
    validationWarnings: parsed.validation.warnings,
    rows: rowsWithKeys,
  };
}
