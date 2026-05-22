/**
 * Quick diagnostic: send a sample HDFC PDF to the upload-statement endpoint
 * and log the response + server-side diagnostics.
 */

import { isHDFCStatement, parseHDFCStatement } from '../services/statement-parsers/hdfcStatementParser';

// Simulate a simple HDFC statement text to debug the parser
const sampleText = `
HDFC BANK Ltd
HDFC BANK HOUSE
Statement of Account

Account No : 50100457839382

From : 16/01/2026  To : 20/01/2026

Date       Narration                                  Chq./Ref.No.       Value Dt    Withdrawal Amt.    Deposit Amt.    Closing Balance
16/01/26   NEFT CR-HDFCH00707242240-DEEPAK KUMAR     HDFCH00707242240   16/01/26                       1,10,000.00    13,17,476.85
17/01/26   UPI-SWIGGY-8956781234@ybl-HDFC             NB17165323031001   17/01/26    1,500.00                          13,15,976.85
18/01/26   IMPS-409417089858-KIRTI MODI               409417089858       18/01/26                       25,000.00      13,40,976.85
19/01/26   NEFT DR-N019267803725-RENT PAYMENT         N019267803725      19/01/26    35,000.00                         13,05,976.85
20/01/26   UPI-FLIPKART-9876543210@ybl               NB20165323031002   20/01/26    3,199.00                          13,02,777.85

Statement Summary
Opening Balance : 2,07,476.85
Closing Balance : 13,02,777.85
Debit Count : 3
Credit Count : 2
Total Debit : 39,699.00
Total Credit : 1,35,000.00
`;

console.log('=== HDFC Parser Diagnostic ===');
console.log('isHDFCStatement:', isHDFCStatement(sampleText));

// Test text line splitting
const lines = sampleText.split('\n');
console.log('Total lines:', lines.length);

// Find header
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].toUpperCase();
  if (line.includes('NARRATION') && (line.includes('WITHDRAWAL') || line.includes('DEPOSIT') || line.includes('CLOSING'))) {
    console.log(`Found header at line ${i}: "${lines[i]}"`);
    break;
  }
  if (line.includes('DATE') && line.includes('NARRATION') && line.includes('CHQ')) {
    console.log(`Found header at line ${i}: "${lines[i]}"`);
    break;
  }
}

// Check date regex on each line after header
const DATE_REGEX = /^(\d{2})\/(\d{2})\/(\d{2,4})/;
let afterHeader = false;
for (let i = 0; i < lines.length; i++) {
  const trimmed = lines[i].trim();
  if (!trimmed) continue;
  
  const upper = trimmed.toUpperCase();
  if (upper.includes('NARRATION') && upper.includes('WITHDRAWAL')) {
    afterHeader = true;
    continue;
  }
  if (upper.includes('DATE') && upper.includes('NARRATION') && upper.includes('CHQ')) {
    afterHeader = true;
    continue;
  }
  
  if (afterHeader) {
    const dateMatch = trimmed.match(DATE_REGEX);
    console.log(`  Line ${i}: date=${dateMatch ? 'YES' : 'NO'} | "${trimmed.substring(0, 80)}"`);
    
    if (upper.startsWith('STATEMENT SUMMARY') || upper.startsWith('OPENING BALANCE')) {
      break;
    }
  }
}
