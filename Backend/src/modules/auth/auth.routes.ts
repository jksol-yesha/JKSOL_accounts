import { Elysia, t } from 'elysia';
import * as AuthController from './auth.controller';
import { authMiddleware } from '../../shared/auth.middleware';
import { jwtConfig } from '../../shared/jwt.config';

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(jwtConfig)
  .get('/ping', AuthController.ping)
  .post(
    '/signup',
    AuthController.signup,
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        name: t.String(),
        phoneNumber: t.Optional(t.String())
      })
    }
  )
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
          profilePhoto: t.Optional(t.String()),
          phoneNumber: t.Optional(t.String())
        })
      }
    )
    .put(
      '/preferences',
      AuthController.updatePreferences,
      {
        body: t.Any() // Allow any json preference structure
      }
    )
    .get('/users', AuthController.getUsers)
  )
  .get(
    '/verify-email',
    AuthController.verifyEmail,
    {
      query: t.Object({
        token: t.String()
      })
    }
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
    '/accept-invite',
    AuthController.acceptInvite,
    {
      body: t.Object({
        token: t.String(),
        name: t.Optional(t.String())
      })
    }
  )
  .post(
    '/decline-invite',
    AuthController.declineInvite,
    {
      body: t.Object({
        token: t.String()
      })
    }
  )
  .get(
    '/get-invite-details',
    AuthController.getInviteDetails,
    {
      query: t.Object({
        token: t.String()
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
  .post(
    '/send-invite-otp',
    AuthController.sendInviteOtp,
    {
      body: t.Object({
        token: t.String(),
        email: t.Optional(t.String({ format: 'email' }))
      })
    }
  )
  .post(
    '/verify-invite-otp',
    AuthController.verifyInviteOtp,
    {
      body: t.Object({
        token: t.String(),
        otp: t.String(),
        name: t.Optional(t.String())
      })
    }
  );
