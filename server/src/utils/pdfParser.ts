// @ts-ignore
import { PDFParse } from 'pdf-parse';
import crypto from 'crypto';

export interface ParsedTransaction {
    date: Date;
    narration: string;
    withdrawal: number;
    deposit: number;
    balance: number;
    hash: string;
}

export interface ParsedStatementResult {
    accountNumber: string | null;
    bankName: string | null;
    transactions: ParsedTransaction[];
}

export async function parseBankStatement(buffer: Buffer): Promise<ParsedStatementResult> {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const data = await parser.getText();
    const text = data.text;
    const lines = text.split('\n').map((line: string) => line.trim()).filter((line: string) => line.length > 0);

    // 1. Heuristic Account Metadata Extraction
    let accountNumber = null;
    let bankName = null;

    const fullHeader = lines.slice(0, 30).join(' ').toUpperCase();
    
    // Guess Bank Name
    if (fullHeader.includes('HDFC BANK')) bankName = 'HDFC Bank';
    else if (fullHeader.includes('AXIS BANK') || fullHeader.includes('AXIS ACCOUNT')) bankName = 'Axis Bank';
    else if (fullHeader.includes('ICICI BANK')) bankName = 'ICICI Bank';
    else if (fullHeader.includes('STATE BANK OF INDIA') || fullHeader.includes('SBI')) bankName = 'State Bank of India';

    // Guess Account Number (look for words like A/C, Account, followed by 9-18 digits)
    const accMatch = fullHeader.match(/(?:A\/C|ACCOUNT|ACC|CUST ID).*?(\d{9,18})/i);
    if (accMatch) {
        accountNumber = accMatch[1];
    } else {
        // Just look for the first long number sequence in the header
        const rawNumMatch = fullHeader.match(/\b\d{9,18}\b/);
        if (rawNumMatch) accountNumber = rawNumMatch[0];
    }

    // 2. Heuristic Transaction Extraction
    const transactions: ParsedTransaction[] = [];
    const dateRegex = /(\d{2})[./-](\d{2})[./-](20\d{2}|19\d{2}|\d{2})/;

    let currentBlock = "";
    const blocks: string[] = [];

    // Group lines into transaction blocks
    for (const line of lines) {
        // Try to find a date at the start of the line or very close to it
        const startChars = line.substring(0, 20);
        const upperLine = line.toUpperCase();
        
        // Stop grabbing blocks if we hit a footer summary
        if (lines.indexOf(line) > 10 && upperLine.includes('CLOSING BALANCE') && !upperLine.includes('OPENING BALANCE')) {
            if (currentBlock) blocks.push(currentBlock);
            currentBlock = "";
            break;
        }
        if (lines.indexOf(line) > 10 && (upperLine.includes('STATEMENT SUMMARY') || upperLine.includes('LEGENDS') || upperLine.includes('PAGE NO'))) {
            if (currentBlock) blocks.push(currentBlock);
            currentBlock = "";
            break;
        }

        if (dateRegex.test(startChars) || /^\s*(?:\d+)?\s*\d{2}[./-]\d{2}[./-]\d{2,4}/.test(startChars)) {
            // This line starts a new transaction block
            if (currentBlock) {
                blocks.push(currentBlock);
            }
            currentBlock = line;
        } else if (currentBlock) {
            currentBlock += " " + line;
        }
    }
    if (currentBlock) blocks.push(currentBlock);

    // Find opening balance if possible
    let runningBalance: number | null = null;
    const openingBalMatch = fullHeader.match(/(?:OPENING BALANCE|BROUGHT FORWARD|BALANCE).*?((?:\d{1,3}(?:,\d{3})*|\d+)\.\d{2})/i);
    if (openingBalMatch && openingBalMatch[1]) {
        runningBalance = parseFloat(openingBalMatch[1].replace(/,/g, ''));
    }

    // Extract all rows first
    const extractedRows: any[] = [];
    const localDateRegex = /(\d{2})[./-](\d{2})[./-](20\d{2}|19\d{2}|\d{2})/g;
    const localAmountRegex = /((?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})\s*(DR|CR)?/gi;

    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        if (!block) continue;
        
        const dates: string[] = [];
        let dateMatch;
        while ((dateMatch = localDateRegex.exec(block)) !== null) {
            dates.push(dateMatch[0]);
        }
        if (dates.length === 0) continue;

        let blockWithoutDates = block.replace(localDateRegex, ' ');
        const firstDateStr = dates[0];
        if (!firstDateStr) continue;
        let [_, d, m, y] = firstDateStr.match(/(\d{2})[./-](\d{2})[./-](20\d{2}|19\d{2}|\d{2})/) || [];
        if (y && y.length === 2) y = "20" + y; 
        const dateObj = new Date(`${y}-${m}-${d}T00:00:00Z`);

        const amounts: { value: number, type: 'DR' | 'CR' | 'UNKNOWN' }[] = [];
        let amtMatch;
        while ((amtMatch = localAmountRegex.exec(blockWithoutDates)) !== null) {
            const val = parseFloat((amtMatch[1] || '0').replace(/,/g, ''));
            const suffix = amtMatch[2]?.toUpperCase();
            amounts.push({
                value: val,
                type: suffix === 'DR' ? 'DR' : suffix === 'CR' ? 'CR' : 'UNKNOWN'
            });
        }

        let narration = blockWithoutDates;
        narration = narration.replace(/((?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})\s*(DR|CR)?/gi, '');
        narration = narration.replace(/^\s*\d+\s+/, '');
        narration = narration.replace(/\s+/g, ' ').trim();

        if (amounts.length > 0) {
            extractedRows.push({
                dates, dateObj, y, m, d, amounts, narration, block
            });
        }
    }

    let currentBal = runningBalance;

    for (let i = 0; i < extractedRows.length; i++) {
        const row = extractedRows[i];
        let withdrawal = 0;
        let deposit = 0;
        let balance = 0;

        if (row.amounts.length >= 2) {
            let found = false;
            
            // 1. Try math with currentBal
            if (currentBal !== null) {
                for (let a1 = 0; a1 < row.amounts.length; a1++) {
                    for (let a2 = 0; a2 < row.amounts.length; a2++) {
                        if (a1 === a2) continue;
                        const amt = row.amounts[a1].value;
                        const bal = row.amounts[a2].value;
                        if (Math.abs((currentBal - amt) - bal) < 0.01) {
                            withdrawal = amt; balance = bal; found = true; break;
                        } else if (Math.abs((currentBal + amt) - bal) < 0.01) {
                            deposit = amt; balance = bal; found = true; break;
                        }
                    }
                    if (found) break;
                }
            }
            
            // 2. Try Look-Ahead Math
            if (!found && i + 1 < extractedRows.length && extractedRows[i+1].amounts.length >= 2) {
                const nextRow = extractedRows[i+1];
                let matchedBal: number | null = null;
                let nextMatchedBal: number | null = null;
                for (let a1 = 0; a1 < row.amounts.length; a1++) {
                    for (let a2 = 0; a2 < nextRow.amounts.length; a2++) {
                        for (let a3 = 0; a3 < nextRow.amounts.length; a3++) {
                            if (a2 === a3) continue;
                            const myBal = row.amounts[a1].value;
                            const nextBal = nextRow.amounts[a2].value;
                            const nextTxn = nextRow.amounts[a3].value;
                            if (Math.abs(Math.abs(nextBal - myBal) - nextTxn) < 0.01) {
                                matchedBal = myBal;
                                nextMatchedBal = nextBal;
                                break;
                            }
                        }
                        if (matchedBal !== null) break;
                    }
                    if (matchedBal !== null) break;
                }
                
                if (matchedBal !== null) {
                    balance = matchedBal;
                    const txn = row.amounts.find((a: any) => a.value !== matchedBal)?.value || 0;
                    if (row.amounts.find((a: any) => a.value === txn && a.type === 'DR')) {
                        withdrawal = txn;
                    } else if (nextMatchedBal !== null && nextMatchedBal < matchedBal) {
                        withdrawal = txn;
                    } else if (nextMatchedBal !== null && nextMatchedBal > matchedBal) {
                        deposit = txn;
                    } else {
                        deposit = txn; // fallback
                    }
                    found = true;
                }
            }
            
            // 3. Fallback: larger is balance
            if (!found) {
                const val1 = row.amounts[0].value;
                const val2 = row.amounts[1].value;
                balance = Math.max(val1, val2);
                
                if (row.amounts[0].type === 'DR' || row.amounts[1].type === 'DR') {
                    withdrawal = Math.min(val1, val2);
                } else {
                    deposit = Math.min(val1, val2);
                }
            }
        } else if (row.amounts.length === 1) {
            if (row.amounts[0].type === 'DR') withdrawal = row.amounts[0].value;
            else deposit = row.amounts[0].value;
            balance = currentBal || 0; 
        }

        if (balance !== 0) currentBal = balance;

        const hashInput = `${row.y}-${row.m}-${row.d}_${row.narration}_${withdrawal}_${deposit}`;
        const hash = crypto.createHash('sha256').update(hashInput).digest('hex');

        if (withdrawal > 0 || deposit > 0) {
            transactions.push({
                date: row.dateObj,
                narration: row.narration,
                withdrawal,
                deposit,
                balance,
                hash
            });
        }
    }

    return {
        accountNumber: accountNumber || null,
        bankName: bankName || null,
        transactions
    };
}
