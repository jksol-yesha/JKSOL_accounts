import { TransactionService } from './transactions.service';
import { db } from '../../db';
import { transactions } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import type { ElysiaContext } from '../../shared/auth.middleware';
import { WebSocketService } from '../../shared/websocket.service';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { resolve } from 'node:path';
import { isNotDeleted } from '../../shared/soft-delete';

const transactionUploadsDir = resolve(import.meta.dir, '../../../uploads/transactions');

// GET /:id - Fetch single transaction
export const getTransaction = async ({ params, set, user, orgId }: ElysiaContext & { params: { id: string } }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");
    try {
        const id = Number(params.id);
        const transaction = await TransactionService.getById(id, orgId);
        if (!transaction) {
            set.status = 404;
            return { success: false, message: 'Transaction not found' };
        }

        // Branch access check for MEMBERS
        if (user.role === 'member' && !user.branchIds.includes(transaction.branchId || 0)) {
            set.status = 403;
            return { success: false, message: 'Forbidden: You do not have access to this branch' };
        }

        return { success: true, data: transaction };
    } catch (error: any) {
        console.error('Get Transaction Error:', error);
        set.status = 404;
        return { success: false, message: error.message || 'Transaction not found' };
    }
};

const processAttachment = async (rawAttachment: any): Promise<string | null> => {
    if (!rawAttachment) return null;

    // If it's already a string (URL/Path), return it
    if (typeof rawAttachment === 'string') return rawAttachment;

    const file = rawAttachment;
    const isBlob = file instanceof Blob;
    const hasArrayBuffer = typeof file.arrayBuffer === 'function';
    const hasSize = file.size !== undefined;
    const hasName = !!file.name;

    if (isBlob || hasArrayBuffer || (hasName && hasSize)) {
        if (!fs.existsSync(transactionUploadsDir)) {
            fs.mkdirSync(transactionUploadsDir, { recursive: true });
        }

        const uniqueSuffix = crypto.randomUUID();
        const filename = `${uniqueSuffix}-${file.name || 'upload'}`;
        const path = resolve(transactionUploadsDir, filename);

        await Bun.write(path, file);
        return `/uploads/transactions/${filename}`;
    }

    return null;
};

export const createTransaction = async ({ body, set, user, orgId, branchId }: ElysiaContext & { body: any }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");
    try {
        const { financialYearId, attachments, ...data } = body;
        const effectiveBranchId = data.branchId ? Number(data.branchId) : null;

        if (!effectiveBranchId || isNaN(Number(effectiveBranchId))) {
            set.status = 400;
            return { success: false, message: 'A specific Branch ID is required for this operation' };
        }

        const bid = Number(effectiveBranchId);

        if (user.role === 'member' && !user.branchIds.includes(bid)) {
            set.status = 403;
            return { success: false, message: 'Forbidden: You do not have access to this branch' };
        }

        const parseId = (val: any) => {
            if (val === undefined || val === null || val === '' || val === 'null' || val === 'undefined') return null;
            const num = Number(val);
            return isNaN(num) || num === 0 ? null : num;
        };

        const payload = {
            ...data,
            orgId,
            branchId: bid,
            financialYearId: Number(financialYearId),
            createdBy: user.id,
            categoryId: parseId(data.categoryId),
            subCategoryId: parseId(data.subCategoryId),
            accountId: parseId(data.accountId),
            fromAccountId: parseId(data.fromAccountId),
            toAccountId: parseId(data.toAccountId),
            txnTypeId: Number(data.txnTypeId),
            contact: data.contact || null,
            contactId: parseId(data.contactId),
            tags: data.tags || null,
            attachmentPath: attachments ? await processAttachment(attachments) : (data.attachmentPath !== undefined ? data.attachmentPath : null),
            // GST fields
            isTaxable: data.isTaxable === true || data.isTaxable === 'true',
            gstType: data.gstType !== undefined ? (data.gstType === 'INTRA' ? 1 : (data.gstType === 'INTER' ? 0 : (data.gstType === null ? null : Number(data.gstType)))) : null,
            gstRate: data.gstRate != null && data.gstRate !== '' ? Number(data.gstRate) : null,
            cgstAmount: data.cgstAmount != null && data.cgstAmount !== '' ? Number(data.cgstAmount) : null,
            sgstAmount: data.sgstAmount != null && data.sgstAmount !== '' ? Number(data.sgstAmount) : null,
            igstAmount: data.igstAmount != null && data.igstAmount !== '' ? Number(data.igstAmount) : null,
            gstTotal: data.gstTotal != null && data.gstTotal !== '' ? Number(data.gstTotal) : null,
            finalAmount: data.finalAmount != null && data.finalAmount !== '' ? Number(data.finalAmount) : null,
        };

        const transaction = await TransactionService.create(payload);

        WebSocketService.broadcastToBranch(bid, {
            event: 'transaction:created',
            data: transaction
        });

        return { success: true, data: transaction };
    } catch (error: any) {
        console.error('Create Transaction Error:', error);
        set.status = 400;
        return { success: false, message: error.sqlMessage || error.message || "Failed to create transaction" };
    }
};

