import { db } from '../../db';
import { categories, subCategories, branches, organizations, transactionTypes, transactions } from '../../db/schema';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service';
import XLSX from 'xlsx';

type BranchFilter = number | number[] | 'all';

type CategoryExportFilters = {
    financialYearId?: number;
    searchTerm?: string;
    typeFilter?: string;
};

type GroupedExportCategory = {
    id: number;
    name: string;
    type: string;
    status: number | string;
    transactionCount: number;
    lastUsedDate: string;
    subCategories: Array<{
        id: number;
        name: string;
        status: number | string;
        transactionCount: number;
        lastUsedDate: string;
    }>;
};

export class CategoryService {
    static async getAll(orgId: number, branchId: number | number[] | 'all', financialYearId?: number, user?: any) {
        const conditions: any[] = [eq(categories.orgId, orgId)];

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

        const transactionConditions: any[] = [eq(transactions.orgId, orgId), eq(transactions.status, 1)];
        if (financialYearId) {
            transactionConditions.push(eq(transactions.financialYearId, financialYearId));
        }
        if (branchId === 'all') {
            // no branch restriction
        } else if (Array.isArray(branchId)) {
            transactionConditions.push(inArray(transactions.branchId, branchId.length ? branchId : [-1]));
        } else {
            transactionConditions.push(eq(transactions.branchId, branchId));
        }

        const categoryTransactionCounts = categoryIds.length > 0
            ? await db
                .select({
                    categoryId: transactions.categoryId,
                    count: sql<number>`count(*)`,
                    lastUsedDate: sql<string | null>`max(${transactions.txnDate})`
                })
                .from(transactions)
                .where(and(...transactionConditions, inArray(transactions.categoryId, categoryIds)))
                .groupBy(transactions.categoryId)
            : [];

        const subCategoryIds = allSubCats.map((sub) => sub.id);
        const subCategoryTransactionCounts = subCategoryIds.length > 0
            ? await db
                .select({
                    subCategoryId: transactions.subCategoryId,
                    count: sql<number>`count(*)`,
                    lastUsedDate: sql<string | null>`max(${transactions.txnDate})`
                })
                .from(transactions)
                .where(and(...transactionConditions, inArray(transactions.subCategoryId, subCategoryIds)))
                .groupBy(transactions.subCategoryId)
            : [];

        const categoryStatsMap = new Map(
            categoryTransactionCounts.map((row) => [
                Number(row.categoryId),
                {
                    count: Number(row.count || 0),
                    lastUsedDate: row.lastUsedDate || ''
                }
            ])
        );
        const subCategoryStatsMap = new Map(
            subCategoryTransactionCounts.map((row) => [
                Number(row.subCategoryId),
                {
                    count: Number(row.count || 0),
                    lastUsedDate: row.lastUsedDate || ''
                }
            ])
        );

        // Flatten for frontend compatibility: txnType: 'income' (lowercase)
        return results.map(row => {
            const cat = row.category;
            return {
                ...cat,
                transactionType: row.transactionType,
                txnType: row.transactionType?.name.toLowerCase() || '',
                transactionCount: categoryStatsMap.get(Number(cat.id))?.count || 0,
                lastUsedDate: categoryStatsMap.get(Number(cat.id))?.lastUsedDate || '',
                subCategories: allSubCats
                    .filter(s => s.categoryId === cat.id)
                    .map((sub) => ({
                        ...sub,
                        transactionCount: subCategoryStatsMap.get(Number(sub.id))?.count || 0,
                        lastUsedDate: subCategoryStatsMap.get(Number(sub.id))?.lastUsedDate || ''
                    }))
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
        const previousTxnTypeId = Number(category.txnTypeId || 0);

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

            if (updateData.txnTypeId && Number(updateData.txnTypeId) !== previousTxnTypeId) {
                await tx.update(transactions)
                    .set({ txnTypeId: Number(updateData.txnTypeId) })
                    .where(eq(transactions.categoryId, id));
            }

            if (data.status) {
                await tx.update(subCategories)
                    .set({ status: data.status })
                    .where(eq(subCategories.categoryId, id));
            }

            await AuditService.log(
                category.orgId,
                'category',
                id,
                'update',
                userId,
                category,
                { ...category, ...updateData },
                tx
            );
        });
        return { id, ...data };
    }

    static async delete(id: number, userId: number) {
        const [category] = await db.select().from(categories).where(eq(categories.id, id));
        if (!category) throw new Error('Category not found');

        // Check Org Status
        const [org] = await db.select().from(organizations).where(eq(organizations.id, category.orgId));
        if (org && org.status === 2) throw new Error('Cannot delete category for an inactive organization');

        await db.transaction(async (tx) => {
            // Hard delete the category after capturing its previous state for the audit trail.
            await tx.delete(categories).where(eq(categories.id, id));
            await AuditService.log(
                category.orgId,
                'category',
                id,
                'delete',
                userId,
                category,
                null,
                tx
            );
        });

        return { success: true };
    }

    // Subcategories
    static async createSub(data: typeof subCategories.$inferInsert, userId: number) {
        const [category] = await db.select().from(categories).where(eq(categories.id, data.categoryId));
        if (!category) throw new Error('Category not found');

        const [result] = await db.insert(subCategories).values(data).$returningId();
        if (result?.id) {
            await AuditService.log(
                category.orgId,
                'subcategory',
                result.id,
                'create',
                userId,
                null,
                {
                    id: result.id,
                    ...data,
                    categoryName: category.name
                }
            );
        }
        return { id: result!.id, ...data };
    }

    static async updateSub(id: number, data: Partial<typeof subCategories.$inferInsert>, userId: number) {
        const [subCategory] = await db.select().from(subCategories).where(eq(subCategories.id, id));
        if (!subCategory) throw new Error('Subcategory not found');

        const [category] = await db.select().from(categories).where(eq(categories.id, subCategory.categoryId));
        if (!category) throw new Error('Category not found');

        await db.transaction(async (tx) => {
            await tx.update(subCategories)
                .set(data)
                .where(eq(subCategories.id, id));

            await AuditService.log(
                category.orgId,
                'subcategory',
                id,
                'update',
                userId,
                {
                    ...subCategory,
                    categoryName: category.name
                },
                {
                    ...subCategory,
                    ...data,
                    categoryName: category.name
                },
                tx
            );
        });
        return { id, ...data };
    }

    static async deleteSub(id: number, userId: number) {
        const [subCategory] = await db.select().from(subCategories).where(eq(subCategories.id, id));
        if (!subCategory) throw new Error('Subcategory not found');

        const [category] = await db.select().from(categories).where(eq(categories.id, subCategory.categoryId));
        if (!category) throw new Error('Category not found');

        await db.transaction(async (tx) => {
            // Hard delete the subcategory after capturing the previous row for audit history.
            await tx.delete(subCategories).where(eq(subCategories.id, id));
            await AuditService.log(
                category.orgId,
                'subcategory',
                id,
                'delete',
                userId,
                {
                    ...subCategory,
                    categoryName: category.name
                },
                null,
                tx
            );
        });
        return { success: true };
    }

    static async getGroupedExportData(orgId: number, branchId: BranchFilter, filters: CategoryExportFilters = {}) {
        const conditions: any[] = [eq(categories.orgId, orgId)];

        const results = await db.select({
            category: categories,
            transactionType: transactionTypes
        })
            .from(categories)
            .leftJoin(transactionTypes, eq(categories.txnTypeId, transactionTypes.id))
            .where(and(...conditions))
            .orderBy(desc(categories.createdAt));

        const categoryIds = results.map((row) => row.category.id);
        const allSubCats = categoryIds.length > 0
            ? await db.select().from(subCategories).where(inArray(subCategories.categoryId, categoryIds))
            : [];

        const transactionConditions: any[] = [eq(transactions.orgId, orgId), eq(transactions.status, 1)];
        if (branchId === 'all') {
            // no branch restriction
        } else if (Array.isArray(branchId)) {
            transactionConditions.push(inArray(transactions.branchId, branchId.length ? branchId : [-1]));
        } else {
            transactionConditions.push(eq(transactions.branchId, branchId));
        }
        if (filters.financialYearId) {
            transactionConditions.push(eq(transactions.financialYearId, filters.financialYearId));
        }

        const relevantTransactions = categoryIds.length > 0
            ? await db.select({
                categoryId: transactions.categoryId,
                subCategoryId: transactions.subCategoryId,
                txnDate: transactions.txnDate
            })
                .from(transactions)
                .where(and(...transactionConditions))
            : [];

        const categoryTransactionMap = new Map<number, number>();
        const subCategoryTransactionMap = new Map<number, number>();
        const categoryLastUsedMap = new Map<number, string>();
        const subCategoryLastUsedMap = new Map<number, string>();

        for (const txn of relevantTransactions) {
            const categoryId = Number(txn.categoryId || 0);
            const subCategoryId = Number(txn.subCategoryId || 0);
            const txnDate = txn.txnDate || '';

            if (categoryId) {
                categoryTransactionMap.set(categoryId, (categoryTransactionMap.get(categoryId) || 0) + 1);
                if (txnDate) {
                    const current = categoryLastUsedMap.get(categoryId);
                    if (!current || txnDate > current) categoryLastUsedMap.set(categoryId, txnDate);
                }
            }

            if (subCategoryId) {
                subCategoryTransactionMap.set(subCategoryId, (subCategoryTransactionMap.get(subCategoryId) || 0) + 1);
                if (txnDate) {
                    const current = subCategoryLastUsedMap.get(subCategoryId);
                    if (!current || txnDate > current) subCategoryLastUsedMap.set(subCategoryId, txnDate);
                }
            }
        }

        const groupedCats = new Map<string, GroupedExportCategory>();
        const groupedSubs = new Map<string, GroupedExportCategory['subCategories'][number] & { categoryKey: string }>();

        for (const row of results) {
            const cat = row.category;
            const typeLabel = row.transactionType?.name || '';
            const categoryKey = (cat.name || '').toLowerCase().trim();

            if (!groupedCats.has(categoryKey)) {
                groupedCats.set(categoryKey, {
                    id: cat.id,
                    name: cat.name,
                    type: typeLabel,
                    status: cat.status,
                    transactionCount: Number(categoryTransactionMap.get(Number(cat.id)) || 0),
                    lastUsedDate: categoryLastUsedMap.get(Number(cat.id)) || '',
                    subCategories: []
                });
            } else {
                const existing = groupedCats.get(categoryKey)!;
                existing.transactionCount += Number(categoryTransactionMap.get(Number(cat.id)) || 0);
                const currentLastUsed = categoryLastUsedMap.get(Number(cat.id)) || '';
                if (currentLastUsed && (!existing.lastUsedDate || currentLastUsed > existing.lastUsedDate)) {
                    existing.lastUsedDate = currentLastUsed;
                }
            }

            const catSubs = allSubCats.filter((sub) => sub.categoryId === cat.id);
            for (const sub of catSubs) {
                const subKey = `${categoryKey}::${(sub.name || '').toLowerCase().trim()}`;
                if (!groupedSubs.has(subKey)) {
                    groupedSubs.set(subKey, {
                        id: sub.id,
                        name: sub.name,
                        status: sub.status,
                        transactionCount: Number(subCategoryTransactionMap.get(Number(sub.id)) || 0),
                        lastUsedDate: subCategoryLastUsedMap.get(Number(sub.id)) || '',
                        categoryKey
                    });
                } else {
                    const existingSub = groupedSubs.get(subKey)!;
                    existingSub.transactionCount += Number(subCategoryTransactionMap.get(Number(sub.id)) || 0);
                    const currentLastUsed = subCategoryLastUsedMap.get(Number(sub.id)) || '';
                    if (currentLastUsed && (!existingSub.lastUsedDate || currentLastUsed > existingSub.lastUsedDate)) {
                        existingSub.lastUsedDate = currentLastUsed;
                    }
                }
            }
        }

        for (const sub of groupedSubs.values()) {
            const parent = groupedCats.get(sub.categoryKey);
            if (parent) {
                parent.subCategories.push({
                    id: sub.id,
                    name: sub.name,
                    status: sub.status,
                    transactionCount: sub.transactionCount,
                    lastUsedDate: sub.lastUsedDate
                });
            }
        }

        let grouped = Array.from(groupedCats.values()).map((category) => ({
            ...category,
            subCategories: category.subCategories.sort((a, b) => a.name.localeCompare(b.name))
        }));

        const normalizedSearch = (filters.searchTerm || '').trim().toLowerCase();
        const normalizedTypeFilter = (filters.typeFilter || 'All Types').trim();
        const normalizedTypeValues = normalizedTypeFilter && normalizedTypeFilter !== 'All Types'
            ? normalizedTypeFilter
                .split(',')
                .map((value) => value.trim().toLowerCase())
                .filter(Boolean)
            : [];

        if (normalizedTypeValues.length > 0) {
            grouped = grouped.filter((category) => normalizedTypeValues.includes(String(category.type || '').trim().toLowerCase()));
        }

        if (normalizedSearch) {
            grouped = grouped.filter((category) =>
                category.name.toLowerCase().includes(normalizedSearch) ||
                category.type.toLowerCase().includes(normalizedSearch)
            );
        }

        return grouped.sort((a, b) => a.name.localeCompare(b.name));
    }

    static formatDisplayDate(date?: string) {
        if (!date) return '-';
        const parsed = new Date(date);
        if (Number.isNaN(parsed.getTime())) return '-';
        return parsed.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }

    static buildExportRows(groupedCategories: GroupedExportCategory[]) {
        const rows: Array<Record<string, string | number>> = [];

        for (const category of groupedCategories) {
            rows.push({
                Category: category.name,
                'Sub-Category': '',
                Type: category.type,
                Transactions: Number(category.transactionCount || 0),
                'Last Used': this.formatDisplayDate(category.lastUsedDate),
                Status: category.status === 2 || String(category.status).toLowerCase() === 'inactive' ? 'Inactive' : 'Active'
            });

            for (const sub of category.subCategories) {
                rows.push({
                    Category: category.name,
                    'Sub-Category': sub.name,
                    Type: category.type,
                    Transactions: Number(sub.transactionCount || 0),
                    'Last Used': this.formatDisplayDate(sub.lastUsedDate),
                    Status: sub.status === 2 || String(sub.status).toLowerCase() === 'inactive' ? 'Inactive' : 'Active'
                });
            }
        }

        return rows;
    }

    static buildExportWorkbook(groupedCategories: GroupedExportCategory[]) {
        const rows = this.buildExportRows(groupedCategories);
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Categories');
        const workbookArray = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
        return workbookArray instanceof Uint8Array ? workbookArray : new Uint8Array(workbookArray);
    }

    static buildExportCsv(groupedCategories: GroupedExportCategory[]) {
        const rows = this.buildExportRows(groupedCategories);
        const worksheet = XLSX.utils.json_to_sheet(rows);
        return XLSX.utils.sheet_to_csv(worksheet);
    }

    static buildPrintableHtml(groupedCategories: GroupedExportCategory[]) {
        const escapeHtml = (value: string) => value
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');

        const rows = groupedCategories.map((category) => {
            const categoryRow = `
                <tr>
                    <td>${escapeHtml(category.name)}</td>
                    <td></td>
                    <td>${escapeHtml(category.type)}</td>
                    <td class="center">${Number(category.transactionCount || 0)}</td>
                    <td class="center">${escapeHtml(this.formatDisplayDate(category.lastUsedDate))}</td>
                    <td class="center">${category.status === 2 || String(category.status).toLowerCase() === 'inactive' ? 'Inactive' : 'Active'}</td>
                </tr>
            `;

            const subRows = category.subCategories.map((sub) => `
                <tr class="sub-row">
                    <td>${escapeHtml(category.name)}</td>
                    <td>${escapeHtml(sub.name)}</td>
                    <td>${escapeHtml(category.type)}</td>
                    <td class="center">${Number(sub.transactionCount || 0)}</td>
                    <td class="center">${escapeHtml(this.formatDisplayDate(sub.lastUsedDate))}</td>
                    <td class="center">${sub.status === 2 || String(sub.status).toLowerCase() === 'inactive' ? 'Inactive' : 'Active'}</td>
                </tr>
            `).join('');

            return categoryRow + subRows;
        }).join('');

        return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Category</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
    h1 { margin: 0 0 16px; font-size: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #e5e7eb; padding: 8px 10px; font-size: 12px; text-align: left; }
    th { background: #f8fafc; text-transform: uppercase; letter-spacing: .06em; font-size: 11px; }
    .center { text-align: center; }
    .sub-row td { color: #475569; }
  </style>
</head>
<body>
  <h1>Category</h1>
  <table>
    <thead>
      <tr>
        <th>Category</th>
        <th>Sub-Category</th>
        <th>Type</th>
        <th>Transactions</th>
        <th>Last Used</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;
    }
}
