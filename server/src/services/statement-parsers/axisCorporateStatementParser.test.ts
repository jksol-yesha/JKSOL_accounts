import { describe, expect, test } from 'bun:test';
import {
  normalizePdfText,
  flatPdfText,
  compactPdfText,
  normalizeAmount,
  extractAxisIfsc,
  extractAxisOpeningBalance,
  extractAxisClosingBalance,
  extractAxisAccountHolderName,
  extractAxisAccountNumber,
  extractAxisStatementDates,
  extractAxisCorporateBranchName,
  isAxisCorporateStatement,
  parseAxisDate,
  parseAxisCorporateStatement
} from './axisCorporateStatementParser';
import { mock } from 'bun:test';

// Use bun:test mock.module to mock 'pdf-parse/lib/pdf-parse.js'
mock.module('pdf-parse/lib/pdf-parse.js', () => {
  return {
    default: async (buffer: Buffer) => {
      return { text: buffer.toString('utf-8'), numpages: 1 };
    }
  };
});

describe('Axis Corporate Statement Parser Helper Extraction', () => {
  test('Test IFSC extraction', () => {
    expect(extractAxisIfsc('IFSC Code : UTIB0000848')).toBe('UTIB0000848');
    expect(extractAxisIfsc('IFSCCode:UTIB0001234')).toBe('UTIB0001234');
    expect(extractAxisIfsc('IFSC Code : UTIB 0009999')).toBe('UTIB0009999');
    expect(extractAxisIfsc('Customer details UTIB0ABC123')).toBe('UTIB0ABC123');
    expect(extractAxisIfsc('No IFSC here')).toBeNull();
  });

  test('Test opening balance', () => {
    expect(extractAxisOpeningBalance('Opening Balance: INR 15,88,289.60')).toBe('1588289.60');
    expect(extractAxisOpeningBalance('OpeningBalance:INR1,00,000.00')).toBe('100000.00');
    expect(extractAxisOpeningBalance('Opening Balance:\n₹ 25,000.50')).toBe('25000.50');
    expect(extractAxisOpeningBalance('Opening Balance Rs. 99,999.99')).toBe('99999.99');
    expect(extractAxisOpeningBalance('No opening balance')).toBeNull();
  });

  test('Test closing balance', () => {
    expect(extractAxisClosingBalance('Closing Balance: INR 93,84,978.60')).toBe('9384978.60');
    expect(extractAxisClosingBalance('ClosingBalance:INR1,23,456.78')).toBe('123456.78');
    expect(extractAxisClosingBalance('No closing balance')).toBeNull();
  });

  test('Test account number', () => {
    expect(extractAxisAccountNumber('Statement of Axis Bank Account No : 921020007722644 for the period')).toBe('921020007722644');
    expect(extractAxisAccountNumber('Account No: 123456789012')).toBe('123456789012');
    expect(extractAxisAccountNumber('No account number')).toBeNull();
  });

  test('Test account holder', () => {
    expect(extractAxisAccountHolderName('ABC ENTERPRISES\nJoint Holder :- ADDRESS HERE')).toBe('ABC ENTERPRISES');
    expect(extractAxisAccountHolderName('XYZ TRADERS Joint Holder :- ADDRESS HERE')).toBe('XYZ TRADERS');
    expect(extractAxisAccountHolderName('M/S SAMPLE & CO Joint Holder :- ADDRESS HERE')).toBe('M/S SAMPLE & CO');
    expect(extractAxisAccountHolderName('Joint Holder :- ADDRESS ONLY')).toBeNull();
  });

  test('Test statement dates', () => {
    expect(extractAxisStatementDates('From : 01/03/2026 To : 31/03/2026')).toEqual({
      fromDate: '2026-03-01',
      toDate: '2026-03-31'
    });

    expect(extractAxisStatementDates('From Date : 01-04-2026 To Date : 30-04-2026')).toEqual({
      fromDate: '2026-04-01',
      toDate: '2026-04-30'
    });
  });

  test('Test date parsing', () => {
    expect(parseAxisDate('02/03/2026')).toBe('2026-03-02');
    expect(parseAxisDate('02-03-2026')).toBe('2026-03-02');
    expect(parseAxisDate('invalid')).toBeNull();
  });

  test('extracts branch name from compact corporate transaction lines', () => {
    const sample = `
102/03/202602/03/2026TD TO For 926040051087794
49,28,997.00CR65,17,286.60VARACHHA ROAD, SURAT
[GJ] (848)
202/03/202602/03/2026TD TO For 926040051088001
49,28,997.00CR1,14,46,283.60VARACHHA ROAD, SURAT
[GJ] (848)
`;

    expect(extractAxisCorporateBranchName(sample)).toBe('VARACHHA ROAD, SURAT');
  });

  test('does not classify retail Axis statements as corporate', () => {
    const retailSample = `
PADSHALA KALPESH PRAVINBHAI
Customer ID :858015446
IFSC Code :UTIB0000848
Statement of Axis Account No :920020060085015 for the period (From : 01-03-2026  To : 31-03-2026)
Tran DateValue DateTransaction ParticularsChq NoAmount(INR)DR/CRBalance(INR)Branch Name
OPENING BALANCE          309032.27
`;

    expect(isAxisCorporateStatement(retailSample)).toBe(false);
  });
});

