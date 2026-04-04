import { CountriesService } from './countries.service';
import { successResponse } from '../../shared/response';

export const getAllCountries = async () => {
    const countries = await CountriesService.getAll();
    return successResponse('Countries fetched successfully', countries);
};
