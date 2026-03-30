import { db } from './src/db';
import { categories } from './src/db/schema';

async function checkCategories() {
    try {
        const allCats = await db.select().from(categories);
        console.log('Categories in database:');
        allCats.forEach(c => {
            console.log(`ID: ${c.id}, Name: ${c.name}, P&L Classification: ${c.pnlClassification}`);
        });
        process.exit(0);
    } catch (error) {
        console.error('Error checking categories:', error);
        process.exit(1);
    }
}

checkCategories();
