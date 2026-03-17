
import { db } from "./index";
import { organizations, branches, accounts, categories, subCategories, transactionTypes, roles, currencies } from "./schema";
import { eq } from "drizzle-orm";

async function seed() {
    console.log("🌱 Starting database seed...");

    try {
        // 0. Seed Transaction Types
        const types = ['Income', 'Expense', 'Investment', 'Transfer'];
        const txnTypeMap = new Map<string, number>();

        for (const name of types) {
            const existingType = await db.select().from(transactionTypes).where(eq(transactionTypes.name, name));
            if (existingType.length > 0) {
                txnTypeMap.set(name.toLowerCase(), existingType[0].id);
            } else {
                const res = await db.insert(transactionTypes).values({ name }).$returningId();
                txnTypeMap.set(name.toLowerCase(), res[0].id!);
                console.log(`✅ Transaction Type '${name}' created.`);
            }
        }

        // 0.2 Seed Currencies
        const currenciesData = [
            { code: 'USD', name: 'US Dollar', symbol: '$' },
            { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
            { code: 'EUR', name: 'Euro', symbol: '€' },
            { code: 'GBP', name: 'British Pound', symbol: '£' },
            { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
            { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
        ];

        for (const curr of currenciesData) {
            const [existingCurr] = await db.select().from(currencies).where(eq(currencies.code, curr.code));
            if (!existingCurr) {
                await db.insert(currencies).values(curr);
                console.log(`✅ Currency '${curr.code}' created.`);
            } else {
                // console.log(`ℹ️ Currency '${curr.code}' already exists.`);
            }
        }

        // 0.1 Seed Roles (Fix for Invite Error)
        const rolesData = ['Owner', 'Admin', 'Member', 'Viewer']; // 1=Owner, 2=Admin, ...

        for (const roleName of rolesData) {
            const [existingRole] = await db.select().from(roles).where(eq(roles.name, roleName));
            if (!existingRole) {
                await db.insert(roles).values({ name: roleName });
                console.log(`✅ Role '${roleName}' created.`);
            } else {
                console.log(`ℹ️ Role '${roleName}' already exists.`);
            }
        }

        // 1. Ensure Organization Exists
        let orgId: number;
        const existingOrg = await db.select().from(organizations).where(eq(organizations.name, "Erasoft")).limit(1);

        if (existingOrg.length > 0) {
            orgId = existingOrg[0].id;
            console.log(`✅ Organization 'Erasoft' found (ID: ${orgId})`);
        } else {
            const result = await db.insert(organizations).values({
                name: "Erasoft",
                baseCurrency: "INR",
                timezone: "Asia/Kolkata",
            }).$returningId();
            orgId = result[0].id!;
            console.log(`✅ Organization 'Erasoft' created (ID: ${orgId})`);
        }

        // 2. Define Branches
        const branchesData = [
            { name: "Surat Branch", code: "SUR", currencyCode: "INR", country: "India" },
            { name: "Pune Branch", code: "PUN", currencyCode: "INR", country: "India" },
            { name: "Mumbai Branch", code: "MUM", currencyCode: "INR", country: "India" },
        ];

        for (const branch of branchesData) {
            let branchId: number;

            // Check if branch exists
            const existingBranch = await db.select()
                .from(branches)
                .where(eq(branches.code, branch.code))
                .limit(1);

            if (existingBranch.length > 0) {
                branchId = existingBranch[0].id;
                console.log(`ℹ️ Branch '${branch.name}' already exists (ID: ${branchId})`);
            } else {
                const result = await db.insert(branches).values({
                    orgId,
                    name: branch.name,
                    code: branch.code,
                    currencyCode: branch.currencyCode,
                    country: branch.country,
                }).$returningId();
                branchId = result[0].id!;
                console.log(`✅ Branch '${branch.name}' created (ID: ${branchId})`);
            }

            // 3. Create Accounts for this Branch
            const accountsData = [
                { name: "Cash Account", type: 'cash' as const },
                { name: `HDFC Bank - ${branch.code}`, type: 'bank' as const },
                { name: `Petty Cash - ${branch.code}`, type: 'cash' as const },
            ];

            for (const acc of accountsData) {
                // Check if account exists
                const existingAccount = await db.select()
                    .from(accounts)
                    .where(
                        eq(accounts.name, acc.name)
                    );

                const isDuplicate = existingAccount.some(a => a.branchId === branchId);

                if (isDuplicate) {
                    console.log(`  ℹ️ Account '${acc.name}' already exists for branch ${branch.code}`);
                } else {
                    const accTypeMapping = { 'cash': 1, 'bank': 1 } as const;

                    await db.insert(accounts).values({
                        orgId: orgId!,
                        branchId: branchId!,
                        name: acc.name,
                        accountType: accTypeMapping[acc.type],
                        openingBalance: "0.00",
                        openingBalanceDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
                    } as any);
                    console.log(`  ✅ Account '${acc.name}' created for branch ${branch.code}`);
                }
            }

            // 4. Create Categories for this Branch
            const categoriesData = [
                { name: "Salary", type: "income" as const, subs: ["Regular"] },
                { name: "Sales", type: "income" as const, subs: ["Direct", "Online"] },
                { name: "Utilities", type: "expense" as const, subs: ["Electricity", "Water", "Internet"] },
                { name: "Rent", type: "expense" as const, subs: ["Office"] },
                { name: "Food", type: "expense" as const, subs: ["Groceries", "Dining Out"] },
            ];

            for (const cat of categoriesData) {
                const txnTypeId = txnTypeMap.get(cat.type);
                if (!txnTypeId) {
                    console.error(`Unknown type ${cat.type} for category ${cat.name}`);
                    continue;
                }

                const existingWrapper = await db.select().from(categories).where(eq(categories.name, cat.name));
                const existingCat = existingWrapper.find(c => c.branchId === branchId && c.txnTypeId === txnTypeId);

                let catId: number;

                if (existingCat) {
                    catId = existingCat.id;
                    console.log(`  ℹ️ Category '${cat.name}' already exists for branch ${branch.code}`);
                } else {
                    const result = await db.insert(categories).values({
                        orgId: orgId!,
                        branchId: branchId!,
                        name: cat.name,
                        txnTypeId: txnTypeId,
                    } as any).$returningId();
                    catId = result[0].id!;
                    console.log(`  ✅ Category '${cat.name}' created for branch ${branch.code}`);
                }

                // Subcategories
                for (const sub of cat.subs) {
                    const existingSubWrapper = await db.select().from(subCategories).where(eq(subCategories.name, sub));
                    const existingSub = existingSubWrapper.find(s => s.categoryId === catId);

                    if (!existingSub) {
                        await db.insert(subCategories).values({
                            categoryId: catId,
                            name: sub,
                        });
                        console.log(`    - Subcategory '${sub}' added.`);
                    }
                }
            }
        }

        console.log("🎉 Database seeding completed successfully!");
        process.exit(0);

    } catch (error) {
        console.error("❌ Error seeding database:", error);
        process.exit(1);
    }
}

seed();
