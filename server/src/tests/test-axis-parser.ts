import fs from 'fs';
import { parseAxisStatement } from '../services/statement-parsers/axisStatementParser';

async function runTest() {
  console.log("=== Testing Axis Parser ===");
  const buffer = fs.readFileSync('/Users/erasoft/Downloads/AXIS.pdf');
  
  const result = await parseAxisStatement(buffer);
  
  console.log("Bank Name:", result.bankName);
  console.log("Account Number:", result.accountNumber);
  console.log("Period:", result.statementFromDate, "to", result.statementToDate);
  console.log("Opening Balance:", result.openingBalance);
  console.log("Closing Balance:", result.closingBalance);
  console.log("Total Debit:", result.totalDebit);
  console.log("Total Credit:", result.totalCredit);
  console.log("Debit Count:", result.debitCount);
  console.log("Credit Count:", result.creditCount);
  console.log("Is Valid:", result.validation.isValid);
  if (!result.validation.isValid) {
    console.log("Validation Errors:", result.validation.errors);
  }
  if (result.validation.warnings.length > 0) {
    console.log("Validation Warnings:", result.validation.warnings);
  }
  
  console.log("\nParsed Rows:", result.rows.length);
  for (let i = 0; i < Math.min(3, result.rows.length); i++) {
    const r = result.rows[i];
    console.log(`[${r.transactionDate}] DR: ${r.debitAmount || 'N/A'} CR: ${r.creditAmount || 'N/A'} | Ref: ${r.referenceNo || 'None'} | Bal: ${r.closingBalance}`);
  }
}

runTest().catch(console.error);
