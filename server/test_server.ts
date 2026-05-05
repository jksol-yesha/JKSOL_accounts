import { TransactionService } from "./src/modules/transactions/transactions.service";

async function main() {
  try {
    const orgId = 1; // Assuming default origin
    const user = { id: 1, role: 'owner' };
    const res = await TransactionService.getAll(orgId, 'all', 1, 10, undefined, user);
    console.log("Success!", res.length);
    process.exit(0);
  } catch (err) {
    console.error("FAIL:", err);
    process.exit(1);
  }
}
main();
