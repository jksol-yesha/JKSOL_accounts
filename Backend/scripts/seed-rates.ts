
import { db } from '../src/db';
import { exchangeRates } from '../src/db/schema';

async function seedRates() {
    const today = new Date().toISOString().split('T')[0];
    await db.insert(exchangeRates).values([
        { orgId: 1, rateDate: today, fromCurrency: 'USD', toCurrency: 'INR', rate: '83.00' },
        { orgId: 1, rateDate: today, fromCurrency: 'INR', toCurrency: 'USD', rate: '0.012' },
        { orgId: 1, rateDate: today, fromCurrency: 'USD', toCurrency: 'USD', rate: '1.00' },
        { orgId: 1, rateDate: today, fromCurrency: 'INR', toCurrency: 'INR', rate: '1.00' }
    ]);
    console.log("Seeded Exchange Rates.");
}

seedRates().then(() => process.exit(0)).catch(console.error);
