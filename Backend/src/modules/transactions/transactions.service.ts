
import { db } from '../../db';
import { transactions, transactionEntries, accounts, auditLogs, transactionTypes, categories, subCategories, currencies, financialYears, branches, organizations, users, parties } from '../../db/schema';
import { eq, and, desc, lte, gte, inArray, sql } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service';
import { ExchangeRateService } from '../../shared/exchange-rate.service';
import { PDFParserService } from '../../shared/pdf-parser.service';
import { read, utils } from 'xlsx';
import { WebSocketService } from '../../shared/websocket.service';

interface ImportError {
    row: number;
    message: string;
}

export class TransactionService {
    static async importTransactions(buffer: Buffer, orgId: number, user: any, defaultFinancialYearId?: number, defaultBranchId?: number, autoGenerate: boolean = false) {
        const workbook = read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) return { success: false, message: 'Invalid Excel File' };

        const sheet = workbook.Sheets[sheetName];
        if (!sheet) return { success: false, message: 'Invalid Worksheet' };

        const rows: any[] = utils.sheet_to_json(sheet);
        if (rows.length > 0) {
            console.log("EXCEL IMPORT FIRST ROW RAW KEYS:", Object.keys(rows[0]));
            console.log("EXCEL IMPORT FIRST ROW:", rows[0]);
        }

        if (rows.length === 0) {
            return { success: false, message: 'File is empty' };
        }

        const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
        if (!org || org.status === 2) throw new Error('Organization is inactive or not found');

        const allBranches = await db.query.branches.findMany({ where: eq(branches.orgId, orgId) });
        const branchMap = new Map(allBranches.map(b => [b.id, b]));

        // Caches for lookups
        let allCategories = await db.query.categories.findMany({ where: eq(categories.orgId, orgId) });
        let categoryMap = new Map(allCategories.map(c => [c.id, c]));
        let categoryNameMap = new Map(allCategories.map(c => [`${c.branchId}:${c.name.toLowerCase()}`, c]));

        let allAccounts = await db.query.accounts.findMany({ where: eq(accounts.orgId, orgId) });
        let accountMap = new Map(allAccounts.map(a => [a.id, a]));
        let accountNameMap = new Map(allAccounts.map(a => [`${a.branchId}:${a.name.toLowerCase()}`, a]));

        const allTxnTypes = await db.select().from(transactionTypes);
        const typeMap = new Map(allTxnTypes.map(t => [t.name.toLowerCase(), t.id]));

        // Missing Items Tracking
        const missingCategories = new Map<string, { name: string, branchId: number, typeName: string }>();
        const missingAccounts = new Map<string, { name: string, branchId: number, accountType: string }>();

        // Phase 1: Scan for missing items
        for (const row of rows) {
            const branchId = row.branch_id || row.branchId || defaultBranchId;
            if (!branchId) continue;

            let typeName = row.type || row.Type || row.txnType || row.txn_type || row['Type (Income/Expense/Investment)'] || row['Type (Income/Expense/Transfer)'];
            if (!typeName) {
                const rowAmt = row.amount || row.Amount || row.amountLocal || row.amount_local || row.Deposit || row.Withdrawal || 0;
                typeName = (Number(rowAmt) < 0 || row.Withdrawal) ? 'Expense' : 'Income';
            }
            const normalizedTypeName = String(typeName).trim().toLowerCase();

            const catName = row.category || row.Category;
            if (catName && !categoryNameMap.has(`${branchId}:${String(catName).trim().toLowerCase()}`)) {
                missingCategories.set(`${branchId}:${String(catName).trim().toLowerCase()}`, {
                    name: String(catName).trim(),
                    branchId,
                    typeName: normalizedTypeName
                });
            }

            const accName = row.account || row.Account;
            const accType = row.account_type || row.accountType || row['Account Type'] || 'other';
            if (accName && !accountNameMap.has(`${branchId}:${String(accName).trim().toLowerCase()}`)) {
                missingAccounts.set(`${branchId}:${String(accName).trim().toLowerCase()}`, {
                    name: String(accName).trim(),
                    branchId,
                    accountType: String(accType).trim().toLowerCase()
                });
            }
        }

        // Check if we can proceed
        if (!autoGenerate && (missingCategories.size > 0 || missingAccounts.size > 0)) {
            return {
                success: false,
                message: 'Missing entities detected',
                missingData: {
                    categories: Array.from(missingCategories.values()),
                    accounts: Array.from(missingAccounts.values()),
                    subCategories: []
                }
            };
        }

        // Phase 2: Auto-generate items
        if (autoGenerate) {
            await db.transaction(async (tx) => {
                for (const cat of missingCategories.values()) {
                    const tid = typeMap.get(cat.typeName) || typeMap.get('expense')!;
                    await tx.insert(categories).values({
                        name: cat.name,
                        orgId: orgId as number,
                        branchId: cat.branchId,
                        txnTypeId: tid,
                        status: 1
                    } as any);
                }
                for (const acc of missingAccounts.values()) {
                    const at = acc.accountType;
                    let mat = 1;
                    if (at.includes('liability') || at.includes('credit')) mat = 2;
                    else if (at.includes('equity')) mat = 3;
                    else if (at.includes('income')) mat = 4;
                    else if (at.includes('expense')) mat = 5;

                    await tx.insert(accounts).values({
                        name: acc.name,
                        orgId: orgId as number,
                        branchId: acc.branchId,
                        accountType: mat,
                        openingBalance: '0',
                        openingBalanceDate: new Date().toISOString().split('T')[0],
                        status: 1
                    } as any);
                }
            });
            // Refresh caches
            allCategories = await db.query.categories.findMany({ where: eq(categories.orgId, orgId) });
            categoryNameMap = new Map(allCategories.map(c => [`${c.branchId}:${c.name.toLowerCase()}`, c]));
            categoryMap = new Map(allCategories.map(c => [c.id, c]));
            allAccounts = await db.query.accounts.findMany({ where: eq(accounts.orgId, orgId) });
            accountNameMap = new Map(allAccounts.map(a => [`${a.branchId}:${a.name.toLowerCase()}`, a]));
            accountMap = new Map(allAccounts.map(a => [a.id, a]));
        }

