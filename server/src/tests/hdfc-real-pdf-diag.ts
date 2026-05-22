/**
 * Test the rewritten HDFC parser against real PDFs
 */

if (typeof (globalThis as any).DOMMatrix === 'undefined') {
  (globalThis as any).DOMMatrix = class DOMMatrix {} as any;
}

import fs from 'fs';
import { isHDFCStatement, parseHDFCStatement } from '../services/statement-parsers/hdfcStatementParser';

const pdfPath = '/Users/swaininfo/Downloads/HDFC.pdf';

async function main() {
  console.log('Testing with:', pdfPath);
  const buffer = fs.readFileSync(pdfPath);
  
  const result = await parseHDFCStatement(buffer);
  
  console.log('\n=== PARSE RESULT ===');
  console.log('Account:', result.accountNumber);
  console.log('Period:', result.statementFromDate, 'to', result.statementToDate);
  console.log('Opening Balance:', result.openingBalance);
  console.log('Closing Balance:', result.closingBalance);
  console.log('Dr Count:', result.debitCount, '| Cr Count:', result.creditCount);
  console.log('Total Debit:', result.totalDebit, '| Total Credit:', result.totalCredit);
  console.log('Rows parsed:', result.rows.length);
  console.log('Valid:', result.validation.isValid);
  console.log('Errors:', result.validation.errors);
  console.log('Warnings:', result.validation.warnings);
  
  console.log('\n=== TRANSACTION ROWS ===');
  for (const row of result.rows) {
    const type = row.debitAmount ? 'DEBIT' : 'CREDIT';
    const amount = row.debitAmount || row.creditAmount || '?';
    console.log(`  ${row.transactionDate} | ${type.padEnd(6)} | ${String(amount).padStart(12)} | Bal: ${row.closingBalance} | Ref: ${row.referenceNo || '-'} | ${(row.narration || '').substring(0, 50)}`);
  }
}

main().catch(console.error);
