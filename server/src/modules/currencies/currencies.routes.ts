import { Elysia } from 'elysia';
import { getAllCurrencies } from './currencies.controller';

export const currenciesRoutes = new Elysia({ prefix: '/currencies' })
    .get('/', getAllCurrencies);
