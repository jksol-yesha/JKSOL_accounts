import { describe, expect, test } from 'bun:test';
import type { ParsedStatementResult, ParsedStatementRow } from './types';
import { __test__ } from './yesBankStatementParser';

describe('YES Bank deterministic parser helpers', () => {
  test('detects the transaction table header even when the header is split across lines', () => {
    const lines = [
      'Statement of account',
      'Transaction',
      'Date',
      'Value Date',
      'Cheque No/Reference No',
      'Description',
      'Withdrawals Deposits',
      'Running Balance',
      '23 Oct 2025 23 Oct 2025 001FINW252960331 001FINW252960331-FCY-INREMIT-VARACHHAROAD 18,089.80 2,954,217.73',
    ];

    expect(__test__.hasYesTableHeaderAt(lines, 1)).toBe(true);
  });

  test('classifies withdrawals and deposits correctly using newest-to-oldest running balances', () => {
    const result: ParsedStatementResult = {
      parser: 'YES_BANK_DETERMINISTIC_TEXT',
      bankName: 'YES BANK',
      accountNumber: null,
      statementFromDate: null,
      statementToDate: null,
      openingBalance: '3058323.93',
      closingBalance: '2954217.73',
      debitCount: null,
      creditCount: null,
      totalDebit: null,
      totalCredit: null,
      validation: {
        isValid: false,
        errors: [],
        warnings: [],
      },
      rows: [
        {
          sourcePage: 1,
          sourceRow: 1,
          serialNo: 1,
          transactionDate: '2025-10-23',
          valueDate: '2025-10-23',
          chequeNumber: '001FINW252960331',
          referenceNo: '001FINW252960331',
          narration: '001FINW252960331-FCY-INREMIT-VARACHHAROAD',
          debitAmount: null,
          creditAmount: null,
          closingBalance: '2954217.73',
          rawText: '',
        } as ParsedStatementRow & Record<string, any>,
        {
          sourcePage: 1,
          sourceRow: 2,
          serialNo: 2,
          transactionDate: '2025-10-16',
          valueDate: '2025-10-16',
          chequeNumber: 'YESI15289001941000',
          referenceNo: 'YESI15289001941000',
          narration: 'IMPS/NA/XXXX9951/.../Salary',
          debitAmount: null,
          creditAmount: null,
          closingBalance: '2936127.93',
          rawText: '',
        } as ParsedStatementRow & Record<string, any>,
        {
          sourcePage: 1,
          sourceRow: 3,
          serialNo: 3,
          transactionDate: '2025-10-13',
          valueDate: '2025-10-13',
          chequeNumber: 'YESI15286001732100',
          referenceNo: 'YESI15286001732100',
          narration: 'IMPS/NA/XXXX5014/.../Salary',
          debitAmount: null,
          creditAmount: null,
          closingBalance: '2986127.93',
          rawText: '',
        } as ParsedStatementRow & Record<string, any>,
        {
          sourcePage: 1,
          sourceRow: 4,
          serialNo: 4,
          transactionDate: '2025-10-09',
          valueDate: '2025-10-09',
          chequeNumber: 'YESI15282004200100',
          referenceNo: 'YESI15282004200100',
          narration: 'IMPS/NA/XXXX7971/.../Loan Given',
          debitAmount: null,
          creditAmount: null,
          closingBalance: '3008323.93',
          rawText: '',
        } as ParsedStatementRow & Record<string, any>,
      ],
    };

    (result.rows[0] as any)._tempAmount = '18089.80';
    (result.rows[1] as any)._tempAmount = '50000.00';
    (result.rows[2] as any)._tempAmount = '22196.00';
    (result.rows[3] as any)._tempAmount = '50000.00';

    __test__.classifyYesRows(result, result.openingBalance);

    expect(result.rows[0]!.creditAmount).toBe('18089.80');
    expect(result.rows[0]!.debitAmount).toBeNull();
    expect(result.rows[1]!.debitAmount).toBe('50000.00');
    expect(result.rows[1]!.creditAmount).toBeNull();
    expect(result.rows[2]!.debitAmount).toBe('22196.00');
    expect(result.rows[2]!.creditAmount).toBeNull();
    expect(result.rows[3]!.debitAmount).toBe('50000.00');
    expect(result.rows[3]!.creditAmount).toBeNull();
  });
});
