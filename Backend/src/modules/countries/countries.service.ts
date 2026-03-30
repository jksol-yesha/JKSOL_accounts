import { db } from '../../db';
import { countries } from '../../db/schema';
import { asc } from 'drizzle-orm';

export class CountriesService {
    static async getAll() {
        return await db.select().from(countries).orderBy(asc(countries.countryName));
    }
}
