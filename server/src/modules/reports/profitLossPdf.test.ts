import { describe, expect, test } from 'bun:test';
import { buildProfitLossPdfBuffer } from './profitLossPdf';

describe('Profit/Loss PDF builder', () => {
  test('creates a real PDF buffer without Chromium', () => {
    const pdfBuffer = buildProfitLossPdfBuffer(
      {
        data: {
          expenses: [
            {
              category: 'Salary',
              total: 150000,
              items: [
                { subCategory: 'Team A', amount: 100000 },
                { subCategory: 'Team B', amount: 50000 }
              ]
            }
          ],
          incomes: [
            {
              category: 'Sales',
              total: 250000,
              items: [
                { subCategory: 'Domestic', amount: 250000 }
              ]
            }
          ],
          netProfit: 100000,
          netLoss: 0
        }
      },
      {
        organizationName: 'JKSOL INFOTECH',
        organizationBranchLine: 'SURAT',
        startDate: '2026-03-01',
        endDate: '2026-03-31'
      }
    );

    const pdfText = pdfBuffer.toString('utf8');
    expect(pdfText.startsWith('%PDF-1.4')).toBe(true);
    expect(pdfText.includes('/MediaBox [0 0 595.28 841.89]')).toBe(true);
    expect(pdfText.includes('JKSOL INFOTECH')).toBe(true);
    expect(pdfText.includes('Profit & Loss A/c')).toBe(true);
    expect(pdfText.includes('1-Mar-26 to 31-Mar-26')).toBe(true);
    expect(pdfText.includes('1-Mar-26 to 31-Mar-26 -')).toBe(false);
    expect(pdfText.includes('Salary')).toBe(true);
    expect(pdfText.includes('Sales')).toBe(true);
  });

  test('shows an empty-state message when the statement has no data', () => {
    const pdfBuffer = buildProfitLossPdfBuffer(
      {
        data: {
          expenses: [],
          incomes: [],
          totalLeft: 0,
          totalRight: 0,
          netProfit: 0,
          netLoss: 0
        }
      },
      {
        organizationName: 'JKSOL INFOTECH',
        startDate: '2026-03-01',
        endDate: '2026-03-31'
      }
    );

    const pdfText = pdfBuffer.toString('utf8');
    expect(pdfText.includes('No data found for this period')).toBe(true);
    expect(pdfText.includes('Expense')).toBe(false);
    expect(pdfText.includes('Income')).toBe(false);
  });
});
