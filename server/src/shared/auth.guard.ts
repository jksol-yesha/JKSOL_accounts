import { Elysia } from 'elysia';
import { jwtConfig } from './jwt.config';

export const authGuard = new Elysia()
  .use(jwtConfig)
  .derive(
  async ({ jwt, headers }) => {
    const auth = headers.authorization;

    if (!auth) {
      throw new Error('Unauthorized');
    }

    const token = auth.replace('Bearer ', '');

    const payload = await jwt.verify(token);

    if (!payload) {
      throw new Error('Invalid token');
    }

    return {
      user: payload
    };
  }
);
