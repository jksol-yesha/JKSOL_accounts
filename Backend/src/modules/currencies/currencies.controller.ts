import { CurrenciesService } from './currencies.service';
import { successResponse } from '../../shared/response';

export const getAllCurrencies = async () => {
    const currencies = await CurrenciesService.getAll();
    return successResponse('Currencies fetched successfully', currencies);
};
