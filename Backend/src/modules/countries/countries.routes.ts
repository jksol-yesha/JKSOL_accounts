import { Elysia } from 'elysia';
import { getAllCountries } from './countries.controller';

export const countriesRoutes = new Elysia({ prefix: '/countries' })
    .get('/', getAllCountries);
