import { asc } from 'drizzle-orm';
import { db } from '../../db';
import { countries } from '../../db/schema';
import { CurrencyMasterService } from '../../shared/currency-master.service';

export const getCountries = async () => {
    return db
        .select()
        .from(countries)
        .orderBy(asc(countries.countryName));
};

export const getCurrencies = async () => {
    return CurrencyMasterService.getAll();
};
