import * as AuthService from './auth.service';
import { AuditService } from '../audit/audit.service';
import { successResponse } from '../../shared/response';
import type { ElysiaContext } from '../../shared/auth.middleware';

export const updateProfile = async ({ body, user }: ElysiaContext & { body: any }) => {
  if (!user) throw new Error('Unauthorized');
  const result = await AuthService.updateUser(user.id, body);
  return successResponse('Profile updated successfully', result);
};



export const logout = async ({ body }: { body: { refreshToken?: string } }) => {
  const { refreshToken } = body;
  const result = await AuthService.logout(refreshToken || "");
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
