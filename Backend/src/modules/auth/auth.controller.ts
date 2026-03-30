import * as AuthService from './auth.service';
import { AuditService } from '../audit/audit.service';
import { successResponse } from '../../shared/response';
import type { ElysiaContext } from '../../shared/auth.middleware';

export const signup = async ({ body }: { body: any }) => {
  console.log('📝 Signup Request Body:', JSON.stringify(body, null, 2));
  const user = await AuthService.signup(body);
  console.log('✅ Signup controller finished, returning response');
  // Audit Log: SIGNUP
  // Org ID is 0 because user is not assigned to any org yet
  await AuditService.log(0, 'user', user.id, 'SIGNUP', user.id);
  return successResponse('User registered successfully', user);
};


export const updateProfile = async ({ body, user }: ElysiaContext & { body: any }) => {
  if (!user) throw new Error('Unauthorized');
  const result = await AuthService.updateUser(user.id, body);
  return successResponse('Profile updated successfully', result);
};

export const updatePreferences = async ({ body, user }: ElysiaContext & { body: any }) => {
  if (!user) throw new Error('Unauthorized');
  const result = await AuthService.updatePreferences(user.id, body);
  return successResponse('Preferences updated successfully', result);
};

export const logout = async ({ body }: { body: { refreshToken?: string } }) => {
  const { refreshToken } = body;
  const result = await AuthService.logout("", refreshToken || "");
  return successResponse(result.message);
};

export const refreshToken = async ({ body, jwt }: { body: { refreshToken: string }, jwt: any }) => {
  const { refreshToken } = body;
  const result = await AuthService.refreshToken(refreshToken, jwt);
  return successResponse('Token refreshed successfully', result);
};

export const getUsers = async ({ user }: ElysiaContext) => {
  if (!user) throw new Error('Unauthorized');
  const users = await AuthService.getAllUsers();
  return successResponse('Users retrieved successfully', users);
};

export const verifyEmail = async ({ query }: { query: { token: string } }) => {
  const { token } = query;
  if (!token) throw new Error('Token is required');
  const result = await AuthService.verifyEmail(token);
  return successResponse(result.message);
};


export const acceptInvite = async ({ body }: { body: any }) => {
  const result = await AuthService.acceptInvite(body);
  return successResponse(result.message, { userId: result.userId });
};

export const declineInvite = async ({ body }: { body: { token: string } }) => {
  const result = await AuthService.declineInvite(body);
  return successResponse(result.message);
};

export const getInviteDetails = async ({ query }: { query: { token: string } }) => {
  const { token } = query;
  const result = await AuthService.getInviteDetails(token);
  return successResponse('Invite details retrieved', result);
};

// --- OTP Handlers ---

export const sendLoginOtp = async ({ body }: { body: { email: string } }) => {
  const { email } = body;
  const result = await AuthService.sendLoginOtp(email);
  return successResponse(result.message, result);
};

export const verifyLoginOtp = async ({ body, jwt }: { body: { email: string, otp: string }, jwt: any }) => {
  const { email, otp } = body;
  const result = await AuthService.verifyLoginOtp(email, otp, jwt);

  // Audit Log: LOGIN
  if (result.user) {
    // Try to determine a primary Org ID, else 0
    let orgId = 0;
    if (Array.isArray(result.user.orgIds) && result.user.orgIds.length > 0) {
      orgId = Number(result.user.orgIds[0]);
    } else if (typeof result.user.orgIds === 'string' && result.user.orgIds) {
      const parts = result.user.orgIds.split(',');
      if (parts.length > 0) orgId = Number(parts[0]);
    }
    await AuditService.log(orgId, 'user', result.user.id, 'LOGIN', result.user.id);
  }

  return successResponse('Login successful', result);
};

export const sendInviteOtp = async ({ body }: { body: { token: string, email?: string } }) => {
  const { token, email } = body;
  const result = await AuthService.sendInviteOtp(token, email);
  return successResponse(result.message, result);
};

export const verifyInviteOtp = async ({ body, jwt }: { body: { token: string, otp: string, name?: string }, jwt: any }) => {
  const { token, otp, name } = body;
  const result = await AuthService.verifyInviteOtp(token, otp, name, jwt);
  return successResponse('Invitation accepted successfully', result);
};

export const ping = ({ request }: { request: Request }) => {
  console.log('🏓 PING RECEIVED');
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  const referer = request.headers.get('referer');
  return {
    message: 'pong',
    debug: {
      origin,
      host,
      referer,
      timestamp: new Date().toISOString()
    }
  };
};