describe('Axis Corporate Statement Full Parsing', () => {
  test('Full generic sample test', async () => {
    const sample = `
SAMPLE BUSINESS PRIVATE LIMITED
Joint Holder :- SAMPLE ADDRESS LINE
Customer No : 123456789 IFSC Code : UTIB0001234 MICR Code : 123456789
Account Statement Report
Statement of Axis Bank Account No : 123456789012345 for the period ( From : 01/04/2026 To : 30/04/2026 )
Opening Balance: INR 1,00,000.00
1 02/04/2026 02/04/2026 SAMPLE CREDIT TRANSACTION 50,000.00 CR 1,50,000.00 SAMPLE BRANCH
2 03/04/2026 03/04/2026 SAMPLE DEBIT TRANSACTION 25,000.00 DR 1,25,000.00 SAMPLE BRANCH
Closing Balance: INR 1,25,000.00
`;
    
    const result = await parseAxisCorporateStatement(Buffer.from(sample));

    expect(result.accountHolderName).toBe('SAMPLE BUSINESS PRIVATE LIMITED');
    expect(result.accountNumber).toBe('123456789012345');
    expect(result.ifsc).toBe('UTIB0001234');
    expect(result.statementFromDate).toBe('2026-04-01');
    expect(result.statementToDate).toBe('2026-04-30');
    expect(result.openingBalance).toBe('100000.00');
    expect(result.closingBalance).toBe('125000.00');
    expect(result.rows.length).toBe(2);
  });

  test('extracts dominant bank branch name from multiline transaction blocks', async () => {
    const sample = `
SAMPLE BUSINESS PRIVATE LIMITED
Joint Holder :- SAMPLE ADDRESS LINE
Customer No : 123456789 IFSC Code : UTIB0001234 MICR Code : 123456789
Account Statement Report
Statement of Axis Bank Account No : 123456789012345 for the period ( From : 01/04/2026 To : 30/04/2026 )
Opening Balance: INR 1,00,000.00
1 02/04/2026 02/04/2026 SAMPLE CREDIT TRANSACTION 50,000.00 CR 1,50,000.00
MAIN ROAD, SURAT
[GJ]
2 03/04/2026 03/04/2026 SAMPLE DEBIT TRANSACTION 25,000.00 DR 1,25,000.00
MAIN ROAD, SURAT
[GJ]
3 04/04/2026 04/04/2026 SAMPLE OTHER CREDIT 10,000.00 CR 1,35,000.00
OTHER BRANCH
[MH]
Closing Balance: INR 1,35,000.00
`;

    const result = await parseAxisCorporateStatement(Buffer.from(sample));

    expect(result.bankBranchName).toBe('MAIN ROAD, SURAT');
  });

  test('parses fused serial-date and amount-balance corporate rows generically', async () => {
    const sample = `
NEON APPS
Joint Holder :- 3RD FLOOR A-302 ASHITHA SQURE
Customer No : 904752151 IFSC Code : UTIB0000848 MICR Code : 395211005
Account Statement Report
Statement of Axis Bank Account No : 921020007722644 for the period ( From : 01/03/2026 To : 31/03/2026 )
Opening Balance: INR 15,88,289.60
S.NOTransaction
Date
(dd/mm/yyyy)
Value Date
(dd/mm/yyyy)
ParticularsAmount(INR)Debit/CreditBalance(INR)Cheque
Number
Branch Name(SOL)
102/03/202602/03/2026TD TO For 926040051087794
49,28,997.00CR65,17,286.60VARACHHA ROAD, SURAT
[GJ] (848)
304/03/202604/03/2026
NEFT/HDFCH00841502763/DATABILITY
TECHNOLOGIES PVT/HDFC
BANK/0001NEFT DR Neon Apps 5020
96,830.00CR1,15,43,113.60VARACHHA ROAD, SURAT
[GJ] (248)
Cheque Return Details
Closing Balance: INR 1,15,43,113.60
`;

    const result = await parseAxisCorporateStatement(Buffer.from(sample));

    expect(result.rows.length).toBe(2);
    expect(result.bankBranchName).toBe('VARACHHA ROAD, SURAT');
    expect(result.rows[0]?.transactionDate).toBe('2026-03-02');
    expect(result.rows[0]?.valueDate).toBe('2026-03-02');
    expect(result.rows[0]?.creditAmount).toBe('4928997.00');
    expect(result.rows[0]?.closingBalance).toBe('6517286.60');
    expect(result.rows[1]?.narration).toContain('NEFT/HDFCH00841502763/DATABILITY');
    expect(result.rows[1]?.creditAmount).toBe('96830.00');
    expect(result.rows[1]?.closingBalance).toBe('11543113.60');
  });
});
