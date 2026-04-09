import { successResponse } from '../../shared/response';
import * as MasterDataService from './master-data.service';
import type { ElysiaContext } from '../../shared/auth.middleware';

export const getCountries = async ({ user }: ElysiaContext) => {
    if (!user) throw new Error('Unauthorized');

    const countries = await MasterDataService.getCountries();
    return successResponse('Countries retrieved successfully', countries);
};

export const getCurrencies = async ({ user }: ElysiaContext) => {
    if (!user) throw new Error('Unauthorized');

    const currencies = await MasterDataService.getCurrencies();
    return successResponse('Currencies retrieved successfully', currencies);
};
