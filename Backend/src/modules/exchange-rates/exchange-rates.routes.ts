import { Elysia, t } from 'elysia';
import * as ExchangeRatesController from './exchange-rates.controller.ts';
import { authMiddleware } from '../../shared/auth.middleware';

export const exchangeRatesRoutes = new Elysia({ prefix: '/exchange-rates' })
    .use(authMiddleware)
    .get('/', ExchangeRatesController.getExchangeRate, {
        validateAccess: 'org',
        query: t.Object({
            from: t.String(),
            to: t.String()
        })
    });
