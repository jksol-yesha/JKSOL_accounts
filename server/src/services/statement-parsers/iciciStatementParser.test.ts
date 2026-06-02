import { describe, expect, test } from 'bun:test';
import { __test__ } from './iciciStatementParser';

describe('ICICI statement parser helpers', () => {
  test('detects date fragments generically across separators', () => {
    expect(__test__.looksLikeDateFragment('29-03-')).toBe(true);
    expect(__test__.looksLikeDateFragment('29/03/')).toBe(true);
    expect(__test__.looksLikeDateFragment('29.03.2026')).toBe(true);
    expect(__test__.looksLikeDateFragment('REFCODE')).toBe(false);
  });

  test('keeps fused trailing dates out of the parsed amount token', () => {
    expect(
      __test__.extractICICITrailingFields(
        '019301522041:Int.Pd:31-12-2025 to 29-03-202620928.00 19805354.20'
      )
    ).toEqual({
      narration: '019301522041:Int.Pd:31-12-2025 to 29-03-202620928.00',
      amount: null,
      closingBalance: '19805354.20',
      ambiguousAmountToken: '29-03-202620928.00',
      ambiguousNarrationPrefix: '019301522041:Int.Pd:31-12-2025 to',
    });
  });

  test('still parses normal fused narration-plus-amount tokens when they are not date-like', () => {
    expect(
      __test__.extractICICITrailingFields(
        'INF/INFT/ABCREF500.00 1500.00'
      )
    ).toEqual({
      narration: 'INF/INFT/ABCREF',
      amount: '500.00',
      closingBalance: '1500.00',
      ambiguousAmountToken: null,
      ambiguousNarrationPrefix: null,
    });
  });

  test('restores the full trailing date when the amount is derived from the balance chain', () => {
    const result: any = {
      rows: [
        {
          sourceRow: 26,
          closingBalance: '19784426.20',
          debitAmount: '180000.00',
          creditAmount: null,
          narration: 'previous row',
        },
        {
          sourceRow: 27,
          closingBalance: '19805354.20',
          debitAmount: null,
          creditAmount: null,
          narration: '019301522041:Int.Pd:31-12-2025 to 29-03-202620928.00',
          _tempAmount: null,
          _ambiguousAmountToken: '29-03-202620928.00',
          _ambiguousNarrationPrefix: '019301522041:Int.Pd:31-12-2025 to',
        },
      ],
      validation: {
        warnings: [],
        errors: [],
        isValid: false,
      },
    };

    __test__.classifyDebitsCredits(result);

    expect(result.rows[1].creditAmount).toBe('20928.00');
    expect(result.rows[1].narration).toBe(
      '019301522041:Int.Pd:31-12-2025 to 29-03-2026'
    );
  });
});
