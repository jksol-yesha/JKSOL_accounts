import { jwt } from '@elysiajs/jwt';

export const jwtConfig = jwt({
    name: 'jwt',
    secret: 'super_secret_key' // TODO: Move to env variable
});
