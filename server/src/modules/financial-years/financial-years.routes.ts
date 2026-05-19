import { Elysia } from 'elysia';
import * as FinancialYearController from './financial-years.controller';
import { authMiddleware } from '../../shared/auth.middleware';

export const financialYearRoutes = new Elysia({ prefix: '/financial-years' })
    .use(authMiddleware)
    .get('/', FinancialYearController.getFinancialYears, {
        validateAccess: 'org'
    });