export const updateTransaction = async ({ params, body, set, user, orgId }: ElysiaContext & { params: { id: string }, body: any }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");
    try {
        const id = Number(params.id);
        const requestData = body;

        const [existingTxn] = await db.select({ branchId: transactions.branchId })
            .from(transactions)
            .where(and(eq(transactions.id, id), eq(transactions.orgId, orgId), isNotDeleted(transactions)));
        if (!existingTxn) {
            set.status = 404;
            return { success: false, message: 'Transaction not found' };
        }

        if (user.role === 'member' && !user.branchIds.includes(existingTxn.branchId || 0)) {
            set.status = 403;
            return { success: false, message: 'Forbidden: You do not have access to this branch' };
        }

        if (requestData.attachments !== undefined) {
            requestData.attachmentPath = await processAttachment(requestData.attachments);
            delete requestData.attachments;
        }

        const parseId = (val: any) => {
            if (val === undefined) return undefined;
            if (val === null || val === '' || val === 'null' || val === 'undefined') return null;
            const num = Number(val);
            return isNaN(num) || num === 0 ? null : num;
        };

        if ('categoryId' in requestData) requestData.categoryId = parseId(requestData.categoryId);
        if ('subCategoryId' in requestData) requestData.subCategoryId = parseId(requestData.subCategoryId);
        if ('accountId' in requestData) requestData.accountId = parseId(requestData.accountId);
        if ('fromAccountId' in requestData) requestData.fromAccountId = parseId(requestData.fromAccountId);
        if ('toAccountId' in requestData) requestData.toAccountId = parseId(requestData.toAccountId);
        if ('contactId' in requestData) requestData.contactId = parseId(requestData.contactId);

        // GST fields
        if ('isTaxable' in requestData) requestData.isTaxable = requestData.isTaxable === true || requestData.isTaxable === 'true';
        if ('gstRate' in requestData) requestData.gstRate = requestData.gstRate != null && requestData.gstRate !== '' ? Number(requestData.gstRate) : null;
        if ('cgstAmount' in requestData) requestData.cgstAmount = requestData.cgstAmount != null && requestData.cgstAmount !== '' ? Number(requestData.cgstAmount) : null;
        if ('sgstAmount' in requestData) requestData.sgstAmount = requestData.sgstAmount != null && requestData.sgstAmount !== '' ? Number(requestData.sgstAmount) : null;
        if ('igstAmount' in requestData) requestData.igstAmount = requestData.igstAmount != null && requestData.igstAmount !== '' ? Number(requestData.igstAmount) : null;
        if ('gstTotal' in requestData) requestData.gstTotal = requestData.gstTotal != null && requestData.gstTotal !== '' ? Number(requestData.gstTotal) : null;
        if ('finalAmount' in requestData) requestData.finalAmount = requestData.finalAmount != null && requestData.finalAmount !== '' ? Number(requestData.finalAmount) : null;
        if ('gstType' in requestData) {
            const val = requestData.gstType;
            requestData.gstType = val === 'INTRA' ? 1 : (val === 'INTER' ? 0 : (val === null || val === undefined ? null : Number(val)));
        }

        const result = await TransactionService.update(id, orgId, requestData, user.id);

        if (existingTxn.branchId) {
            WebSocketService.broadcastToBranch(existingTxn.branchId, {
                event: 'transaction:updated',
                data: result
            });
        }

        return { success: true, data: result };
    } catch (error: any) {
        console.error('Update Transaction Error:', error);
        set.status = 400;
        return { success: false, message: error.message || 'Failed to update transaction' };
    }
};

