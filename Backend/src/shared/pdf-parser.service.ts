// @ts-ignore - pdf-parse doesn't have proper TypeScript definitions
const { PDFParse } = require('pdf-parse');

interface ParsedTransaction {
    date: string;
    description: string;
    debit?: number;
    credit?: number;
    balance?: number;
}

export class PDFParserService {
    /**
     * Extract text from PDF buffer
     */
    static async extractText(buffer: Buffer): Promise<string> {
        // Convert Buffer to Uint8Array as required by PDFParse
        const uint8Array = new Uint8Array(buffer);
        const parser = new PDFParse({ data: uint8Array });
        const result = await parser.getText();
        return result.text;
    }

    /**
     * Parse SBI Bank Statement format - Simple extraction
     */
    static parseSBIStatement(text: string): ParsedTransaction[] {
        const transactions: ParsedTransaction[] = [];
        const lines = text.split('\n');

        let inTable = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Detect table header
            if (line.includes('Txn Date') && line.includes('Description')) {
                inTable = true;
                continue;
            }

            // Stop at footer
            if (line.toLowerCase().includes('total') || line.toLowerCase().includes('opening balance')) {
                break;
            }

            if (!inTable || !line) continue;

            // Try to match date pattern (e.g., "1 Sep 2019")
            const datePattern = /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/;
            if (!datePattern.test(line)) continue;

            const dateMatch = line.match(datePattern);
            if (!dateMatch) continue;

            const txnDate = dateMatch[1];

            // Extract all numbers (amounts and balance)
            const amountPattern = /([\d,]+\.?\d{2})/g;
            const amounts = line.match(amountPattern);

            if (!amounts || amounts.length < 1) continue;

            // Last number is always the balance
            const balance = parseFloat(amounts[amounts.length - 1].replace(/,/g, ''));

            // Transaction amount is typically second-to-last
            let debit: number | undefined;
            let credit: number | undefined;

            if (amounts.length >= 2) {
                const txnAmount = parseFloat(amounts[amounts.length - 2].replace(/,/g, ''));

                // Simple classification based on common keywords
                const lineLower = line.toLowerCase();
                if (lineLower.includes('transfer') || lineLower.includes('deposit') || lineLower.includes('credit')) {
                    credit = txnAmount;
                } else {
                    debit = txnAmount;
                }
            }

            // Extract description (text between date and amounts)
            let description = line;
            // Remove the date
            description = description.replace(datePattern, '').trim();
            // Remove amounts from the end
            amounts.forEach(amt => {
                const idx = description.lastIndexOf(amt);
                if (idx !== -1) {
                    description = description.substring(0, idx).trim();
                }
            });

            // Clean up description - remove reference codes
            description = description.replace(/[A-Z0-9]{10,}/g, '').trim();
            description = description.substring(0, 200); // Limit length

            if (description && (debit || credit)) {
                transactions.push({
                    date: txnDate,
                    description,
                    debit,
                    credit,
                    balance,
                });
            }
        }

        return transactions;
    }

    /**
     * Generic parser - tries to detect format and extract transactions
     */
    static async parseStatement(buffer: Buffer): Promise<ParsedTransaction[]> {
        const text = await this.extractText(buffer);

        // Auto-detect bank format
        if (text.includes('SBI') || text.includes('State Bank')) {
            return this.parseSBIStatement(text);
        }

        throw new Error('Unsupported bank statement format. Currently only SBI statements are supported.');
    }

    /**
     * Convert parsed transactions to import format
     */
    static convertToTransactionFormat(
        parsedTransactions: ParsedTransaction[],
        accountId: number,
        branchId: number
    ): any[] {
        return parsedTransactions.map(txn => {
            const isCredit = txn.credit && txn.credit > 0;
            const amount = isCredit ? txn.credit : txn.debit;

            // Parse date (format: "1 Sep 2019")
            const dateParts = txn.date.split(' ');
            if (dateParts.length !== 3) {
                throw new Error(`Invalid date format: ${txn.date}`);
            }

            const monthMap: { [key: string]: string } = {
                'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
                'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
                'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
            };

            const day = dateParts[0].padStart(2, '0');
            const month = monthMap[dateParts[1]];
            const year = dateParts[2];

            if (!month) {
                throw new Error(`Invalid month: ${dateParts[1]}`);
            }

            const formattedDate = `${year}-${month}-${day}`;

            return {
                date: formattedDate,
                Date: formattedDate,
                description: txn.description,
                Description: txn.description,
                type: isCredit ? 'Income' : 'Expense',
                Type: isCredit ? 'Income' : 'Expense',
                amount: amount,
                Amount: amount,
                account_id: accountId,
                accountId: accountId,
                branch_id: branchId,
                branchId: branchId,
                status: 'posted',
                Status: 'posted',
            };
        });
    }
}
