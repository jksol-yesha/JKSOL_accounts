import { describe, it, expect, mock } from 'bun:test';

mock.module('pdf-parse/lib/pdf-parse.js', () => {
  return {
    default: async (buffer: Buffer) => {
      return { text: buffer.toString('utf-8'), numpages: 1 };
    }
  };
});

import { parseYESBankStatement, isYesBankStatement } from '../yesBankStatementParser';

describe('YES Bank Statement Parser', () => {
  const header = `YES BANK LTD
Statement of account: 123456789
Period: 01 Oct 2025 - 31 Oct 2025
Opening Balance: 2,936,127.93 Total Withdrawals: 0.00 Total Deposits: 0.00 Closing Balance: 2,936,127.93
Transaction Date Value Date Cheque No/Reference No Description Withdrawals Deposits Running Balance
`;

  it('detects YES bank statement flexibly', () => {
    // Requires YES bank, statement of account, and a table header keyword
    expect(isYesBankStatement('yes bank \n statement of account \n running balance')).toBe(true);
    
    // Missing YES bank keyword -> false
    expect(isYesBankStatement('statement of account \n running balance')).toBe(false); 
    
    // Fallback: yesb + statement of account -> true
    expect(isYesBankStatement('yesb000 \n statement of account')).toBe(true);

    expect(isYesBankStatement('hdfc bank \n unrelated things')).toBe(false);
  });

  it('A. Single-line deposit row with correct direction inference', async () => {
    // Current bal: 2954217.73. Older bal (Opening): 2936127.93. 
    // Diff: +18089.80 => Credit.
    const text = header + `23 Oct 2025 23 Oct 2025 REF001 DESCRIPTION 18,089.80 2,954,217.73`;
    const result = await parseYESBankStatement(Buffer.from(text));
    
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].transactionDate).toBe('2025-10-23');
    expect(result.rows[0].valueDate).toBe('2025-10-23');
    expect(result.rows[0].referenceNo).toBe('REF001');
    expect(result.rows[0].narration).toBe('DESCRIPTION');
    expect(result.rows[0].creditAmount).toBe('18089.80');
    expect(result.rows[0].debitAmount).toBeNull();
    expect(result.rows[0].closingBalance).toBe('2954217.73');
  });

  it('B. Single-line withdrawal row with correct direction inference', async () => {
    // Current bal: 2913931.93. Older bal (Opening): 2936127.93.
    // Diff: -22196.00 => Debit.
    const text = header + `13 Oct 2025 13 Oct 2025 REF002 WITHDRAWAL TXN 22,196.00 2,913,931.93`;
    const result = await parseYESBankStatement(Buffer.from(text));
    
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].referenceNo).toBe('REF002');
    expect(result.rows[0].narration).toBe('WITHDRAWAL TXN');
    expect(result.rows[0].debitAmount).toBe('22196.00');
    expect(result.rows[0].creditAmount).toBeNull();
    expect(result.rows[0].closingBalance).toBe('2913931.93');
  });

  it('C. Wrapped description', async () => {
    const text = header + `10 Oct 2025 10 Oct 2025 REF003 LONG DESCRIPTION
THAT WRAPS ACROSS
MULTIPLE LINES 500.00 2,936,627.93`;
    const result = await parseYESBankStatement(Buffer.from(text));
    
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].referenceNo).toBe('REF003');
    expect(result.rows[0].narration).toBe('LONG DESCRIPTION THAT WRAPS ACROSS MULTIPLE LINES');
    expect(result.rows[0].creditAmount).toBe('500.00'); // 2936627.93 - 2936127.93
    expect(result.rows[0].closingBalance).toBe('2936627.93');
  });

  it('D. Footer stop', async () => {
    const text = header + `10 Oct 2025 10 Oct 2025 REF004 NARRATION 10.00 2,936,137.93
Opening Balance: 2,936,127.93
Total Withdrawals: 0.00
This shouldn't be parsed!
    `;
    const result = await parseYESBankStatement(Buffer.from(text));
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].narration).toBe('NARRATION');
  });

  it('E. Text extraction without exact header (fallback row start)', async () => {
    // Missing header entirely, just starts with a date row
    const brokenHeaderText = `YES BANK LTD\n05 Oct 2025 05 Oct 2025 REF005 NO HEADER 100.00 2,936,227.93`;
    const result = await parseYESBankStatement(Buffer.from(brokenHeaderText));
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].referenceNo).toBe('REF005');
    expect(result.rows[0].narration).toBe('NO HEADER');
    expect(result.rows[0].closingBalance).toBe('2936227.93');
  });

  it('F. Reference number extraction safely', async () => {
    const text = header + `11 Oct 2025 11 Oct 2025 ONLY_NARRATION 100.00 2,936,227.93`;
    const result = await parseYESBankStatement(Buffer.from(text));
    expect(result.rows.length).toBe(1);
    // When there's only one word before amount, it becomes narration, reference is null
    expect(result.rows[0].referenceNo).toBeNull();
    expect(result.rows[0].narration).toBe('ONLY_NARRATION');
  });

  it('G. Validation totals matching', async () => {
    const validText = `YES BANK LTD
Opening Balance: 1000.00 Total Withdrawals: 50.00 Total Deposits: 200.00 Closing Balance: 1150.00
Transaction Date Value Date Description Running Balance
15 Oct 2025 15 Oct 2025 REF006 DEPOSIT 200.00 1150.00
14 Oct 2025 14 Oct 2025 REF007 WITHDRAWAL 50.00 950.00
`;
    const result = await parseYESBankStatement(Buffer.from(validText));
    
    expect(result.rows.length).toBe(2);
    // Rows are read newest to oldest. 
    // Row 0: Deposit 200.00 (Current 1150, older 950) -> diff +200 => Credit
    expect(result.rows[0].creditAmount).toBe('200.00');
    // Row 1: Withdrawal 50.00 (Current 950, older opening 1000) -> diff -50 => Debit
    expect(result.rows[1].debitAmount).toBe('50.00');
    
    // Totals should match the summary!
    expect(result.validation.isValid).toBe(true);
    expect(result.validation.errors.length).toBe(0);
    // We shouldn't get mismatch warnings
    expect(result.validation.warnings.some(w => w.includes('mismatch'))).toBe(false);
  });

  it('H. Full-text fallback parses randomly split rows', async () => {
    const brokenPdfText = `YES BANK LTD
Statement of account: 123456789
Opening Balance: 1,000.00 Total Withdrawals: 50.00 Total Deposits: 150.00 Closing Balance: 1,100.00
Transaction
Date Value
Date
Description Withdrawals Deposits
20 Oct 2025
20 Oct 2025
REF1_SPLIT
BROKEN DESCRIPTION ACROSS
LINES
150.00 1,100.00
19 Oct 2025
19 Oct 2025
REF2_SPLIT
ANOTHER BROKEN DESC 50.00
950.00
`;
    const result = await parseYESBankStatement(Buffer.from(brokenPdfText));
    
    // Line-by-line would completely fail here, so fallback should engage and find 2 rows
    expect(result.rows.length).toBe(2);
    
    expect(result.rows[0].transactionDate).toBe('2025-10-20');
    expect(result.rows[0].referenceNo).toBe('REF1_SPLIT');
    expect(result.rows[0].narration).toBe('BROKEN DESCRIPTION ACROSS LINES');
    expect(result.rows[0].creditAmount).toBe('150.00');
    expect(result.rows[0].closingBalance).toBe('1100.00');

    expect(result.rows[1].transactionDate).toBe('2025-10-19');
    expect(result.rows[1].referenceNo).toBe('REF2_SPLIT');
    expect(result.rows[1].narration).toBe('ANOTHER BROKEN DESC');
    expect(result.rows[1].debitAmount).toBe('50.00');
    expect(result.rows[1].closingBalance).toBe('950.00');
  });

});
