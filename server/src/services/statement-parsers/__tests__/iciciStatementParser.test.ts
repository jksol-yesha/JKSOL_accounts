import { describe, it, expect, mock } from 'bun:test';

mock.module('pdf-parse/lib/pdf-parse.js', () => {
  return {
    default: async (buffer: Buffer) => {
      return { text: buffer.toString('utf-8'), numpages: 1 };
    }
  };
});

import { parseICICIStatement } from '../iciciStatementParser';

describe('ICICI Statement Parser - Synthetic Rows', () => {
  
  const header = `Statement of Transactions in Saving Account no. 999999999999 in INR for the period January 1, 2026 - January 31, 2026\n`;

  it('parses narration ending with numeric identifier without merging', async () => {
    const text = header + `1 01.01.2026 TRF TO FD 183710003876 22500.00 25466.00`;
    const result = await parseICICIStatement(Buffer.from(text));
    
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].narration).toBe('TRF TO FD 183710003876');
    // First row classification heuristic classifies it as credit since there's no prev balance
    expect(result.rows[0].debitAmount === '22500.00' || result.rows[0].creditAmount === '22500.00').toBe(true);
    expect(result.rows[0].closingBalance).toBe('25466.00');
  });

  it('parses narration ending with alphanumeric reference', async () => {
    const text = header + `2 02.01.2026 UPI/REF12345XYZ 1000.00 24466.00`;
    const result = await parseICICIStatement(Buffer.from(text));
    
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].narration).toBe('UPI/REF12345XYZ');
    expect(result.rows[0].debitAmount === '1000.00' || result.rows[0].creditAmount === '1000.00').toBe(true);
    expect(result.rows[0].closingBalance).toBe('24466.00');
  });

  it('parses missing cheque/reference column (just date + narration + amount + balance)', async () => {
    const text = header + `03.01.2026 NEFT TRANSFER 5000.00 19466.00`; // Missing S.No
    const result = await parseICICIStatement(Buffer.from(text));
    
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].narration).toBe('NEFT TRANSFER');
    expect(result.rows[0].debitAmount === '5000.00' || result.rows[0].creditAmount === '5000.00').toBe(true);
    expect(result.rows[0].closingBalance).toBe('19466.00');
  });

  it('parses split final balance decimal', async () => {
    // 19466.0 and 0 on next line
    const text = header + `4 04.01.2026 SPLIT BALANCE 1000.00 18466.0\n0`;
    const result = await parseICICIStatement(Buffer.from(text));
    
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].narration).toBe('SPLIT BALANCE');
    expect(result.rows[0].closingBalance).toBe('18466.00');
  });

  it('parses fused trailing amount and balance', async () => {
    const text = header + `5 05.01.2026 FUSED AMOUNTS 2000.0016466.00`;
    const result = await parseICICIStatement(Buffer.from(text));
    
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].narration).toBe('FUSED AMOUNTS');
    expect(result.rows[0].debitAmount === '2000.00' || result.rows[0].creditAmount === '2000.00').toBe(true);
    expect(result.rows[0].closingBalance).toBe('16466.00');
  });

  it('parses wrapped narration continuation', async () => {
    const text = header + `6 06.01.2026 WRAPPED NARRATION\nCONTINUED TEXT 500.00 15966.00`;
    const result = await parseICICIStatement(Buffer.from(text));
    
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].narration).toBe('WRAPPED NARRATION CONTINUED TEXT');
    expect(result.rows[0].debitAmount === '500.00' || result.rows[0].creditAmount === '500.00').toBe(true);
    expect(result.rows[0].closingBalance).toBe('15966.00');
  });

  it('parses exact screenshot row properly without merging', async () => {
    const text = header + `15 13.03.2026 TRF TO FD no. 183710003876 22500000.00 2177915.89`;
    const result = await parseICICIStatement(Buffer.from(text));
    
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].narration).toBe('TRF TO FD no. 183710003876');
    expect(result.rows[0].debitAmount === '22500000.00' || result.rows[0].creditAmount === '22500000.00').toBe(true);
    expect(result.rows[0].closingBalance).toBe('2177915.89');
  });

});
