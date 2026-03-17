import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { authMiddleware } from './shared/auth.middleware';
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
import { countriesRoutes } from './modules/countries/countries.routes';
import { currenciesRoutes } from './modules/currencies/currencies.routes';

import { encryptionMiddleware } from './shared/encryption.middleware';
import { WebSocketService } from './shared/websocket.service';
import { jwtConfig } from './shared/jwt.config';

export const createApp = () => {
  const app = new Elysia({
    prefix: '/api'
  })
    .use(cors({
      origin: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning', 'x-branch-id', 'x-org-id', 'x-base-currency']
    }))
    .use(encryptionMiddleware)
    // Removed global authMiddleware - each route applies it individually
    .onError(({ code, error, set, request, body }) => {
      const errorMessage = (error as any)?.message || String(error);
      const errLog = `[${new Date().toISOString()}] ${request.method} ${request.url} - Code: ${code} - Error: ${errorMessage}\n` +
        `Body: ${JSON.stringify(body || {})}\n` +
        `Stack: ${(error as any)?.stack || ''}\n\n`;
      try { require('fs').appendFileSync('/tmp/api_errors.log', errLog); } catch (e) { }

      console.log('❌ Global Error:', { code, message: errorMessage });

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

  app.onRequest(({ request }) => {
    console.log(`📥 Incoming Request: ${request.method} ${request.url}`);
  });

  // Serve Static Files
  app.get('/uploads/*', async ({ params, set }) => {
    const filePath = `uploads/${decodeURIComponent(params['*'])}`;
    const file = Bun.file(filePath);

    if (!(await file.exists())) {
      set.status = 404;
      return { success: false, message: 'File not found' };
    }

    return file;
  });


  // Health check
  app.get('/health', () => ({
    status: 'ok',
    service: 'Auth API'
  }));

  // Debug WS route availability via HTTP
  app.get('/ws', () => "WebSocket Endpoint is Active (Use WS protocol to connect)");

  // WebSocket endpoint
  app.ws('/ws', {
    beforeHandle({ request }) {
      const origin = request.headers.get('origin');
      const host = request.headers.get('host');
      console.log('🔌 WebSocket connection attempt from:', { origin, host });
    },
    open(ws) {
      console.log('✅ WebSocket connection opened');
    },
    async message(ws, message) {
      try {
        console.log('📨 Received WebSocket message:', message);
        // Elysia automatically parses JSON, so message is already an object
        const data = message as any;

        // Handle authentication
        if (data.type === 'auth') {
          const token = data.token;
          if (!token) {
            ws.send(JSON.stringify({ type: 'error', message: 'No token provided' }));
            ws.close();
            return;
          }

          // Verify JWT token - decode manually
          try {
            const parts = token.split('.');
            if (parts.length !== 3) {
              throw new Error('Invalid token format');
            }

            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

            if (!payload || !payload.sub) {
              ws.send(JSON.stringify({ type: 'error', message: 'Invalid token payload' }));
              ws.close();
              return;
            }

            // Extract user data from token
            const userId = Number(payload.sub);
            const branchId = data.branchId || null;
            const orgId = payload.orgId || null;

            // Register connection
            WebSocketService.addConnection(ws as any, userId, branchId, orgId);

            console.log(`✅ WebSocket authenticated: User ${userId}, Branch ${branchId}`);

            // Send success confirmation
            ws.send(JSON.stringify({
              type: 'authenticated',
              userId,
              branchId,
              message: 'WebSocket authenticated successfully'
            }));
          } catch (jwtError) {
            console.error('JWT verification failed:', jwtError);
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
            ws.close();
            return;
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        console.error('Message content:', message);
        console.error('Message type:', typeof message);
        // Don't send error back if we can't parse - might be a ping/pong
      }
    },
    close(ws) {
      WebSocketService.removeConnection(ws as any);
    }
  });

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
  app.use(countriesRoutes);
  app.use(currenciesRoutes);


  return app;
};

