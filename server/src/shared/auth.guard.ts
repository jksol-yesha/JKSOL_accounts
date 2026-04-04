import { Elysia } from 'elysia';

export const authGuard = new Elysia().derive(
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