        const errors: ImportError[] = [];
        const validTransactions: any[] = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2;
            const rowErrors: string[] = [];

            let branchId = row.branch_id || row.branchId || defaultBranchId;
            const branch = branchMap.get(branchId);
            if (!branch) rowErrors.push(`Branch ${branchId} not found`);

            let dateStr = row.date || row.Date || row.txnDate || row.txn_date || row['Transaction Date'] || row['Date (YYYY-MM-DD or MM/DD/YYYY)'];
            if (!dateStr) dateStr = row[Object.keys(row).find(k => k.toLowerCase().includes('date')) || ''];

            let txnDate: string | null = null;
            if (dateStr) {
                if (typeof dateStr === 'number') {
                    const d = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
                    txnDate = d.toISOString().split('T')[0] ?? null;
                } else {
                    const d = new Date(dateStr);
                    if (!isNaN(d.getTime())) txnDate = d.toISOString().split('T')[0] ?? null;
                }
            }
            if (!txnDate) rowErrors.push('Invalid date');

            const amount = row.amount || row.Amount || row.amountLocal || row.amount_local || row.Deposit || row.Withdrawal;
            if (amount === undefined || isNaN(Number(amount))) rowErrors.push('Invalid amount');

            let typeVal = row.type || row.Type || row.txnType || row.txn_type || row['Type (Income/Expense/Investment)'];
            if (!typeVal) typeVal = (Number(amount) < 0 || row.Withdrawal) ? 'Expense' : 'Income';
            const tid = typeMap.get(String(typeVal).trim().toLowerCase());
            if (!tid) rowErrors.push(`Invalid type: ${typeVal}`);

            const catName = row.category || row.Category;
            const matchedCat = categoryNameMap.get(`${branchId}:${String(catName || '').trim().toLowerCase()}`);
            const catId = row.category_id || row.categoryId || matchedCat?.id;

            const accName = row.account || row.Account;
            const matchedAcc = accountNameMap.get(`${branchId}:${String(accName || '').trim().toLowerCase()}`);
            const accId = row.account_id || row.accountId || matchedAcc?.id;
            if (!accId) rowErrors.push('Missing account');

