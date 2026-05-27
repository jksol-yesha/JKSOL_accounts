import { parseICICIStatement } from './server/src/services/statement-parsers/iciciStatementParser';
import { mock } from 'bun:test';

mock.module('pdf-parse/lib/pdf-parse.js', () => {
  return {
    default: async (buffer: Buffer) => {
      return { text: buffer.toString('utf-8'), numpages: 1 };
    }
  };
});

async function run() {
  const text = `Statement of Transactions in Saving Account no. 000000000000 in INR for the period January 1, 2026 - January 31, 2026\n15 13.03.2026 TRF TO FD no. 183710003876 22500000.00 2177915.89`;
  const result = await parseICICIStatement(Buffer.from(text));
  console.log(JSON.stringify(result.rows, null, 2));
}

run();