export const deleteTransaction = async ({ params, set, user, orgId }: ElysiaContext & { params: { id: string } }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");
    try {
        const id = Number(params.id);

        const [transaction] = await db.select({
            branchId: transactions.branchId
        })
            .from(transactions)
            .where(and(eq(transactions.id, id), eq(transactions.orgId, orgId), isNotDeleted(transactions)));

        if (!transaction) {
            set.status = 404;
            return { success: false, message: "Transaction not found." };
        }

        if (user.role === 'member') {
            set.status = 403;
            return { success: false, message: "Action Prohibited: Only Owners and Admins can delete transactions." };
        }

        await TransactionService.delete(id, orgId, user.id);

        if (transaction.branchId) {
            WebSocketService.broadcastToBranch(transaction.branchId, {
                event: 'transaction:deleted',
                data: { id }
            });
        }

        return { success: true, message: 'Transaction archived successfully' };
    } catch (error: any) {
        console.error('Delete Transaction Error:', error);
        set.status = 400;
        return { success: false, message: error.message || 'Failed to delete transaction' };
    }
};

export const importTransactions = async ({ body, set, user, orgId }: ElysiaContext & { body: { file: File, financialYearId?: number, branchId?: number, autoGenerate?: any } }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");
    try {
        const { file, financialYearId, branchId, autoGenerate } = body;

        if (!file) {
            set.status = 400;
            return { success: false, message: 'File is required' };
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const isAuto = autoGenerate === 'true' || autoGenerate === true;

        const result = await TransactionService.importTransactions(
            buffer,
            orgId,
            user,
            financialYearId ? Number(financialYearId) : undefined,
            branchId ? Number(branchId) : undefined,
            isAuto
        );

        if (!result.success && !result.missingData) {
            set.status = 400;
        }

        return result;

    } catch (error: any) {
        console.error('Import Transactions Error:', error);
        set.status = 500;
        return { success: false, message: error.message || 'Failed to import transactions' };
    }
};

export const importFromPDF = async ({ body, set, user, orgId }: ElysiaContext & { body: { file: File, accountId?: string, branchId?: string, financialYearId?: string } }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");
    try {

        const { file, accountId, branchId, financialYearId } = body;

        if (!file) {
            set.status = 400;
            return { success: false, message: 'PDF file is required' };
        }

        if (!accountId || !branchId) {
            set.status = 400;
            return { success: false, message: 'Account ID and Branch ID are required for PDF import' };
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const result = await TransactionService.importFromPDF(
            buffer,
            orgId,
            user,
            Number(accountId),
            Number(branchId),
            financialYearId ? Number(financialYearId) : undefined
        );

        if (!result.success) {
            set.status = 400;
        }

        return result;

    } catch (error: any) {
        console.error('PDF Import Error:', error);
        set.status = 500;
        return { success: false, message: error.message || 'Failed to import from PDF' };
    }
};

export const getTransactions = async ({ body, set, user, orgId, branchId, headers }: ElysiaContext & { body: any & { branchId?: number | number[] | 'all' } }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");
    try {
        const financialYearId = Number(body.financialYearId);
        const limit = body.limit ? Number(body.limit) : undefined;
        const rawBranchId = body.branchId ?? branchId;

        if ((!rawBranchId && rawBranchId !== 0) || (Array.isArray(rawBranchId) && rawBranchId.length === 0)) {
            set.status = 400;
            return { success: false, message: 'Branch ID (header/body) is required' };
        }
        if (!financialYearId) {
            set.status = 400;
            return { success: false, message: 'Financial Year ID is required' };
        }

        const effectiveBranchId = rawBranchId === 'all'
            ? 'all'
            : (Array.isArray(rawBranchId) ? rawBranchId.map(Number).filter(Boolean) : Number(rawBranchId));
        const targetCurrency = headers['x-base-currency'] || body.targetCurrency;

        // Branch access check for MEMBERS
        if (user.role === 'member') {
            if (effectiveBranchId === 'all') {
                if (!user.branchIds || user.branchIds.length === 0) {
                    set.status = 403;
                    return { success: false, message: 'Forbidden: You have no assigned branches' };
                }
            } else if (Array.isArray(effectiveBranchId)) {
                const allowed = effectiveBranchId.some(bid => user.branchIds.includes(Number(bid)));
                if (!allowed) {
                    set.status = 403;
                    return { success: false, message: 'Forbidden: You do not have access to selected branches' };
                }
            } else if (!user.branchIds.includes(effectiveBranchId as number)) {
                set.status = 403;
                return { success: false, message: 'Forbidden: You do not have access to this branch' };
            }
        }

        const items = await TransactionService.getAll(orgId, effectiveBranchId, financialYearId, limit, targetCurrency, user);
        return { success: true, data: items };
    } catch (error: any) {
        console.error('Get Transactions Error:', error);
        set.status = 500;
        return { success: false, message: error?.sqlMessage || error?.message || 'Failed to fetch transactions' };
    }
};

export const exportTransactions = async ({ body, set, user, orgId, branchId, headers }: ElysiaContext & { body: any & { branchId?: number | number[] | 'all' } }) => {
    if (!user || !orgId) throw new Error("Unauthorized: User or Organization not identified");
    try {
        const financialYearId = Number(body.financialYearId);
        const rawBranchId = body.branchId ?? branchId;
        const format = body.format === 'pdf' ? 'pdf' : 'csv';

        if ((!rawBranchId && rawBranchId !== 0) || (Array.isArray(rawBranchId) && rawBranchId.length === 0)) {
            set.status = 400;
            return { success: false, message: 'Branch ID (header/body) is required' };
        }
        if (!financialYearId) {
            set.status = 400;
            return { success: false, message: 'Financial Year ID is required' };
        }

        const effectiveBranchId = rawBranchId === 'all'
            ? 'all'
            : (Array.isArray(rawBranchId) ? rawBranchId.map(Number).filter(Boolean) : Number(rawBranchId));
        const targetCurrency = headers['x-base-currency'] || body.targetCurrency;

        if (user.role === 'member') {
            if (effectiveBranchId === 'all') {
                if (!user.branchIds || user.branchIds.length === 0) {
                    set.status = 403;
                    return { success: false, message: 'Forbidden: You have no assigned branches' };
                }
            } else if (Array.isArray(effectiveBranchId)) {
                const allowed = effectiveBranchId.some(bid => user.branchIds.includes(Number(bid)));
                if (!allowed) {
                    set.status = 403;
                    return { success: false, message: 'Forbidden: You do not have access to selected branches' };
                }
            } else if (!user.branchIds.includes(effectiveBranchId as number)) {
                set.status = 403;
                return { success: false, message: 'Forbidden: You do not have access to this branch' };
            }
        }

        const groupedTransactions = await TransactionService.getGroupedExportData(
            orgId,
            effectiveBranchId,
            financialYearId,
            targetCurrency,
            user,
            {
                searchTerm: body.searchTerm,
                appliedFilters: body.appliedFilters,
                sortConfig: body.sortConfig
            }
        );

        if (format === 'pdf') {
            const html = TransactionService.buildPrintableHtml(groupedTransactions);
            set.headers['content-type'] = 'text/html; charset=utf-8';
            set.headers['content-disposition'] = 'inline; filename="transactions-export.html"';
            return new Response(html, {
                headers: {
                    'content-type': 'text/html; charset=utf-8',
                    'content-disposition': 'inline; filename="transactions-export.html"'
                }
            });
        }

        const csvContent = TransactionService.buildExportCsv(groupedTransactions);
        const fileName = `transactions-export-${new Date().toISOString().slice(0, 10)}.csv`;

        return {
            success: true,
            data: {
                fileName,
                mimeType: 'text/csv;charset=utf-8',
                fileContent: Buffer.from(csvContent, 'utf-8').toString('base64')
            }
        };
    } catch (error: any) {
        console.error('Export Transactions Error:', error);
        set.status = 500;
        return { success: false, message: error?.sqlMessage || error?.message || 'Failed to export transactions' };
    }
};

export const getTransactionTypes = async ({ set }: ElysiaContext) => {
    try {
        const types = await TransactionService.getTransactionTypes();
        return { success: true, data: types };
    } catch (error: any) {
        console.error('Get Transaction Types Error:', error);
        set.status = 500;
        return { success: false, message: error.message || 'Failed to fetch transaction types' };
    }
};
