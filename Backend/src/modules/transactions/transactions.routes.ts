import { Elysia, t } from 'elysia';
import * as TransactionController from './transactions.controller';
import { authMiddleware } from '../../shared/auth.middleware';

// GET /types - Public endpoint for transaction types
// Defined before authMiddleware to allow access without token (or with invalid token during debugging)
export const transactionRoutes = new Elysia({ prefix: '/transactions' })
    .get('/types', TransactionController.getTransactionTypes as any)
    .use(authMiddleware)
    .get('/:id', TransactionController.getTransaction as any, {
        validateAccess: 'org'
    })
    .post('/', TransactionController.createTransaction as any, {
        validateAccess: 'branch',
        body: t.Object({
            name: t.String(), // Required
            txnTypeId: t.Numeric(), // New required field
            txnDate: t.String(),
            amountLocal: t.Union([t.String(), t.Number()]),
            categoryId: t.Optional(t.Any()), // Now refers to Account ID
            subCategoryId: t.Optional(t.Any()),
            accountId: t.Optional(t.Any()),
            fromAccountId: t.Optional(t.Any()), // For Transfers
            toAccountId: t.Optional(t.Any()),   // For Transfers
            financialYearId: t.Numeric(),
            contact: t.Optional(t.String()), // Merged Payee/Payer
            contactId: t.Optional(t.Numeric()),
            notes: t.Optional(t.String()),
            branchId: t.Optional(t.Numeric()),
            orgId: t.Optional(t.Numeric()),
            currencyCode: t.Optional(t.String()),
            fxRate: t.Optional(t.Union([t.String(), t.Number()])),
            status: t.Optional(t.Union([t.String(), t.Number()])),
            attachments: t.Optional(t.Union([t.File(), t.Files(), t.Any()])),
            // GST fields
            isTaxable: t.Optional(t.Any()),
            gstType: t.Optional(t.Any()),
            gstRate: t.Optional(t.Any()),
            cgstAmount: t.Optional(t.Any()),
            sgstAmount: t.Optional(t.Any()),
            igstAmount: t.Optional(t.Any()),
            gstTotal: t.Optional(t.Any()),
            finalAmount: t.Optional(t.Any())
        })
    })
    .put('/:id', TransactionController.updateTransaction as any, {
        validateAccess: 'org',
        params: t.Object({
            id: t.String()
        }),
        body: t.Object({
            name: t.Optional(t.String()),
            txnTypeId: t.Optional(t.Numeric()),
            txnDate: t.Optional(t.String()),
            amountLocal: t.Optional(t.Union([t.String(), t.Number()])),
            categoryId: t.Optional(t.Any()),
            subCategoryId: t.Optional(t.Any()),
            accountId: t.Optional(t.Any()),
            fromAccountId: t.Optional(t.Any()),
            toAccountId: t.Optional(t.Any()),
            contact: t.Optional(t.String()),
            contactId: t.Optional(t.Numeric()),
            notes: t.Optional(t.String()),
            currencyCode: t.Optional(t.String()),
            fxRate: t.Optional(t.Union([t.String(), t.Number()])),
            status: t.Optional(t.Union([t.String(), t.Number()])),
            attachments: t.Optional(t.Union([t.File(), t.Files(), t.Any()])),
            attachmentPath: t.Optional(t.Union([t.String(), t.Null()])),
            // GST fields
            isTaxable: t.Optional(t.Any()),
            gstType: t.Optional(t.Any()),
            gstRate: t.Optional(t.Any()),
            cgstAmount: t.Optional(t.Any()),
            sgstAmount: t.Optional(t.Any()),
            igstAmount: t.Optional(t.Any()),
            gstTotal: t.Optional(t.Any()),
            finalAmount: t.Optional(t.Any())
        })
    })
    .delete('/:id', TransactionController.deleteTransaction as any, {
        validateAccess: 'org',
        params: t.Object({
            id: t.String()
        })
    })
    .post('/import', TransactionController.importTransactions as any, {
        validateAccess: 'org',
        body: t.Object({
            file: t.File(),
            financialYearId: t.Optional(t.Numeric()),
            branchId: t.Optional(t.Numeric()),
            autoGenerate: t.Optional(t.Any())
        })
    })
    .post('/import-pdf', TransactionController.importFromPDF as any, {
        validateAccess: 'org',
        body: t.Object({
            file: t.File(),
            accountId: t.String(), // FormData sends as string
            branchId: t.String(),  // FormData sends as string
            financialYearId: t.Optional(t.String()) // FormData sends as string
        })
    })
    .post('/transaction-list', TransactionController.getTransactions as any, {
        validateAccess: 'branch',
        body: t.Object({
            financialYearId: t.Numeric(),
            branchId: t.Optional(t.Union([t.Numeric(), t.Literal('all'), t.Array(t.Numeric())])),
            limit: t.Optional(t.Numeric()),
            targetCurrency: t.Optional(t.String()),
            startDate: t.Optional(t.String()),
            endDate: t.Optional(t.String()),
            txnType: t.Optional(t.String()),
            categoryId: t.Optional(t.Numeric()),
            accountId: t.Optional(t.Numeric())
        })
    });
