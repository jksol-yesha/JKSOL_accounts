if (typeof (globalThis as any).DOMMatrix === 'undefined') {
    (globalThis as any).DOMMatrix = class DOMMatrix { } as any;
}

// @ts-ignore - pdf-parse doesn't have proper TypeScript definitions
import pdf from 'pdf-parse/lib/pdf-parse.js';

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
        const data = await pdf(buffer);
        return data.text;
    }

    /**
     * Parse statement using OpenAI for intelligent extraction
     */
    static async parseStatement(buffer: Buffer): Promise<{ accountNumber?: string, transactions: ParsedTransaction[] }> {
        const text = await this.extractText(buffer);
        
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY is not set in the environment variables.');
        }

        const prompt = `
You are an expert financial data extractor. I am going to provide you with the raw text extracted from a bank statement.
Your task is to extract the account number and all transactions from this text.
Return a JSON object containing exactly two keys:
1. "accountNumber": A string representing the bank account number found in the statement (if masked like XXXX1234, just return the exact string found). If not found, omit this key or return null.
2. "transactions": An array of transaction objects.

Each transaction object MUST have the following structure exactly:
{
    "date": "string", // Format: "D MMM YYYY" (e.g., "1 Sep 2019", "15 Oct 2023"). This format is REQUIRED.
    "description": "string", // The transaction description or narration
    "debit": number, // (Optional) The amount debited, if applicable (do not include if 0 or null)
    "credit": number, // (Optional) The amount credited, if applicable (do not include if 0 or null)
    "balance": number, // (Optional) The running balance after the transaction, if available
    "math_check": "string" // You MUST show your math here, e.g. "Prev Balance (217476.85) + Amount (1100000.00) = Current Balance (1317476.85) -> CREDIT"
}

CRITICAL RULES:
1. ONLY output a valid JSON object. Do not include markdown blocks like \`\`\`json or any other text.
2. Carefully distinguish between debit (withdrawals/expenses) and credit (deposits/income).
3. CRITICAL: Tabular column alignment is often lost. To determine if an amount is a DEBIT (withdrawal) or CREDIT (deposit), YOU MUST DO THE MATH against the running balance:
   - If (Previous Balance - Amount) equals Current Balance, then the Amount is a DEBIT.
   - If (Previous Balance + Amount) equals Current Balance, then the Amount is a CREDIT.
   - For the first transaction, look for the "Opening Balance" in the text, or reverse-calculate from the next row.
   DO NOT GUESS. You must explicitly calculate this for every single transaction!
4. The date format MUST strictly follow "D MMM YYYY", for example: "1 Sep 2019" or "25 Dec 2023". You must parse the date from the statement and convert it to this exact format. If the month is fully spelled out, convert it to the 3-letter abbreviation (e.g., "January" -> "Jan").
5. Clean up descriptions by removing long reference numbers or unnecessary whitespace if possible.
6. If there are no transactions, return { "accountNumber": "...", "transactions": [] }.

Raw Bank Statement Text:
======================
${text.substring(0, 100000)}
======================
`;

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [
                        { role: 'system', content: 'You are a precise data extraction API that only outputs raw valid JSON.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.1,
                    response_format: { type: "json_object" }
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                console.error('OpenAI API Error:', errorData);
                throw new Error(`Failed to parse statement via OpenAI: ${response.statusText}`);
            }

            const responseData = await response.json() as any;
            const content = responseData.choices[0].message.content.trim();
            
            const parsed = JSON.parse(content);
            return {
                accountNumber: parsed.accountNumber || undefined,
                transactions: parsed.transactions || []
            };
        } catch (error: any) {
            console.error('Error in parseStatement via OpenAI:', error);
            throw new Error(error.message || 'Failed to parse the bank statement');
        }
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

            const part0 = dateParts[0];
            const part1 = dateParts[1];
            const part2 = dateParts[2];

            if (!part0 || !part1 || !part2) {
                throw new Error(`Invalid date format: ${txn.date}`);
            }

            const day = part0.padStart(2, '0');
            const month = monthMap[part1];
            const year = part2;

            if (!month) {
                throw new Error(`Invalid month: ${part1}`);
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
