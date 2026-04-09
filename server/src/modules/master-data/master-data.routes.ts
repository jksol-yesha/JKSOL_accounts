import { Elysia } from 'elysia';
import { authMiddleware } from '../../shared/auth.middleware';
import * as MasterDataController from './master-data.controller';

export const masterDataRoutes = new Elysia()
    .use(authMiddleware)
    .get('/countries', MasterDataController.getCountries)
    .get('/currencies', MasterDataController.getCurrencies);
