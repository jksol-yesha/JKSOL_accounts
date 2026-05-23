/**
 * Shared types for deterministic bank statement parsers.
 * These types define the contract between parsers and the import orchestrator.
 */

export type ParsedStatementRow = {
  sourcePage: number;
  sourceRow: number;
  serialNo?: number | null; // ICICI provides stable serial numbers
  transactionDate: string; // YYYY-MM-DD
  valueDate: string | null; // YYYY-MM-DD
  narration: string;
  chequeNumber?: string | null; // ICICI cheque number column
  referenceNo: string | null;
  debitAmount: string | null; // Decimal string without commas, e.g. "1500.00"
  creditAmount: string | null; // Decimal string without commas, e.g. "25000.00"
  closingBalance: string; // Decimal string without commas
  rawText: string;
};

export type ParsedStatementResult = {
  parser: 'HDFC_DETERMINISTIC' | 'AXIS_DETERMINISTIC' | 'ICICI_DETERMINISTIC';
  bankName: 'HDFC' | 'AXIS' | 'ICICI';
  accountNumber: string | null;
  statementFromDate: string | null; // YYYY-MM-DD
  statementToDate: string | null; // YYYY-MM-DD
  openingBalance: string | null; // Decimal string
  closingBalance: string | null; // Decimal string
  debitCount: number | null;
  creditCount: number | null;
  totalDebit: string | null; // Decimal string
  totalCredit: string | null; // Decimal string
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