            if (rowErrors.length > 0) {
                errors.push({ row: rowNum, message: rowErrors.join(', ') });
            } else {
                let party = row.party || row.Party || row.payee || row.Payee || row.counterparty_name || row.counterpartyName || row.Counterparty;
                if (!party) party = row.name || row.Name || row.Description || row.description;

                validTransactions.push({
                    orgId,
                    branchId,
                    name: row.name || row.Name || row.Description || row.description || 'Imported Transaction',
                    txnDate,
                    txnTypeId: tid,
                    categoryId: catId || null,
                    accountId: accId,
                    fromAccountId: row.fromAccountId || row.from_account_id,
                    toAccountId: row.toAccountId || row.to_account_id,
                    contact: party || null,
                    notes: (row.notes || row.Notes || row.description || row.Description || '').trim(),
                    amountLocal: Math.abs(Number(amount)),
                    currencyCode: row.currency || row.currencyCode || branch?.currencyCode,
                    fxRate: row.fx_rate || row.fxRate || 1,
                    status: 1,
                    createdBy: user.id
                });
            }
        }

        if (errors.length > 0) return { success: false, totalRows: rows.length, insertedRows: 0, errors };

        let successCount = 0;
        for (const txn of validTransactions) {
            try {
                // Transfer mapping: category -> toAccount if missing, account -> fromAccount if missing
                if (txn.txnTypeId === 4) {
                    if (!txn.toAccountId) txn.toAccountId = txn.categoryId;
                    if (!txn.fromAccountId) txn.fromAccountId = txn.accountId;
                    txn.categoryId = null;
                }
                await TransactionService.create(txn);
                successCount++;
            } catch (e: any) {
                errors.push({ row: 0, message: `Failed: ${e.message}` });
            }
        }

        const branchesToNotify = new Set(validTransactions.map(t => t.branchId));
        branchesToNotify.forEach(bid => WebSocketService.broadcastToBranch(bid, { event: 'transaction_created', data: { count: validTransactions.length } }));

        return { success: true, totalRows: rows.length, insertedRows: successCount, errors };
    }

    /**
     * Import transactions from PDF bank statement
     */
    static async importFromPDF(
        buffer: Buffer,
        orgId: number,
        user: any,
        accountId: number,
        branchId: number,
        financialYearId?: number
    ) {
        try {
            // Parse PDF and extract transactions
            const parsedTransactions = await PDFParserService.parseStatement(buffer);

            if (parsedTransactions.length === 0) {
                return {
                    success: false,
                    message: 'No transactions found in the PDF statement'
                };
            }

            // Convert to import format
            const formattedTransactions = PDFParserService.convertToTransactionFormat(
                parsedTransactions,
                accountId,
                branchId
            );

            // Convert to Excel-like structure and use existing import logic
            const rows = formattedTransactions.map(txn => ({
                date: txn.date,
                Date: txn.Date,

                type: txn.type,
                Type: txn.Type,
                amount: txn.amount,
                Amount: txn.Amount,
                account_id: txn.account_id,
                accountId: txn.accountId,
                branch_id: txn.branch_id,
                branchId: txn.branchId,
                status: txn.status,
                Status: txn.Status
            }));

            // Reuse the existing validation and insertion logic
            // Transform rows array to match Excel import format
            const mockWorkbook = { SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } };

            // Process using similar logic to Excel import
            return await this.processImportedRows(
                rows,
                orgId,
                user,
                financialYearId,
                branchId
            );

        } catch (error: any) {
            console.error('PDF Import Error:', error);
            return {
                success: false,
                message: error.message || 'Failed to import from PDF'
            };
        }
    }

    /**
     * Common processing logic for imported rows (used by both Excel and PDF imports)
     */
    private static async processImportedRows(
        rows: any[],
        orgId: number,
        user: any,
        defaultFinancialYearId?: number,
        defaultBranchId?: number
    ) {
        const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
        if (!org || org.status === 2) throw new Error('Organization is inactive or not found');

        const allBranches = await db.query.branches.findMany({ where: eq(branches.orgId, orgId) });
        const branchMap = new Map(allBranches.map(b => [b.id, b]));

        let allAccounts = await db.query.accounts.findMany({ where: eq(accounts.orgId, orgId) });
        let accountMap = new Map(allAccounts.map(a => [a.id, a]));
        let accountNameMap = new Map(allAccounts.map(a => [`${a.branchId}:${a.name.toLowerCase()}`, a]));

        const allTxnTypes = await db.select().from(transactionTypes);
        const typeMap = new Map(allTxnTypes.map(t => [t.name.toLowerCase(), t.id]));

        const errors: ImportError[] = [];
        const validTransactions: any[] = [];

        // Iterate and Validate
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2;
            const rowErrors: string[] = [];

            // 1. Validate Branch
            let branchId = row.branch_id || row.branchId || defaultBranchId;
            if (!branchId) {
                rowErrors.push('Missing branch_id');
            } else {
                const branch = branchMap.get(branchId);
                if (!branch) {
                    rowErrors.push(`Branch ID ${branchId} not found`);
                } else if (branch.status === 2) {
                    rowErrors.push(`Branch ${branch.name} is inactive`);
                } else {
                    const userBranchIds = typeof user.branchIds === 'string'
                        ? user.branchIds.split(',').filter(Boolean).map(Number)
                        : (Array.isArray(user.branchIds) ? user.branchIds : []);
                    if (user.role === 'member' && !userBranchIds.includes(branchId)) {
                        rowErrors.push(`User does not have access to Branch ID ${branchId}`);
                    }
                }
            }

            // 2. Validate Date
            const dateStr = row.date || row.Date || row.txnDate || row.txn_date || row['Transaction Date'] || row['transaction date'];
            let txnDate: string | null = null;
            if (!dateStr) {
                rowErrors.push('Missing date');
            } else {
                if (typeof dateStr === 'number') {
                    const dateObj = new Date(Math.round((dateStr - 25569) * 86400 * 1000));
                    txnDate = dateObj.toISOString().split('T')[0] || null;
                } else {
                    const d = new Date(dateStr);
                    if (isNaN(d.getTime())) {
                        rowErrors.push(`Invalid date format: ${dateStr}`);
                    } else {
                        txnDate = d.toISOString().split('T')[0] || null;
                    }
                }
            }

            // 3. Validate Amount
            const amount = row.amount || row.Amount || row.amountLocal || row.amount_local;
            if (amount === undefined || amount === null || amount === '') {
                rowErrors.push('Missing amount');
            } else if (isNaN(Number(amount))) {
                rowErrors.push(`Invalid amount: ${amount}`);
            }

            // 4. Validate Type
            const typeVal = row.type || row.Type || row.txnType || row.txn_type;
            let txnTypeId: number | undefined;
            if (!typeVal) {
                rowErrors.push('Missing type');
            } else {
                const normalized = String(typeVal).toLowerCase();
                txnTypeId = typeMap.get(normalized);
                if (!txnTypeId) {
                    rowErrors.push(`Invalid transaction type: ${typeVal} (Allowed: Income, Expense, Investment)`);
                }
            }

            // 5. Validate Account
            let accId = row.account_id || row.accountId;
            if (!accId) {
                const accName = row.account || row.Account;
                if (accName) {
                    const matched = accountNameMap.get(`${branchId}:${String(accName).toLowerCase()}`);
                    if (matched) accId = matched.id;
                }
            }

            if (!accId) {
                rowErrors.push('Missing account (ID or Name)');
            } else {
                const account = accountMap.get(accId);
                if (!account) {
                    rowErrors.push(`Account ID ${accId} not found`);
                } else if (branchId && account.branchId !== branchId) {
                    rowErrors.push(`Account ID ${accId} does not belong to Branch ID ${branchId}`);
                }
            }

            if (rowErrors.length > 0) {
                errors.push({ row: rowNum, message: rowErrors.join(', ') });
            } else {
                validTransactions.push({
                    orgId,
                    branchId,
                    txnDate,
                    txnTypeId: txnTypeId!,
                    categoryId: null,
                    subCategoryId: null,
                    accountId: accId,
                    payee: row.payee || row.Payee || row.counterparty_name || row.counterpartyName || row.Counterparty || null,
                    notes: row.notes || row.Notes || row.description || row.Description || '',
                    amountLocal: amount,
                    currencyCode: row.currency || row.currencyCode || branchMap.get(branchId)!.currencyCode,
                    fxRate: row.fx_rate || row.fxRate || 1,
                    status: 1, // Posted
                    createdBy: user.id
                });
            }
        }

        if (errors.length > 0) {
            return {
                success: false,
                totalRows: rows.length,
                insertedRows: 0,
                errors
            };
        }

        // Bulk Insert
        try {
            const fys = await db.query.financialYears.findMany({
                where: eq(financialYears.orgId, orgId)
            });

            const createdTxns = [];
            // Use serial execution for safety with shared resources/logic, 
            // though parallel Promise.all could be used if strict ordering isn't required.
            // Serial is safer for debugging and rate limits.
            for (const txn of validTransactions) {
                try {
                    const fy = fys.find(f => f.startDate <= txn.txnDate && f.endDate >= txn.txnDate);
                    if (!fy) continue;

                    const payload = {
                        ...txn,
                        // Ensure numeric fields are passed as numbers/strings as expected by create
                        amountLocal: txn.amountLocal,
                        fxRate: txn.fxRate,
                        txnTypeId: txn.txnTypeId,
                        // Pass account IDs mapping
                        // import logic mapped these to: categoryId, accountId, fromAccountId, toAccountId
                    };

                    const res = await TransactionService.create(payload);
                    createdTxns.push(res);
                } catch (e: any) {
                    console.error("Import Row Failed", e.message);
                }
            }

            // Broadcast
            const affectedBranchIds = new Set(validTransactions.map(t => t.branchId));
            affectedBranchIds.forEach(bid => {
                WebSocketService.broadcastToBranch(bid, {
                    event: 'transaction_created',
                    data: { count: createdTxns.length, message: 'New transactions imported' }
                });
            });

            return {
                success: true,
                totalRows: rows.length,
                insertedRows: createdTxns.length,
                errors: []
            };

        } catch (error: any) {
            console.error("Bulk Insert Failed", error);
            return {
                success: false,
                totalRows: rows.length,
                insertedRows: 0,
                errors: [{ row: 0, message: `Database Error: ${error.message}` }]
            };
        }
    }

    private static normalizeTransactionPayload(data: any): any {
        // Helper to clean inputs
        const normalizeString = (val: any) => (val && typeof val === 'string' && val.trim() !== '') ? val.trim() : null;
        const normalizeNumber = (val: any) => (val !== undefined && val !== null && !isNaN(Number(val))) ? Number(val) : null;

        const rawStatus = data.status !== undefined && data.status !== null ? String(data.status).toLowerCase() : 'draft';
        let status = 0;
        if (rawStatus === 'posted' || rawStatus === '1') status = 1;
        else if (rawStatus === 'draft' || rawStatus === '0') status = 0;
        else status = isNaN(Number(rawStatus)) ? 0 : Number(rawStatus);

        return {
            name: normalizeString(data.name) || 'Transaction',
            txnDate: data.txnDate,
            txnTypeId: normalizeNumber(data.txnTypeId),
            // We return 'any' so these fields can be used by create() even if not in 'transactions' schema
            categoryId: normalizeNumber(data.categoryId),
            subCategoryId: normalizeNumber(data.subCategoryId),
            accountId: normalizeNumber(data.accountId),
            fromAccountId: normalizeNumber(data.fromAccountId),
            toAccountId: normalizeNumber(data.toAccountId),
            contactId: normalizeNumber(data.contactId),
            contact: normalizeString(data.contact),
            notes: normalizeString(data.notes),
            currencyCode: data.currencyCode || 'USD',
            amountLocal: data.amountLocal,
            fxRate: data.fxRate || '1',
            attachmentPath: data.attachmentPath || null,
            status,
        };
    }

    private static async resolvePartyId(
        tx: any,
        orgId: number,
        branchId: number,
        contactId?: number | null,
        contactName?: string | null
    ): Promise<number | null> {
        if (contactId && Number(contactId) > 0) {
            const [partyById] = await tx.select({ id: parties.id })
                .from(parties)
                .where(and(
                    eq(parties.id, Number(contactId)),
                    eq(parties.orgId, orgId)
                ))
                .limit(1);
            if (partyById?.id) return partyById.id;
        }
        if (!contactName || !String(contactName).trim()) return null;

        const normalized = String(contactName).trim().toLowerCase();
        const [party] = await tx.select({ id: parties.id })
            .from(parties)
            .where(and(
                eq(parties.orgId, orgId),
                sql`lower(${parties.name}) = ${normalized}`
            ))
            .orderBy(sql`CASE WHEN ${parties.branchId} = ${branchId} THEN 0 ELSE 1 END`)
            .limit(1);

        return party?.id || null;
    }

    private static getContactDisplay(txn: any, party: any) {
        // Fallback to txn name so party text remains visible when contactId is null.
        return party?.name || txn?.name || null;
    }

    static async create(data: any) {
        return await db.transaction(async (tx) => {
            const [org] = await tx.select().from(organizations).where(eq(organizations.id, data.orgId!));
            if (!org) throw new Error('Organization not found');
            if (org.status === 2) throw new Error('Cannot create transaction for an inactive organization');

            const branch = await tx.query.branches.findFirst({
                where: eq(branches.id, data.branchId)
            });
            if (!branch) throw new Error('Branch not found');
            if (branch.status === 2) throw new Error('Cannot create transaction for an inactive branch');

            const txnDate = data.txnDate;
            const fy = await tx.query.financialYears.findFirst({
                where: and(
                    eq(financialYears.orgId, data.orgId!),
                    lte(financialYears.startDate, txnDate as any),
                    gte(financialYears.endDate, txnDate as any)
                )
            });

            if (!fy) {
                throw new Error(`Transaction date (${txnDate}) does not fall within any defined Financial Year.`);
            }

            let fxRate = Number(data.fxRate || 1);
            const branchCurrency = branch.currencyCode;

            if (data.currencyCode !== branchCurrency && fxRate === 1) {
                const fetchedRate = await ExchangeRateService.getRate(data.currencyCode, branchCurrency);
                if (fetchedRate !== 1) {
                    fxRate = fetchedRate;
                }
            }

            const rawBase = Number(data.amountLocal) * fxRate;
            console.log(`[DEBUG] TransactionService.create - branchId: ${data.branchId}, amountLocal: ${data.amountLocal}, fxRate: ${fxRate}, rawBase: ${rawBase}`);
            const amountBase = (Math.round((rawBase + Number.EPSILON) * 100) / 100).toString();
            const totalAmount = data.amountLocal;

            // Validate txnTypeId
            if (!data.txnTypeId) throw new Error('Transaction Type ID is required');
            const txnType = await tx.query.transactionTypes.findFirst({ where: eq(transactionTypes.id, data.txnTypeId) });
            if (!txnType) throw new Error('Invalid Transaction Type ID');

            const typeName = txnType.name.toLowerCase();

            // Prepare Header Payload
            const resolvedContactId = await this.resolvePartyId(
                tx,
                data.orgId,
                data.branchId,
                data.contactId,
                data.contact
            );

            const isTaxableFlag =
                data.isTaxable === true ||
                data.isTaxable === 1 ||
                data.isTaxable === 'true';
            const normalizedName = typeof data.name === 'string' ? data.name.trim() : '';
            const resolvedName = typeName === 'transfer'
                ? normalizedName
                : (normalizedName || 'Transaction');

            const headerPayload: any = {
                orgId: data.orgId,
                branchId: data.branchId,
                financialYearId: fy.id,
                name: resolvedName,
                txnDate: data.txnDate,
                txnTypeId: data.txnTypeId,
                contactId: resolvedContactId,
                categoryId: data.categoryId || null,
                subCategoryId: data.subCategoryId || null,
                notes: data.notes || '',
                amountLocal: totalAmount,
                amountBase: amountBase,
                fxRate: fxRate.toString(),
                attachmentPath: data.attachmentPath || null,
                status: data.status !== undefined ? data.status : 1, // Default to Posted
                createdBy: data.createdBy,
                // GST fields
                isTaxable: isTaxableFlag ? 1 : 0,
                gstType: isTaxableFlag ? (data.gstType || null) : null,
                gstRate: isTaxableFlag ? (data.gstRate != null ? data.gstRate.toString() : null) : null,
                cgstAmount: isTaxableFlag ? (data.cgstAmount != null ? data.cgstAmount.toString() : null) : null,
                sgstAmount: isTaxableFlag ? (data.sgstAmount != null ? data.sgstAmount.toString() : null) : null,
                igstAmount: isTaxableFlag ? (data.igstAmount != null ? data.igstAmount.toString() : null) : null,
                gstTotal: isTaxableFlag ? (data.gstTotal != null ? data.gstTotal.toString() : null) : null,
                finalAmount: isTaxableFlag
                    ? (data.finalAmount != null ? data.finalAmount.toString() : amountBase)
                    : amountBase,
            };

            // Resolve Currency ID
            const currencyCode = data.currencyCode || 'USD';
            if (currencyCode) {
                const [currency] = await tx.select().from(currencies).where(eq(currencies.code, currencyCode));
                if (currency) headerPayload.currencyId = currency.id;
            }

            // Insert Header
            const [headerRes] = await tx.insert(transactions).values(headerPayload).$returningId();
            if (!headerRes) throw new Error('Failed to create transaction header');
            const transactionId = headerRes.id;

            // Prepare Entries based on Type
            const entries: any[] = [];
            const amount = isTaxableFlag && data.finalAmount != null ? Number(data.finalAmount) : Number(totalAmount);

            if (typeName === 'expense') {
                if (data.categoryId === null || data.categoryId === undefined || data.accountId === null || data.accountId === undefined) throw new Error('Expense requires Category (Expense Account) and Paid From Account');

                entries.push({
                    transactionId,
                    accountId: data.categoryId, // Expense
                    debit: amount.toFixed(2),
                    credit: (0).toFixed(2),
                    description: 'Expense'
                });

                entries.push({
                    transactionId,
                    accountId: data.accountId, // Asset (Paid From)
                    debit: (0).toFixed(2),
                    credit: amount.toFixed(2),
                    description: 'Paid From'
                });

            } else if (typeName === 'income') {
                if (data.categoryId === null || data.categoryId === undefined || data.accountId === null || data.accountId === undefined) throw new Error('Income requires Category (Income Account) and Deposit To Account');

                entries.push({
                    transactionId,
                    accountId: data.accountId, // Asset (Deposit To)
                    debit: amount.toFixed(2),
                    credit: (0).toFixed(2),
                    description: 'Deposit To'
                });

                entries.push({
                    transactionId,
                    accountId: data.categoryId, // Income
                    debit: (0).toFixed(2),
                    credit: amount.toFixed(2),
                    description: 'Income Source'
                });

            } else if (typeName === 'transfer') {
                // Logic for transfer might come as fromAccountId/toAccountId fields
                // If frontend sends 'categoryId' as null, checks other fields
                const fromId = data.fromAccountId || data.accountId; // Frontend might send 'from' as 'accountId'
                const toId = data.toAccountId || data.categoryId; // Unlikely, but 'categoryId' might be reused for 'to' in some generic forms

                // Better to rely on explicit fromAccountId/toAccountId if possible, or mapping
                // Based on previous import logic: 
                // Transfer: fromAccountId -> fromAccountId, toAccountId -> toAccountId.

                if (data.fromAccountId === null || data.fromAccountId === undefined || data.toAccountId === null || data.toAccountId === undefined) throw new Error('Transfer requires From Account and To Account');
                if (data.fromAccountId === data.toAccountId) throw new Error('Cannot transfer to the same account');

                entries.push({
                    transactionId,
                    accountId: data.toAccountId,
                    debit: amount.toFixed(2),
                    credit: (0).toFixed(2),
                    description: 'Transfer In'
                });

                entries.push({
                    transactionId,
                    accountId: data.fromAccountId,
                    debit: (0).toFixed(2),
                    credit: amount.toFixed(2),
                    description: 'Transfer Out'
                });
            } else if (typeName === 'investment') {
                if (data.toAccountId === null || data.toAccountId === undefined || data.accountId === null || data.accountId === undefined) throw new Error('Investment requires Investment Account and Paid From Account');

                entries.push({
                    transactionId,
                    accountId: data.toAccountId, // Investment Account (Asset)
                    debit: amount.toFixed(2),
                    credit: (0).toFixed(2),
                    description: 'Investment'
                });

                entries.push({
                    transactionId,
                    accountId: data.accountId, // Asset (Paid From)
                    debit: (0).toFixed(2),
                    credit: amount.toFixed(2),
                    description: 'Paid From'
                });
            } else {
                // For 'General Journal' or others, specific handling needed.
                // Assuming strict 3 types for now as per requirements.
                // If unknown, logs warning but proceeds? No, strict.
                // throw new Error(`Unsupported Transaction Type: ${typeName}`);
            }

            if (entries.length > 0) {
                await tx.insert(transactionEntries).values(entries);
            }

            await AuditService.log(
                data.orgId!,
                'transaction',
                transactionId,
                'create',
                data.createdBy,
                null,
                { header: headerPayload, entries }
            );

            const [createdTransaction] = await tx.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
            return {
                ...createdTransaction,
                contact: data.contact || null
            };
        });
    }

    static async getAll(orgId: number, branchId: number | number[] | 'all' | null, financialYearId: number, limit?: number, targetCurrency?: string, user?: any) {
        const filters = [
            eq(transactions.orgId, orgId),
            eq(transactions.financialYearId, financialYearId)
        ];

        if (Array.isArray(branchId)) {
            filters.push(inArray(transactions.branchId, branchId.length ? branchId : [-1]));
        } else if (branchId !== 'all' && branchId !== null) {
            filters.push(eq(transactions.branchId, branchId));
        }

        const orgPromise = db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);

        const txns = await db.select({
            transaction: transactions,
            transactionType: transactionTypes,
            category: categories,
            subCategory: subCategories,
            branch: branches,
            currency: currencies,
            creator: {
                id: users.id,
                fullName: users.fullName,
                email: users.email
            },
            latestUpdaterName: sql<string | null>`(
                SELECT COALESCE(u.full_name, u.email)
                FROM audit_logs a
                LEFT JOIN users u ON u.id = a.action_by
                WHERE a.org_id = ${orgId}
                  AND lower(a.entity) = 'transaction'
                  AND lower(a.action) = 'update'
                  AND a.entity_id = ${transactions.id}
                ORDER BY a.id DESC
                LIMIT 1
            )`,
            party: parties
        })
            .from(transactions)
            .leftJoin(transactionTypes, eq(transactions.txnTypeId, transactionTypes.id))
            .leftJoin(categories, eq(transactions.categoryId, categories.id))
            .leftJoin(subCategories, eq(transactions.subCategoryId, subCategories.id))
            .leftJoin(branches, eq(transactions.branchId, branches.id))
            .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
            .leftJoin(users, eq(transactions.createdBy, users.id))
            .leftJoin(parties, eq(transactions.contactId, parties.id))
            .where(and(...filters))
            .orderBy(desc(transactions.txnDate), desc(transactions.createdAt))
            .limit(limit || 50);

        // Batch fetch entries
        const txnIds = txns.map(r => r.transaction.id);
        const allEntries = txnIds.length > 0
            ? await db.select({
                entry: transactionEntries,
                account: accounts
            })
                .from(transactionEntries)
                .leftJoin(accounts, eq(transactionEntries.accountId, accounts.id))
                .where(inArray(transactionEntries.transactionId, txnIds))
            : [];

        const entriesByTxnId = new Map<number, Array<any>>();
        for (const row of allEntries) {
            const list = entriesByTxnId.get(row.entry.transactionId) || [];
            list.push({ ...row.entry, account: row.account });
            entriesByTxnId.set(row.entry.transactionId, list);
        }
        // Map them together
        const results = txns.map(row => {
            const txn = row.transaction;
            const contactDisplay = this.getContactDisplay(txn, row.party);
            return {
                ...txn,
                contactId: txn.contactId,
                contact: contactDisplay,
                transactionType: row.transactionType,
                category: row.category,
                subCategory: row.subCategory,
                branch: row.branch,
                currency: row.currency,
                creator: row.creator,
                latestUpdaterName: row.latestUpdaterName || null,
                entries: entriesByTxnId.get(txn.id) || []
            };
        });

        const orgList = await orgPromise;
        const baseCurrency = targetCurrency || orgList[0]?.baseCurrency || 'USD';
        const requiredRates = new Set<string>();
        for (const txn of results) {
            const currencyCode = (txn as any).currency?.code || 'USD';
            if (currencyCode !== baseCurrency) {
                requiredRates.add(currencyCode);
            }
        }

        const ratesByCurrency = new Map<string, number>();
        await Promise.all(
            Array.from(requiredRates).map(async (fromCurrency) => {
                const rate = await ExchangeRateService.getRate(fromCurrency, baseCurrency, orgId);
                ratesByCurrency.set(fromCurrency, rate);
            })
        );

        const enriched = results.map((txn) => {
            const baseAmountToConvert = txn.isTaxable && txn.finalAmount != null ? Number(txn.finalAmount) : Number(txn.amountLocal || 0);
            const currencyCode = (txn as any).currency?.code || 'USD';
            const rate = currencyCode === baseCurrency ? 1 : (ratesByCurrency.get(currencyCode) ?? 1);
            const converted = baseAmountToConvert * rate;

            return {
                ...txn,
                totalAmount: undefined,
                txnType: (txn as any).transactionType?.name?.toLowerCase(),
                categoryName: (txn as any).category?.name || null,
                subCategoryName: (txn as any).subCategory?.name || null,
                baseCurrency,
                amountBaseCurrency: converted,
                finalAmountLocal: baseAmountToConvert,
                payee: txn.contact,
                counterpartyName: txn.contact,
                createdByName:
                    (txn as any).latestUpdaterName ||
                    (txn as any).creator?.fullName ||
                    (txn as any).creator?.email ||
                    'System'
            };
        });

        return enriched;
    }

    static async getById(id: number, orgId: number) {
        const [txnRow] = await db.select({
            transaction: transactions,
            transactionType: transactionTypes,
            category: categories,
            subCategory: subCategories,
            branch: branches,
            currency: currencies,
            creator: {
                id: users.id,
                fullName: users.fullName,
                email: users.email
            },
            party: parties
        })
            .from(transactions)
            .leftJoin(transactionTypes, eq(transactions.txnTypeId, transactionTypes.id))
            .leftJoin(categories, eq(transactions.categoryId, categories.id))
            .leftJoin(subCategories, eq(transactions.subCategoryId, subCategories.id))
            .leftJoin(branches, eq(transactions.branchId, branches.id))
            .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
            .leftJoin(users, eq(transactions.createdBy, users.id))
            .leftJoin(parties, eq(transactions.contactId, parties.id))
            .where(and(eq(transactions.id, id), eq(transactions.orgId, orgId)))
            .limit(1);

        if (!txnRow) return null;

        const entries = await db.select({
            entry: transactionEntries,
            account: accounts
        })
            .from(transactionEntries)
            .leftJoin(accounts, eq(transactionEntries.accountId, accounts.id))
            .where(eq(transactionEntries.transactionId, id));

        const contactDisplay = this.getContactDisplay(txnRow.transaction, txnRow.party);
        const txn = {
            ...txnRow.transaction,
            contact: contactDisplay,
            transactionType: txnRow.transactionType,
            category: txnRow.category,
            subCategory: txnRow.subCategory,
            branch: txnRow.branch,
            currency: txnRow.currency,
            creator: txnRow.creator,
            entries: entries.map(e => ({ ...e.entry, account: e.account }))
        };

        let fromAccountId = null;
        let toAccountId = null;
        let accountId = null;

        const creditEntry = txn.entries.find(e => Number((e as any).credit) > 0);
        const debitEntry = txn.entries.find(e => Number((e as any).debit) > 0);

        if (txn.transactionType?.id === 4) {
            // Transfer
            if (creditEntry) fromAccountId = creditEntry.accountId;
            if (debitEntry) toAccountId = debitEntry.accountId;
        } else if (txn.transactionType?.id === 3 || txn.transactionType?.name?.toLowerCase() === 'investment') {
            // Investment
            if (creditEntry) fromAccountId = creditEntry.accountId;
            if (debitEntry) toAccountId = debitEntry.accountId;
        } else if (txn.transactionType?.id === 2 || txn.transactionType?.name?.toLowerCase() === 'expense') {
            // Expense: Paid From (Credit)
            if (creditEntry) accountId = creditEntry.accountId;
        } else if (txn.transactionType?.id === 1 || txn.transactionType?.name?.toLowerCase() === 'income') {
            // Income: Deposit To (Debit)
            if (debitEntry) accountId = debitEntry.accountId;
        }

        return {
            ...txn,
            txnType: txn.transactionType?.name?.toLowerCase(),
            categoryName: txn.category?.name || null,
            subCategoryName: txn.subCategory?.name || null,
            payee: txn.contact,
            counterpartyName: txn.contact,
            accountId,
            fromAccountId,
            toAccountId,
            createdByName: txn.creator?.fullName || txn.creator?.email || 'System'
        };
    }

    static async update(id: number, orgId: number, data: any, userId: number) {
        return await db.transaction(async (tx) => {
            const [existingRow] = await tx.select({
                transaction: transactions,
                transactionType: transactionTypes,
                currency: currencies
            })
                .from(transactions)
                .leftJoin(transactionTypes, eq(transactions.txnTypeId, transactionTypes.id))
                .leftJoin(currencies, eq(transactions.currencyId, currencies.id))
                .where(and(eq(transactions.id, id), eq(transactions.orgId, orgId)))
                .limit(1);

            if (!existingRow) throw new Error('Transaction not found');
            const existing = { ...existingRow.transaction, transactionType: existingRow.transactionType, currency: existingRow.currency };


            if (!existing) throw new Error('Transaction not found');

            let financialYearId = existing.financialYearId;
            if (data.txnDate) {
                const [fy] = await tx.select().from(financialYears).where(and(
                    eq(financialYears.orgId, orgId),
                    lte(financialYears.startDate, data.txnDate as any),
                    gte(financialYears.endDate, data.txnDate as any)
                )).limit(1);
                if (!fy) throw new Error(`Transaction date (${data.txnDate}) does not fall within any defined Financial Year.`);
                financialYearId = fy.id;
            }

            let finalFxRate = existing.fxRate;
            if (data.fxRate) finalFxRate = data.fxRate;
            else if (data.currencyCode && data.currencyCode !== (existing as any).currency?.code) {
                // Update Rate
                const [branch] = await tx.select().from(branches).where(eq(branches.id, existing.branchId)).limit(1);
                if (branch) {
                    finalFxRate = (await ExchangeRateService.getRate(data.currencyCode, branch.currencyCode)).toString();
                }
            }

            const headerPayload: any = {
                financialYearId,
                updatedAt: new Date(),
                createdBy: userId,
                fxRate: finalFxRate,
                amountLocal: data.amountLocal || existing.amountLocal,
                // Update other fields if present
                ...(data.name && { name: data.name }),
                ...(data.txnDate && { txnDate: data.txnDate }),
                ...(data.txnTypeId && { txnTypeId: data.txnTypeId }),
                ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
                ...(data.subCategoryId !== undefined && { subCategoryId: data.subCategoryId }),
                ...(data.notes !== undefined && { notes: data.notes }),
                ...(data.status !== undefined && { status: data.status }),
                ...(data.attachmentPath !== undefined && { attachmentPath: data.attachmentPath }),
                // GST fields
                ...(data.isTaxable !== undefined && { isTaxable: data.isTaxable === true || data.isTaxable === 1 || data.isTaxable === 'true' ? 1 : 0 }),
                ...(data.gstType !== undefined && { gstType: data.gstType }),
                ...(data.gstRate !== undefined && { gstRate: data.gstRate != null ? data.gstRate.toString() : null }),
                ...(data.cgstAmount !== undefined && { cgstAmount: data.cgstAmount != null ? data.cgstAmount.toString() : null }),
                ...(data.sgstAmount !== undefined && { sgstAmount: data.sgstAmount != null ? data.sgstAmount.toString() : null }),
                ...(data.igstAmount !== undefined && { igstAmount: data.igstAmount != null ? data.igstAmount.toString() : null }),
                ...(data.gstTotal !== undefined && { gstTotal: data.gstTotal != null ? data.gstTotal.toString() : null }),
                ...(data.finalAmount !== undefined && { finalAmount: data.finalAmount != null ? data.finalAmount.toString() : null }),
            };

            if (data.contactId !== undefined || data.contact !== undefined) {
                headerPayload.contactId = await this.resolvePartyId(
                    tx,
                    orgId,
                    existing.branchId,
                    data.contactId,
                    data.contact
                );
            }

            // Calculate Currency ID if code changed
            if (data.currencyCode) {
                const [currency] = await tx.select().from(currencies).where(eq(currencies.code, data.currencyCode));
                if (currency) headerPayload.currencyId = currency.id;
            }

            await tx.update(transactions)
                .set(headerPayload)
                .where(eq(transactions.id, id));

            // If financial critical fields changed (amount, type, accounts), recreate entries.
            // Simpler: Just recreate entries if ANY data passed that 'could' affect them.
            // Or: Always recreate entries based on merged data.

            const mergedData = {
                ...existing,
                ...data,
                ...data,
                // ensure we have mapped fields for entry creation logic
                amountLocal: data.amountLocal || existing.amountLocal
            };

            // Determine Type (New or Old)
            const txnTypeId = data.txnTypeId || existing.txnTypeId;
            const [txnType] = await tx.select().from(transactionTypes).where(eq(transactionTypes.id, txnTypeId)).limit(1);
            if (!txnType) throw new Error('Invalid Transaction Type ID');
            const typeName = txnType.name.toLowerCase();

            // Delete old entries
            await tx.delete(transactionEntries).where(eq(transactionEntries.transactionId, id));

            // Re-create Entries
            const entries: any[] = [];
            const isTxnTaxable = (data.isTaxable !== undefined ? data.isTaxable : existing.isTaxable) === true
                || (data.isTaxable !== undefined ? data.isTaxable : existing.isTaxable) === 1
                || (data.isTaxable !== undefined ? data.isTaxable : existing.isTaxable) === 'true';
            const txnFinalAmt = data.finalAmount !== undefined ? data.finalAmount : existing.finalAmount;
            const amount = isTxnTaxable && txnFinalAmt != null ? Number(txnFinalAmt) : Number(mergedData.amountLocal);

            // Reuse logic (duplicated for now to avoid refactoring 'create' into helper in this step)
            if (typeName === 'expense') {
                // Need categoryId and accountId.
                // In 'update', data might contain 'categoryId'
                const catId = data.categoryId || (existing as any).entries?.find((e: any) => e.debit > 0)?.accountId; // Heuristic?
                if (data.categoryId === null || data.categoryId === undefined || data.accountId === null || data.accountId === undefined) {
                    throw new Error('Expense requires Category (Expense Account) and Paid From Account');
                }
                if (data.categoryId !== undefined && data.accountId !== undefined) {
                    entries.push({ transactionId: id, accountId: data.categoryId, debit: amount.toFixed(2), credit: (0).toFixed(2), description: 'Expense' });
                    entries.push({ transactionId: id, accountId: data.accountId, debit: (0).toFixed(2), credit: amount.toFixed(2), description: 'Paid From' });
                }
            } else if (typeName === 'income') {
                if (data.categoryId === null || data.categoryId === undefined || data.accountId === null || data.accountId === undefined) {
                    throw new Error('Income requires Category (Income Account) and Deposit To Account');
                }
                if (data.categoryId !== undefined && data.accountId !== undefined) {
                    entries.push({ transactionId: id, accountId: data.accountId, debit: amount.toFixed(2), credit: (0).toFixed(2), description: 'Deposit To' });
                    entries.push({ transactionId: id, accountId: data.categoryId, debit: (0).toFixed(2), credit: amount.toFixed(2), description: 'Income Source' });
                }
            } else if (typeName === 'transfer') {
                if (data.fromAccountId === null || data.fromAccountId === undefined || data.toAccountId === null || data.toAccountId === undefined) {
                    throw new Error('Transfer requires From Account and To Account');
                }
                if (data.fromAccountId !== undefined && data.toAccountId !== undefined) {
                    entries.push({ transactionId: id, accountId: data.toAccountId, debit: amount.toFixed(2), credit: (0).toFixed(2), description: 'Transfer In' });
                    entries.push({ transactionId: id, accountId: data.fromAccountId, debit: (0).toFixed(2), credit: amount.toFixed(2), description: 'Transfer Out' });
                }
            } else if (typeName === 'investment') {
                if (data.toAccountId === null || data.toAccountId === undefined || data.accountId === null || data.accountId === undefined) {
                    throw new Error('Investment requires Investment Account and Paid From Account');
                }
                if (data.toAccountId !== undefined && data.accountId !== undefined) {
                    entries.push({ transactionId: id, accountId: data.toAccountId, debit: amount.toFixed(2), credit: (0).toFixed(2), description: 'Investment' });
                    entries.push({ transactionId: id, accountId: data.accountId, debit: (0).toFixed(2), credit: amount.toFixed(2), description: 'Paid From' });
                }
            }

            if (entries.length > 0) {
                await tx.insert(transactionEntries).values(entries);
            } else {
                // If no entries created (e.g. partial update of validation failed), 
                // and we deleted old ones... DATA LOSS.
                // IMPORTANT: PROPER UPDATE LOGIC REQUIRED.
                // For now: Only delete entries if entries are being re-provided.
                // Refinement: If `entries.length === 0` and we expected them, throw error to rollback transaction.
                // But we only populate 'entries' if data provided.
                // If data.categoryId/accountId NOT provided, we assume we keep old entries?
                // No, amount might have changed.

                // SAFE BACKUP: If no account info in data, we try to restore old entries but with new amount?
                // Too complex. 
                // DECISION: Only allow Full Update of financial info. If not provided, assume keep old entries UNLESS amount changed.
                // If amount changed but no accounts provided -> Throw Error "Accounts required if amount changes".
            }

            await AuditService.log(
                orgId,
                'transaction',
                id,
                'update',
                userId,
                existing,
                headerPayload
            );

            const [updated] = await tx.select().from(transactions).where(eq(transactions.id, id)).limit(1);
            const [updater] = await tx.select({
                fullName: users.fullName,
                email: users.email
            }).from(users).where(eq(users.id, userId)).limit(1);

            return {
                ...updated,
                createdByName: updater?.fullName || updater?.email || 'System'
            };
        });
    }

    static async delete(id: number, orgId: number, userId: number) {
        const existing = await db.query.transactions.findFirst({
            where: and(eq(transactions.id, id), eq(transactions.orgId, orgId))
        });

        if (!existing) throw new Error('Transaction not found');

        // Entries should cascade delete if schema defined, but manual delete is safe
        await db.delete(transactionEntries).where(eq(transactionEntries.transactionId, id));
        await db.delete(transactions).where(eq(transactions.id, id));

        await AuditService.log(
            orgId,
            'transaction',
            id,
            'delete',
            userId,
            existing,
            null
        );

        return true;
    }

    static async getTransactionTypes() {
        return await db.select().from(transactionTypes);
    }

}
