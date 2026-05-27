import { Elysia, t } from 'elysia';
import * as TransactionController from './transactions.controller';
import { authMiddleware } from '../../shared/auth.middleware';
import { parseBankStatement } from '../../utils/pdfParser';
import { PDFParserService } from '../../shared/pdf-parser.service';
import { isHDFCStatement, parseHDFCStatement } from '../../services/statement-parsers/hdfcStatementParser';
import { isAxisStatement, parseAxisStatement } from '../../services/statement-parsers/axisStatementParser';
import { isICICIStatement, parseICICIStatement } from '../../services/statement-parsers/iciciStatementParser';
import { isYesBankStatement, parseYesBankStatement } from '../../services/statement-parsers/yesBankStatementParser';
import { generateFileHash } from '../../services/statement-parsers/statementHashUtils';

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
            contactId: t.Optional(t.Union([t.Numeric(), t.Null()])),
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
            contactId: t.Optional(t.Union([t.Numeric(), t.Null()])),
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
    .post('/import-json', TransactionController.importJson as any, {
        validateAccess: 'org',
        body: t.Any()
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
    })
    .post('/export', TransactionController.exportTransactions as any, {
        validateAccess: 'branch',
        body: t.Object({
            financialYearId: t.Numeric(),
            branchId: t.Optional(t.Union([t.Numeric(), t.Literal('all'), t.Array(t.Numeric())])),
            targetCurrency: t.Optional(t.String()),
            searchTerm: t.Optional(t.String()),
            format: t.Optional(t.Union([t.Literal('csv'), t.Literal('pdf'), t.Literal('xlsx')])),
            appliedFilters: t.Optional(t.Object({
                moneyFlow: t.Optional(t.String()),
                scope: t.Optional(t.String()),
                timePeriod: t.Optional(t.String()),
                startDate: t.Optional(t.String()),
                endDate: t.Optional(t.String()),
                payee: t.Optional(t.String())
            })),
            sortConfig: t.Optional(t.Object({
                key: t.Optional(t.String()),
                direction: t.Optional(t.String())
            })),
            mappedRows: t.Optional(t.Array(t.Any())),
            visibleColumns: t.Optional(t.Array(t.String()))
        })
    })
    .post('/upload-statement', async ({ body, set }) => {
        try {
            if (!body || typeof body !== 'object' || !('file' in body)) {
                set.status = 400;
                return { success: false, message: 'No file provided' };
            }
            
            const file = (body as any).file as File;
            if (file.type !== 'application/pdf') {
                set.status = 400;
                return { success: false, message: 'Only PDF files are supported' };
            }

            const buffer = Buffer.from(await file.arrayBuffer());
            
            // Check if this is an HDFC statement for deterministic parsing
            const text = await PDFParserService.extractText(buffer);
            
            
            // If PDF has essentially no extractable text, it's likely a scanned/image PDF
            if (!text || text.trim().length < 50) {
                set.status = 400;
                return { 
                    success: false, 
                    message: 'This PDF appears to be scanned or image-based. Text could not be extracted. Please download a digital/text-based statement from your bank\'s net banking portal and try again.',
                    data: {
                        accountNumber: null,
                        bankName: null,
                        parser: 'NONE',
                        transactions: []
                    }
                };
            }
            
            if (isHDFCStatement(text)) {
                // Use deterministic HDFC parser
                const hdfcResult = await parseHDFCStatement(buffer);
                
                
                if (hdfcResult.rows.length === 0) {
                    // No rows parsed - could indicate format mismatch
                }
                
                const mappedData = {
                    accountNumber: hdfcResult.accountNumber || null,
                    bankName: 'HDFC',
                    parser: 'HDFC_DETERMINISTIC',
                    statementFromDate: hdfcResult.statementFromDate,
                    statementToDate: hdfcResult.statementToDate,
                    openingBalance: hdfcResult.openingBalance,
                    closingBalance: hdfcResult.closingBalance,
                    validation: hdfcResult.validation,
                    transactions: hdfcResult.rows.map((row: any) => ({
                        date: row.transactionDate,
                        narration: row.narration,
                        referenceNo: row.referenceNo,
                        valueDate: row.valueDate,
                        withdrawal: row.debitAmount ? parseFloat(row.debitAmount) : 0,
                        deposit: row.creditAmount ? parseFloat(row.creditAmount) : 0,
                        balance: parseFloat(row.closingBalance),
                        hash: ''
                    }))
                };

                return {
                    success: true,
                    message: `Successfully parsed ${mappedData.transactions.length} transactions (HDFC Deterministic)`,
                    data: mappedData
                };
            }

            // ─── Axis Bank Deterministic ───
            if (isAxisStatement(text)) {
                const axisResult = await parseAxisStatement(buffer);
                
                
                const mappedData = {
                    accountNumber: axisResult.accountNumber || null,
                    bankName: 'AXIS',
                    parser: 'AXIS_DETERMINISTIC',
                    statementFromDate: axisResult.statementFromDate,
                    statementToDate: axisResult.statementToDate,
                    openingBalance: axisResult.openingBalance,
                    closingBalance: axisResult.closingBalance,
                    validation: axisResult.validation,
                    transactions: axisResult.rows.map((row: any) => ({
                        date: row.transactionDate,
                        narration: row.narration,
                        referenceNo: row.referenceNo,
                        chequeNumber: row.chequeNumber,
                        valueDate: row.valueDate,
                        withdrawal: row.debitAmount ? parseFloat(row.debitAmount) : 0,
                        deposit: row.creditAmount ? parseFloat(row.creditAmount) : 0,
                        balance: parseFloat(row.closingBalance),
                        hash: ''
                    }))
                };

                return {
                    success: true,
                    message: `Successfully parsed ${mappedData.transactions.length} transactions (Axis Deterministic)`,
                    data: mappedData
                };
            }

            // ─── ICICI Bank Deterministic ───
            if (isICICIStatement(text)) {
                const iciciResult = await parseICICIStatement(buffer);
                
                
                const mappedData = {
                    accountNumber: iciciResult.accountNumber || null,
                    bankName: 'ICICI',
                    parser: 'ICICI_DETERMINISTIC',
                    statementFromDate: iciciResult.statementFromDate,
                    statementToDate: iciciResult.statementToDate,
                    openingBalance: iciciResult.openingBalance,
                    closingBalance: iciciResult.closingBalance,
                    validation: iciciResult.validation,
                    transactions: iciciResult.rows.map((row: any) => ({
                        date: row.transactionDate,
                        narration: row.narration,
                        referenceNo: row.referenceNo,
                        chequeNumber: row.chequeNumber,
                        serialNo: row.serialNo,
                        valueDate: row.valueDate,
                        withdrawal: row.debitAmount ? parseFloat(row.debitAmount) : 0,
                        deposit: row.creditAmount ? parseFloat(row.creditAmount) : 0,
                        balance: parseFloat(row.closingBalance),
                        hash: ''
                    }))
                };

                return {
                    success: true,
                    message: `Successfully parsed ${mappedData.transactions.length} transactions (ICICI Deterministic)`,
                    data: mappedData
                };
            }

            // ─── YES Bank Deterministic ───
            if (isYesBankStatement(text)) {
                const yesResult = await parseYesBankStatement(buffer);

                const mappedData = {
                    accountNumber: yesResult.accountNumber || null,
                    bankName: 'YES BANK',
                    parser: 'YES_BANK_DETERMINISTIC_TEXT',
                    statementFromDate: yesResult.statementFromDate,
                    statementToDate: yesResult.statementToDate,
                    openingBalance: yesResult.openingBalance,
                    closingBalance: yesResult.closingBalance,
                    validation: yesResult.validation,
                    transactions: yesResult.rows.map((row: any) => ({
                        date: row.transactionDate,
                        narration: row.narration,
                        referenceNo: row.referenceNo,
                        chequeNumber: row.chequeNumber,
                        valueDate: row.valueDate,
                        withdrawal: row.debitAmount ? parseFloat(row.debitAmount) : 0,
                        deposit: row.creditAmount ? parseFloat(row.creditAmount) : 0,
                        balance: parseFloat(row.closingBalance),
                        hash: ''
                    }))
                };

                return {
                    success: true,
                    message: `Successfully parsed ${mappedData.transactions.length} transactions (YES Bank Deterministic)`,
                    data: mappedData
                };
            }

            // Fallback: OpenAI parser for unsupported banks
            const parsedData = await PDFParserService.parseStatement(buffer);

            const mappedData = {
                accountNumber: parsedData.accountNumber || null,
                bankName: null,
                parser: 'OPENAI',
                transactions: parsedData.transactions.map((txn: any) => ({
                    date: txn.date,
                    narration: txn.description,
                    withdrawal: txn.debit || 0,
                    deposit: txn.credit || 0,
                    balance: txn.balance || 0,
                    hash: ''
                }))
            };

            return {
                success: true,
                message: `Successfully parsed ${mappedData.transactions.length} transactions`,
                data: mappedData
            };
        } catch (error: any) {
            console.error('Error parsing bank statement:', error);
            set.status = 500;
            return { success: false, message: 'Failed to parse bank statement: ' + error.message };
        }
    })
    .get('/imports', TransactionController.getImportedStatements as any, {
        validateAccess: 'org',
        query: t.Object({
            financialYearId: t.Optional(t.Numeric()),
            branchId: t.Optional(t.Numeric())
        })
    })
    .delete('/imports/:id/revert', TransactionController.revertImportedStatement as any, {
        validateAccess: 'org',
        params: t.Object({
            id: t.String()
        })
    });
