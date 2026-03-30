import { Elysia } from 'elysia';

export const authGuard = new Elysia().derive(
  async ({ jwt, headers }) => {
    console.log('🔒 AuthGuard executing for:', headers ? 'request with headers' : 'request without headers');
    const auth = headers.authorization;

    if (!auth) {
      console.log('❌ No Auth Header found');
      throw new Error('Unauthorized');
    }

    const token = auth.replace('Bearer ', '');

    const payload = await jwt.verify(token);

    if (!payload) {
      console.log('❌ Token verification failed');
      throw new Error('Invalid token');
    }

    return {
      user: payload
    };
  }
);
