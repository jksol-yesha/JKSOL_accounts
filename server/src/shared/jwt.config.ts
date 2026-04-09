import { jwt } from '@elysiajs/jwt';
import { env } from '../config/env';

export const jwtConfig = jwt({
    name: 'jwt',
    secret: env.JWT_SECRET
});
