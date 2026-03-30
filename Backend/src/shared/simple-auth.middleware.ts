import { Elysia } from 'elysia';
import { jwtConfig } from './jwt.config';

console.log("!!! SIMPLE AUTH MIDDLEWARE LOADED !!!");

export const simpleAuthMiddleware = (app: Elysia) => app
    .use(jwtConfig)
    .derive(async ({ jwt, headers }) => {
        const authHeader = headers['authorization'] || headers['Authorization'];

        if (!authHeader) {
            return { auth: null };
        }

        const token = authHeader.split(' ')[1];
        try {
            const payload = await jwt.verify(token);
            if (!payload) {
                return { auth: null };
            }

            return {
                auth: {
                    userId: Number(payload.sub),
                    email: payload.email
                }
            };
        } catch (err) {
            return { auth: null };
        }
    });
