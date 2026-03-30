import { CategoryService } from './src/modules/category/category.service';
import { db } from './src/db/index';

async function test() {
    try {
        console.log("Testing category creation with valid branch 31...");
        const result = await CategoryService.create({
            name: "Test Cat Valid Branch",
            branchId: 31,
            orgId: 1,
            txnType: "Expense"
        } as any, 1);
        console.log("Success:", result);
    } catch (e: any) {
        console.error("Error creating category:");
        console.error(e.message);
        console.error(e.stack);
    }
    process.exit(0);
}
test();
