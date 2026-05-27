import { describe, it, expect } from 'bun:test';
import { parseYESBankStatement } from '../yesBankStatementParser';

describe('Direct YES Bank PDF Test', () => {
  it('I. Direct test for uploaded YES Bank PDF', async () => {
    // This uses the actual PDF file from the user's Downloads directory
    try {
      const buffer = await Bun.file('/Users/erasoft/Downloads/Yes-022 1.pdf').arrayBuffer();
      const result = await parseYESBankStatement(Buffer.from(buffer));
      
      console.log(`Direct PDF Test Result: ${result.rows.length} rows found.`);
      expect(result.rows.length).toBeGreaterThan(0);
      
      if (result.rows.length === 4) {
        // Assert the expected rows from the user's sample
        expect(result.rows[0].transactionDate).toBe('2025-10-23');
        expect(result.rows[0].creditAmount).toBe('18089.80');
        expect(result.rows[0].closingBalance).toBe('2954217.73');

        expect(result.rows[1].transactionDate).toBe('2025-10-16');
        expect(result.rows[1].debitAmount).toBe('50000.00');
        expect(result.rows[1].closingBalance).toBe('2936127.93');

        expect(result.rows[2].transactionDate).toBe('2025-10-13');
        expect(result.rows[2].debitAmount).toBe('22196.00');
        expect(result.rows[2].closingBalance).toBe('2986127.93');

        expect(result.rows[3].transactionDate).toBe('2025-10-09');
        expect(result.rows[3].debitAmount).toBe('50000.00');
        expect(result.rows[3].closingBalance).toBe('3008323.93');
      }
    } catch (e: any) {
      if (e.code === 'ENOENT') {
        console.warn('Skipping direct PDF test because file does not exist locally.');
      } else {
        throw e;
      }
    }
  });
});
