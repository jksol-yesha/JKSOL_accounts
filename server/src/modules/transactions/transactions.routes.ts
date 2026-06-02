import { Elysia, t } from 'elysia';
import * as TransactionController from './transactions.controller';
import { authMiddleware } from '../../shared/auth.middleware';
import { parseBankStatement } from '../../utils/pdfParser';
import { PDFParserService } from '../../shared/pdf-parser.service';
import { isHDFCStatement, parseHDFCStatement } from '../../services/statement-parsers/hdfcStatementParser';
import { isAxisStatement, parseAxisStatement } from '../../services/statement-parsers/axisStatementParser';
import { isAxisCorporateStatement, parseAxisCorporateStatement } from '../../services/statement-parsers/axisCorporateStatementParser';
import { isICICIStatement, parseICICIStatement } from '../../services/statement-parsers/iciciStatementParser';
import { isSBIStatement, parseSBIStatement } from '../../services/statement-parsers/sbiStatementParser';
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

            // ─── LAYER 1: FILE HASH ───
            // Calculate SHA-256 of raw PDF bytes BEFORE any parsing or OpenAI calls
            const fileHash = generateFileHash(buffer);

            // Extract text for bank detection
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
                        fileHash,
                        transactions: []
                    }
                };
            }

            // ─── Helper: build standardized response from deterministic parser result ───
            const buildDeterministicResponse = (result: any, bankName: string, parser: string) => {
                return {
                    success: true,
                    message: `Successfully parsed ${result.rows.length} transactions (${parser})`,
                    data: {
                        accountNumber: result.accountNumber || null,
                        bankName,
                        parser,
                        parserType: parser,
                        fileHash,
                        // Account metadata for pre-filling CreateAccount form
                        accountHolderName: result.accountHolderName || null,
                        ifsc: result.ifsc || null,
                        micr: result.micr || null,
                        bankBranchName: result.bankBranchName || null,
                        customerId: result.customerId || null,
                        // Statement period & summary
                        statementFromDate: result.statementFromDate || null,
                        statementToDate: result.statementToDate || null,
                        openingBalance: result.openingBalance || null,
                        closingBalance: result.closingBalance || null,
                        totalDebit: result.totalDebit || null,
                        totalCredit: result.totalCredit || null,
                        debitCount: result.debitCount ?? null,
                        creditCount: result.creditCount ?? null,
                        statementFingerprint: result.statementFingerprint || null,
                        validation: result.validation,
                        transactions: result.rows.map((row: any, idx: number) => ({
                            date: row.transactionDate,
                            narration: row.narration,
                            referenceNo: row.referenceNo || null,
                            chequeNumber: row.chequeNumber || null,
                            serialNo: row.serialNo ?? null,
                            valueDate: row.valueDate || null,
                            withdrawal: row.debitAmount ? parseFloat(row.debitAmount) : 0,
                            deposit: row.creditAmount ? parseFloat(row.creditAmount) : 0,
                            balance: parseFloat(row.closingBalance || '0'),
                            bankTransactionKey: row.bankTransactionKey || null,
                            sourceRowSignature: row.sourceRowSignature || null,
                            sourcePage: row.sourcePage ?? null,
                            sourceRow: row.sourceRow ?? idx + 1,
                            rawText: row.rawText || '',
                            hash: ''
                        }))
                    }
                };
            };
            
            // ─── HDFC Deterministic ───
            if (isHDFCStatement(text)) {
                const result = await parseHDFCStatement(buffer);
                return buildDeterministicResponse(result, 'HDFC', 'HDFC_DETERMINISTIC');
            }

            // ─── Axis Corporate Deterministic ───
            if (isAxisCorporateStatement(text)) {
                const result = await parseAxisCorporateStatement(buffer);
                return buildDeterministicResponse(result, 'AXIS', 'AXIS_CORP_DETERMINISTIC');
            }

            // ─── Axis Retail Deterministic ───
            if (isAxisStatement(text)) {
                const result = await parseAxisStatement(buffer);
                return buildDeterministicResponse(result, 'AXIS', 'AXIS_DETERMINISTIC');
            }

            // ─── ICICI Deterministic ───
            if (isICICIStatement(text)) {
                const result = await parseICICIStatement(buffer);
                return buildDeterministicResponse(result, 'ICICI', 'ICICI_DETERMINISTIC');
            }

            // ─── SBI Deterministic ───
            if (isSBIStatement(text)) {
                const result = await parseSBIStatement(buffer);
                return buildDeterministicResponse(result, 'SBI', 'SBI_DETERMINISTIC');
            }

            // ─── YES Bank Deterministic ───
            if (isYesBankStatement(text)) {
                const result = await parseYesBankStatement(buffer);
                return buildDeterministicResponse(result, 'YES BANK', 'YESBANK_DETERMINISTIC');
            }

            // ─── OpenAI Fallback ───
            const parsedData = await PDFParserService.parseStatement(buffer);

            const mappedData = {
                accountNumber: parsedData.accountNumber || null,
                bankName: null,
                parser: 'OPENAI',
                parserType: 'OPENAI',
                fileHash,
                statementFromDate: null,
                statementToDate: null,
                openingBalance: null,
                closingBalance: null,
                totalDebit: null,
                totalCredit: null,
                debitCount: null,
                creditCount: null,
                statementFingerprint: null,
                validation: null,
                transactions: parsedData.transactions.map((txn: any, idx: number) => ({
                    date: txn.date,
                    narration: txn.description,
                    referenceNo: null,
                    chequeNumber: null,
                    serialNo: null,
                    valueDate: null,
                    withdrawal: txn.debit || 0,
                    deposit: txn.credit || 0,
                    balance: txn.balance || 0,
                    bankTransactionKey: null,
                    sourceRowSignature: null,
                    sourcePage: null,
                    sourceRow: idx + 1,
                    rawText: '',
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
