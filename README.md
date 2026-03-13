# Dashboard Monorepo Guide

This workspace contains two apps:

- `Auth_api 2` - backend (Bun + Elysia API)
- `Finance_Panel 4 2` - frontend (React + Vite app at `my-react-app`)

## 1) Project Structure

- `Auth_api 2/`
- `Auth_api 2/src/`
- `Auth_api 2/src/modules/` domain modules (`auth`, `accounts`, `category`, `transactions`, `reports`, etc.)
- `Auth_api 2/src/shared/` middleware/services (auth, encryption, websocket, exchange rate, email)
- `Finance_Panel 4 2/my-react-app/`
- `Finance_Panel 4 2/my-react-app/src/modules/` feature pages
- `Finance_Panel 4 2/my-react-app/src/components/` shared UI/layout
- `Finance_Panel 4 2/my-react-app/src/context/` app state contexts (auth/org/branch/year/preferences/toast)

## 2) Tech Stack

### Backend (`Auth_api 2`)
- Runtime: Bun
- Framework: Elysia
- ORM: Drizzle (`mysql2`)
- Auth: JWT + middleware
- Real-time: WebSocket endpoint (`/api/ws`)
- Data security: request/response encryption middleware

### Frontend (`my-react-app`)
- React + Vite
- Tailwind CSS
- Axios API layer with encryption/decryption interceptors
- React Router

## 3) Run Locally

## Backend
```bash
cd "Auth_api 2"
bun install
bun run dev
```

Default server:
- `http://127.0.0.1:3000`
- API prefix: `/api`

## Frontend
```bash
cd "Finance_Panel 4 2/my-react-app"
npm install
npm run dev
```

Vite dev proxy is configured:
- `/api` -> `http://127.0.0.1:3000`
- WebSocket proxy enabled

## 4) API/Request Flow

1. Frontend calls `src/services/api.js` (`baseURL: /api`)
2. Request interceptor:
- attaches auth/org/branch/currency headers
- encrypts payloads (except auth key endpoint and file form-data cases)
3. Backend routes mounted in `Auth_api 2/src/app.ts`
4. Response interceptor decrypts payload and normalizes role casing

## 5) Key Frontend Modules

- `src/modules/dashboard/` summary cards, recent transactions, category ranking
- `src/modules/accounts/` list + create/edit account
- `src/modules/category/` category/sub-category management
- `src/modules/transactions/` transaction list + create/edit
- `src/modules/reports/` financial reporting
- `src/modules/settings/` user/system preferences
- `src/modules/audit/` audit logs

## 6) Key Backend Modules

- `auth` login/otp/token/session
- `organizations` org-level operations
- `branches` branch setup/access
- `accounts` chart-of-accounts operations + balances
- `category` categories/sub-categories
- `transactions` posting + entries + import
- `dashboard` aggregate metrics
- `reports` report generation
- `audit` audit logs

## 7) Configuration Notes

- Backend env defaults are in `Auth_api 2/src/config/env.ts`
- Frontend proxy config is in `Finance_Panel 4 2/my-react-app/vite.config.js`
- If moving to production, replace hardcoded defaults with secure environment variables.

## 8) Important Implementation Notes

- This project uses encrypted API payload transport, so direct plain JSON debugging can be misleading unless you inspect decrypted responses.
- Branch/organization are context-driven and injected as headers; incorrect local storage state can affect data scope.
- UI responsiveness includes custom breakpoint-specific CSS in `src/index.css`.

## 9) Troubleshooting

- API not reachable from frontend:
  - ensure backend runs on `3000`
  - verify Vite proxy settings
- Auth-related request cancellations:
  - check `accessToken`, `selectedOrg`, `selectedBranch` in local storage
- Data mismatch after UI change:
  - restart backend if service logic changed
  - hard refresh frontend to clear stale client state

## 10) Existing App READMEs

- `Auth_api 2/README.md` (basic Bun scaffold)
- `Finance_Panel 4 2/my-react-app/README.md` (default Vite template)

This root README is the practical, project-specific guide.
