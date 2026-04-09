import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { readdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { authRoutes } from './modules/auth/auth.routes';
import { branchesRoutes } from './modules/branches/branches.routes';
import { accountsRoutes } from './modules/accounts/accounts.routes';
import { categoryRoutes } from './modules/category/category.routes';
import { financialYearRoutes } from './modules/financial-years/financial-years.routes';
import { transactionRoutes } from './modules/transactions/transactions.routes';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes';
import { reportsRoutes } from './modules/reports/reports.routes';
import { organizationRoutes } from './modules/organizations/organization.routes';
import { auditRoutes } from './modules/audit/audit.routes';
import { exchangeRatesRoutes } from './modules/exchange-rates/exchange-rates.routes';
import { partiesRoutes } from './modules/parties/parties.routes';
import { masterDataRoutes } from './modules/master-data/master-data.routes';

import { encryptionMiddleware } from './shared/encryption.middleware';

import { jwtConfig } from './shared/jwt.config';

const serverUploadsRoot = resolve(import.meta.dir, '..', 'uploads');
const cwdUploadsRoot = resolve(process.cwd(), 'uploads');
const backendUploadsRoot = resolve(process.cwd(), 'Backend/uploads');
const uploadSearchRoots = Array.from(new Set([serverUploadsRoot, cwdUploadsRoot, backendUploadsRoot]));

const normalizeUploadRequestPath = (rawPath: string) => {
  let normalizedPath = rawPath
    .replace(/\\/g, '/')
    .trim();

  const uploadsSegmentIndex = normalizedPath.lastIndexOf('uploads/');
  if (uploadsSegmentIndex !== -1) {
    normalizedPath = normalizedPath.slice(uploadsSegmentIndex + 'uploads/'.length);
  }

  return normalizedPath.replace(/^\/+/, '');
};

const findAttachmentByName = (rootDir: string, targetName: string): string | null => {
  try {
    const entries = readdirSync(rootDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = resolve(rootDir, entry.name);

      if (entry.isDirectory()) {
        const nestedMatch = findAttachmentByName(fullPath, targetName);
        if (nestedMatch) return nestedMatch;
        continue;
      }

      if (
        entry.name === targetName ||
        entry.name.endsWith(`-${targetName}`) ||
        targetName.endsWith(`-${entry.name}`)
      ) {
        return fullPath;
      }
    }
  } catch (_error) {
    return null;
  }

  return null;
};

export const createApp = () => {
  const app = new Elysia({
    prefix: '/api'
  })
    .use(cors({
      origin: true,
      allowedHeaders: '*'
    }))
    .use(encryptionMiddleware)
    // Removed global authMiddleware - each route applies it individually
    .onError(({ code, error, set, request, body }) => {
      const errorMessage = (error as any)?.message || String(error);

      if (errorMessage === 'Unauthorized' ||
        code === 'INVALID_COOKIE_SIGNATURE' ||
        errorMessage.includes('Unauthorized') ||
        errorMessage === 'Invalid token') {
        set.status = 401;
      } else {
        set.status = 400; // Default to 400 for other errors
      }

      return {
        success: false,
        message: errorMessage || 'An error occurred'
      };
    });

  // Serve Static Files
  app.get('/uploads/*', async ({ params, set }) => {
    const rawParams = params['*'] || '';
    const decodedParams = decodeURIComponent(rawParams);
    const requestedPath = normalizeUploadRequestPath(decodedParams);
    const candidatePaths = [
      requestedPath.startsWith('/') ? requestedPath : '',
      resolve(serverUploadsRoot, requestedPath),
      resolve(cwdUploadsRoot, requestedPath),
      resolve(backendUploadsRoot, requestedPath),
    ].filter(Boolean);

    for (const candidatePath of candidatePaths) {
      const file = Bun.file(candidatePath);
      if (await file.exists()) {
        return file;
      }
    }

    const requestedFileName = basename(requestedPath);
    if (requestedFileName) {
      for (const searchRoot of uploadSearchRoots) {
        const matchedFilePath = findAttachmentByName(searchRoot, requestedFileName);
        if (!matchedFilePath) continue;

        const file = Bun.file(matchedFilePath);
        if (await file.exists()) {
          return file;
        }
      }
    }
    set.status = 404;
    return { success: false, message: 'File not found' };
  });


  // Health check
  app.get('/test404', () => "working"); app.get('/health', () => ({
    status: 'ok',
    service: 'Auth API'
  }));

  // Register modules
  app.use(authRoutes);
  app.use(branchesRoutes);
  app.use(accountsRoutes);
  app.use(categoryRoutes);
  app.use(financialYearRoutes);
  app.use(transactionRoutes);
  app.use(dashboardRoutes);
  app.use(reportsRoutes);
  app.use(organizationRoutes);
  app.use(auditRoutes);
  app.use(exchangeRatesRoutes);
  app.use(partiesRoutes);
  app.use(masterDataRoutes);


  return app;
};
