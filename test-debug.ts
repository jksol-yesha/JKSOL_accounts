import { parseYESBankStatement, __test__ } from './server/src/services/statement-parsers/yesBankStatementParser';
import { mock } from 'bun:test';

mock.module('pdf-parse/lib/pdf-parse.js', () => {
  return {
    default: async (buffer: Buffer) => {
      return { text: buffer.toString('utf-8'), numpages: 1 };
    }
  };
});

async function run() {
  const header = `YES BANK LTD
Statement of account: 123456789
Period: 01 Oct 2025 - 31 Oct 2025
Opening Balance: 2,936,127.93 Total Withdrawals: 0.00 Total Deposits: 0.00 Closing Balance: 2,936,127.93
Transaction Date Value Date Cheque No/Reference No Description Withdrawals Deposits Running Balance
`;
  const text = header + `23 Oct 2025 23 Oct 2025 REF001 DESCRIPTION 18,089.80 2,954,217.73`;
  const result = await parseYESBankStatement(Buffer.from(text));
  console.log(JSON.stringify(result, null, 2));
}

run();
