import { parseYESBankStatement } from './server/src/services/statement-parsers/yesBankStatementParser';
import { mock } from 'bun:test';

mock.module('pdf-parse/lib/pdf-parse.js', () => {
  return {
    default: async (buffer: Buffer) => {
      return { text: buffer.toString('utf-8'), numpages: 1 };
    }
  };
});

async function run() {
  const brokenPdfText = `YES BANK LTD
Statement of account: 123456789
Opening Balance: 1,000.00
Transaction
Date Value
Date
Description Withdrawals Deposits
20 Oct 2025
20 Oct 2025
REF_SPLIT
BROKEN DESCRIPTION ACROSS
LINES
150.00 1,100.00
19 Oct 2025
19 Oct 2025
REF_SPLIT_2
ANOTHER BROKEN DESC 50.00
950.00
Total Withdrawals: 50.00 Total Deposits: 150.00 Closing Balance: 1,100.00
`;
  const result = await parseYESBankStatement(Buffer.from(brokenPdfText));
  console.log(JSON.stringify(result, null, 2));
}

run();
