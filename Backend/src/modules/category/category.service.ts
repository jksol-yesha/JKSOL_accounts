import { db } from '../../db';
import { categories, subCategories, branches, organizations, transactionTypes } from '../../db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service';

export class CategoryService {
    static async getAll(orgId: number, branchId: number | number[] | 'all', user?: any) {
        const conditions: any[] = [eq(categories.orgId, orgId)];

        if (branchId === 'all') {
            // No branch filter: allow all users (including members) to see global organization categories.
        } else if (Array.isArray(branchId)) {
            conditions.push(inArray(categories.branchId, branchId.length ? branchId : [-1]));
        } else {
            conditions.push(eq(categories.branchId, branchId));
        }

        const results = await db.select({
            category: categories,
            transactionType: transactionTypes
        })
            .from(categories)
            .leftJoin(transactionTypes, eq(categories.txnTypeId, transactionTypes.id))
            .where(and(...conditions))
            .orderBy(desc(categories.createdAt));

        // Fetch subcategories separately to avoid JSON subquery issues
        const categoryIds = results.map(r => r.category.id);
        const allSubCats = categoryIds.length > 0
            ? await db.select().from(subCategories).where(inArray(subCategories.categoryId, categoryIds))
            : [];

        // Flatten for frontend compatibility: txnType: 'income' (lowercase)
        return results.map(row => {
            const cat = row.category;
            return {
                ...cat,
                transactionType: row.transactionType,
                txnType: row.transactionType?.name.toLowerCase() || '',
                subCategories: allSubCats.filter(s => s.categoryId === cat.id)
            };
        });
    }
    static async create(data: typeof categories.$inferInsert & { txnType?: string }, userId: number) {
        // Enforce uniqueness check manually if needed, or rely on DB constraint
        // DB constraint: uk_cat_org_type_name

        // Check Org Status
        const orgId = data.orgId || 1; // Default to 1 if not provided, mimicking schema default
        const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
        if (!org) throw new Error('Organization not found');
        if (org.status === 2) throw new Error('Cannot create category for an inactive organization');

        // Check if branch is active
        const [branch] = await db.select().from(branches).where(eq(branches.id, data.branchId));
        if (!branch) throw new Error("Branch not found");
        if (branch.status === 2) throw new Error("Cannot create category for an inactive branch");

        // Resolve txnTypeId
        let txnTypeId = data.txnTypeId;
        if (!txnTypeId && data.txnType) {
            // Normalize case: Income, Expense, Investment
            const normalized = data.txnType.charAt(0).toUpperCase() + data.txnType.slice(1).toLowerCase();
            const [typeRecord] = await db.select().from(transactionTypes).where(eq(transactionTypes.name, normalized));

            if (typeRecord) {
                txnTypeId = typeRecord.id;
            } else {
                throw new Error(`Invalid transaction type: ${data.txnType}`);
            }
        }

        if (!txnTypeId) throw new Error("Transaction Type ID is required");

        const insertData: any = { ...data };
        delete insertData.txnType; // Remove mapped field
        insertData.txnTypeId = txnTypeId;

        const [result] = await db.insert(categories).values(insertData).$returningId();

        // Audit Log
        if (result && result.id) {
            await AuditService.log(
                data.orgId!,
                'category',
                result.id,
                'create',
                userId,
                null,
                data
            );
        }

        return { id: result!.id, ...data };
    }

    static async update(id: number, data: Partial<typeof categories.$inferInsert & { txnType?: string }>, userId: number) {
        const [category] = await db.select().from(categories).where(eq(categories.id, id));
        if (!category) throw new Error('Category not found');

        // Check Org Status
        const [org] = await db.select().from(organizations).where(eq(organizations.id, category.orgId));
        if (org && org.status === 2) throw new Error('Cannot update category for an inactive organization');

        const updateData: any = { ...data };

        // Resolve txnTypeId if txnType is provided
        if (updateData.txnType) {
            const normalized = updateData.txnType.charAt(0).toUpperCase() + updateData.txnType.slice(1).toLowerCase();
            const [typeRecord] = await db.select().from(transactionTypes).where(eq(transactionTypes.name, normalized));

            if (typeRecord) {
                updateData.txnTypeId = typeRecord.id;
            } else {
                throw new Error(`Invalid transaction type: ${updateData.txnType}`);
            }
            delete updateData.txnType;
        }

        await db.transaction(async (tx) => {
            await tx.update(categories)
                .set(updateData)
                .where(eq(categories.id, id));

            if (data.status) {
                await tx.update(subCategories)
                    .set({ status: data.status })
                    .where(eq(subCategories.categoryId, id));
            }
        });
        return { id, ...data };
    }

    static async delete(id: number, userId: number) {
        const [category] = await db.select().from(categories).where(eq(categories.id, id));
        if (!category) throw new Error('Category not found');

        // Check Org Status
        const [org] = await db.select().from(organizations).where(eq(organizations.id, category.orgId));
        if (org && org.status === 2) throw new Error('Cannot delete category for an inactive organization');

        // Hard Delete
        await db.delete(categories).where(eq(categories.id, id));

        return { success: true };
    }

    // Subcategories
    static async createSub(data: typeof subCategories.$inferInsert) {
        const [result] = await db.insert(subCategories).values(data).$returningId();
        return { id: result!.id, ...data };
    }

    static async updateSub(id: number, data: Partial<typeof subCategories.$inferInsert>) {
        await db.update(subCategories)
            .set(data)
            .where(eq(subCategories.id, id));
        return { id, ...data };
    }

    static async deleteSub(id: number) {
        // Hard Delete
        await db.delete(subCategories).where(eq(subCategories.id, id));
        return { success: true };
    }
}
