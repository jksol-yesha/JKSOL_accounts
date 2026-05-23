import fs from 'fs';
import { parseICICIStatement, isICICIStatement } from '../services/statement-parsers/iciciStatementParser';

async function runTest() {
  console.log("=== Testing ICICI Parser ===\n");
  const buffer = fs.readFileSync('/Users/erasoft/Downloads/ICICI-041.pdf');

  const result = await parseICICIStatement(buffer);

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
  console.log("Parsed Rows:", result.rows.length);

  if (result.validation.errors.length > 0) {
    console.log("\n=== ERRORS ===");
    for (const e of result.validation.errors) console.log("  ERROR:", e);
  }
  if (result.validation.warnings.length > 0) {
    console.log("\n=== WARNINGS ===");
    for (const w of result.validation.warnings) console.log("  WARN:", w);
  }

  console.log("\n=== ALL ROWS ===");
  for (const r of result.rows) {
    const dir = r.debitAmount ? 'DR' : 'CR';
    const amt = r.debitAmount || r.creditAmount || '?';
    console.log(
      `[S.No ${String(r.serialNo).padStart(2)}] ${r.transactionDate} | ${dir} ${amt.padStart(12)} | Bal: ${r.closingBalance.padStart(12)} | Ref: ${r.referenceNo || 'None'} | ${r.narration.substring(0, 60)}`
    );
  }

  // ─── Specific test assertions ───
  console.log("\n=== TEST ASSERTIONS ===");

  const assert = (cond: boolean, msg: string) => {
    console.log(cond ? `  ✅ ${msg}` : `  ❌ FAIL: ${msg}`);
  };

  assert(result.accountNumber === '019301522041', `Account = ${result.accountNumber}`);
  assert(result.statementFromDate === '2026-01-01', `From = ${result.statementFromDate}`);
  assert(result.statementToDate === '2026-01-31', `To = ${result.statementToDate}`);
  assert(result.rows.length === 21, `Row count = ${result.rows.length}`);
  assert(result.validation.isValid === true, `Validation valid = ${result.validation.isValid}`);

  // Row 1: credit 1100000.00, balance 1317476.85
  const r1 = result.rows[0]!;
  assert(r1.creditAmount === '1100000.00', `Row 1 credit = ${r1.creditAmount}`);
  assert(r1.closingBalance === '1317476.85', `Row 1 balance = ${r1.closingBalance}`);

  // Row 2: debit 150000.00, balance 1167476.85
  const r2 = result.rows[1]!;
  assert(r2.debitAmount === '150000.00', `Row 2 debit = ${r2.debitAmount}`);
  assert(r2.closingBalance === '1167476.85', `Row 2 balance = ${r2.closingBalance}`);

  // Row 16: credit 398855.63, balance 1129499.84
  const r16 = result.rows[15]!;
  assert(r16.creditAmount === '398855.63', `Row 16 credit = ${r16.creditAmount}`);
  assert(r16.closingBalance === '1129499.84', `Row 16 balance = ${r16.closingBalance}`);

  // Row 21: debit 150000.00, balance 679499.84
  const r21 = result.rows[20]!;
  assert(r21.debitAmount === '150000.00', `Row 21 debit = ${r21.debitAmount}`);
  assert(r21.closingBalance === '679499.84', `Row 21 balance = ${r21.closingBalance}`);
}

runTest().catch(console.error);
