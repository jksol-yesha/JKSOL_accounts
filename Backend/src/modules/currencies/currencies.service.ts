import { db } from '../../db';
import { currencies } from '../../db/schema';
import { asc } from 'drizzle-orm';

export class CurrenciesService {
    static async getAll() {
        return await db.select().from(currencies).orderBy(asc(currencies.code));
    }
}
