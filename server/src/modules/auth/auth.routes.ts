import { Elysia, t } from 'elysia';
import * as AuthController from './auth.controller';
import { authMiddleware } from '../../shared/auth.middleware';
import { jwtConfig } from '../../shared/jwt.config';

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(jwtConfig)
  .post(
    '/refresh',
    AuthController.refreshToken,
    {
      body: t.Object({
        refreshToken: t.String()
      })
    }
  )
  .group('', (app) => app
    .use(authMiddleware)
    .put(
      '/profile',
      AuthController.updateProfile,
      {
        body: t.Object({
          email: t.Optional(t.String({ format: 'email' })),
          name: t.Optional(t.String()),
          profilePhoto: t.Optional(t.String())
        })
      }
    )

    .get('/users', AuthController.getUsers)
  )
  .post(
    '/logout',
    AuthController.logout,
    {
      body: t.Object({
        refreshToken: t.Optional(t.String())
      })
    }
  )

  .post(
    '/send-login-otp',
    AuthController.sendLoginOtp,
    {
      body: t.Object({
        email: t.String({ format: 'email' })
      })
    }
  )
  .post(
    '/verify-login-otp',
    AuthController.verifyLoginOtp,
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        otp: t.String()
      })
    }
  )
;
