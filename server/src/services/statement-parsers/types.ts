/**
 * Shared types for deterministic bank statement parsers.
 * These types define the contract between parsers and the import orchestrator.
 */

export type ParsedStatementRow = {
  sourcePage: number | null;
  sourceRow: number | null;
  serialNo?: number | null; // ICICI provides stable serial numbers
  transactionDate: string; // YYYY-MM-DD
  valueDate: string | null; // YYYY-MM-DD
  narration: string;
  chequeNumber?: string | null; // ICICI/Axis cheque number column
  referenceNo: string | null;
  debitAmount: string | null; // Decimal string without commas, e.g. "1500.00"
  creditAmount: string | null; // Decimal string without commas, e.g. "25000.00"
  closingBalance: string; // Decimal string without commas
  bankTransactionKey?: string | null; // SHA-256 deterministic row identity
  sourceRowSignature?: string | null; // SHA-256 fallback row identity (no referenceNo)
  rawText: string;
};

export type ParsedStatementResult = {
  parser: 'HDFC_DETERMINISTIC' | 'AXIS_DETERMINISTIC' | 'ICICI_DETERMINISTIC' | 'SBI_DETERMINISTIC' | 'YESBANK_DETERMINISTIC' | string;
  bankName: string;
  accountNumber: string | null;
  accountHolderName?: string | null;   // Customer/account holder name
  ifsc?: string | null;                // IFSC code
  micr?: string | null;                // MICR code
  bankBranchName?: string | null;      // Branch name
  customerId?: string | null;          // Customer ID from statement
  statementFromDate: string | null; // YYYY-MM-DD
  statementToDate: string | null; // YYYY-MM-DD
  openingBalance: string | null; // Decimal string
  closingBalance: string | null; // Decimal string
  debitCount: number | null;
  creditCount: number | null;
  totalDebit: string | null; // Decimal string
  totalCredit: string | null; // Decimal string
  statementFingerprint?: string | null; // SHA-256 of normalized statement metadata
  rows: ParsedStatementRow[];
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
};

export type ImportRowStatus = 'imported' | 'duplicate' | 'invalid';

export type ImportRowResult = {
  transactionDate: string;
  referenceNo: string | null;
  debitAmount: string | null;
  creditAmount: string | null;
  closingBalance: string;
  narration: string;
  status: ImportRowStatus;
  reason: string | null;
  bankTransactionKey: string;
  sourceRowSignature?: string | null;
};

export type StatementImportResult = {
  success: boolean;
  message: string;
  importedCount: number;
  duplicateCount: number;
  invalidCount: number;
  parser: string;
  statementAlreadyImported: boolean;
  fileAlreadyImported: boolean;
  validationErrors: string[];
  validationWarnings: string[];
  rows: ImportRowResult[];
};
