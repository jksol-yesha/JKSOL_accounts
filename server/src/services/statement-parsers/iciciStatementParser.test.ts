import { describe, expect, test } from 'bun:test';
import type { ParsedStatementResult, ParsedStatementRow } from './types';
import { __test__ } from './iciciStatementParser';

describe('ICICI deterministic parser helpers', () => {
  test('keeps digit-ending narration separate from the transaction amount', () => {
    const extracted = __test__.extractICICITrailingFields(
      'TRF TO FD no. 18371000387622500000.00 2177915.89'
    );

    expect(extracted.closingBalance).toBe('2177915.89');
    expect(extracted.amount).toBeNull();
    expect(extracted.ambiguousAmountToken).toBe('18371000387622500000.00');
    expect(extracted.ambiguousNarrationPrefix).toBe('TRF TO FD no.');
  });

  test('recovers the true amount from the balance chain and restores narration digits', () => {
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
      validation: {
        isValid: false,
        errors: [],
        warnings: [],
      },
      rows: [
        {
          sourcePage: 1,
          sourceRow: 14,
          serialNo: 14,
          transactionDate: '2026-03-13',
          valueDate: null,
          narration: '/INDUSIND BANK L',
          chequeNumber: null,
          referenceNo: null,
          debitAmount: null,
          creditAmount: null,
          closingBalance: '24677915.89',
          rawText: '',
        } as ParsedStatementRow & Record<string, any>,
        {
          sourcePage: 1,
          sourceRow: 15,
          serialNo: 15,
          transactionDate: '2026-03-13',
          valueDate: null,
          narration: 'TRF TO FD no. 18371000387622500000.00',
          chequeNumber: null,
          referenceNo: null,
          debitAmount: null,
          creditAmount: null,
          closingBalance: '2177915.89',
          rawText: '',
        } as ParsedStatementRow & Record<string, any>,
        {
          sourcePage: 1,
          sourceRow: 16,
          serialNo: 16,
          transactionDate: '2026-03-13',
          valueDate: null,
          narration: 'INF/INFT/000083216595/Self',
          chequeNumber: null,
          referenceNo: null,
          debitAmount: null,
          creditAmount: null,
          closingBalance: '2176915.89',
          rawText: '',
        } as ParsedStatementRow & Record<string, any>,
      ],
    };

    (result.rows[0] as any)._tempAmount = '100000.00';
    (result.rows[1] as any)._tempAmount = null;
    (result.rows[1] as any)._ambiguousAmountToken = '18371000387622500000.00';
    (result.rows[1] as any)._ambiguousNarrationPrefix = 'TRF TO FD no.';
    (result.rows[2] as any)._tempAmount = '1000.00';

    __test__.classifyDebitsCredits(result);

    expect(result.rows[1]!.debitAmount).toBe('22500000.00');
    expect(result.rows[1]!.creditAmount).toBeNull();
    expect(result.rows[1]!.narration).toBe('TRF TO FD no. 183710003876');
    expect(result.rows[2]!.debitAmount).toBe('1000.00');
  });
});
