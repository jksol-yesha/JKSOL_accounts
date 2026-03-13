import { db } from './Auth_api 2/src/db';
import { transactions } from './Auth_api 2/src/db/schema';
import { eq, ilike, like } from 'drizzle-orm';
const q1 = db.select().from(transactions).where(like(transactions.contact, 'test')).toSQL();
console.log('Query with like:', q1.sql);
