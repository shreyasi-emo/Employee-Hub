# Employee Hub — Phase 1 Handover (`vercel-deploy`)

This branch is the **deployable, serverless build** of Employee Hub, live on Vercel. It is a
**deploy-only branch** — do day-to-day development on `main` and merge `main → vercel-deploy`
(downstream only) to update the deployment. **Never merge `vercel-deploy` into `main`.**

- **Live URL:** https://employee-hub-gules.vercel.app
- **Host:** Vercel — **Production Branch = `vercel-deploy`**. Every push to this branch auto-deploys to production.
  Do **not** point Vercel at `main` (it has no serverless config and will not run).

---

## 1. Serverless architecture (Vercel)

- **`server/app.ts`** exports `createApp()` — the Express app (body parsers, session, all feature routes,
  error handler). It is shared by local dev (`server/index.ts`) and the Vercel function (`api/index.ts`).
- **`api/index.ts`** is the single serverless function. `vercel.json` rewrites `/api/*` to it; the Express
  app handles routing under `/api/*`. The SPA is served statically from `dist/public`.
- **`vercel.json`**: `buildCommand: npm run build:vercel`, `outputDirectory: dist/public`,
  `functions."api/index.ts".maxDuration: 30`, rewrites `/api/(.*) → /api` and `/(.*) → /index.html`.

### ⚠️ The API function must use the pre-bundle — do not change this
`build:vercel` (`script/build-vercel.ts`) does two things:
1. Vite builds the client → `dist/public`
2. **esbuild pre-bundles the server → `dist/server/vercel.mjs`** (all imports, including the `@shared/*`
   path aliases, resolved and inlined). `api/index.ts` imports this bundle.

If `api/index.ts` imports `../server/app` directly instead, Vercel's function bundler does **not** resolve
`@shared/*`, and the function crashes at runtime with **`FUNCTION_INVOCATION_FAILED`** (the build still
passes — it only fails when invoked). Keep the esbuild pre-bundle step.

### Other serverless notes
- `server/db.ts` caps the Postgres pool to `max: 1` on serverless — use a **pooled** `DATABASE_URL`
  (Neon pooler / PgBouncer).
- Sessions are Postgres-backed (`connect-pg-simple`); cookies are `secure` + `sameSite=lax` + `trust proxy`.
- **The in-process cron scheduler does NOT run on serverless** (only local `server/index.ts` starts it).
  Leave accrual, auto-approvals, etc. need an **external scheduler** (e.g. Vercel Cron / cron-job.org hitting
  an endpoint) if/when those behaviours are needed.

---

## 2. Modules — what's exposed

**Visible (nav + routes):**
- **HR:** Dashboard, Employees (+ My Profile), Attendance, Leave, Holidays, Announcements
- **Company Workspace (full):** Company Workspace (service catalog), My Requests, Team Requests, Requests,
  Logistics, Vehicles, Resources, and the reimbursement flow (`/reimbursements`, `/my-approvals`,
  `/my-approvals/reimbursement/:id`)
- **HR/Admin Workspace (partial):** Office Admin (`/workspace/office`), CEO Inbox (`/workspace/approvals`)
- **Account:** Settings

**Hidden (nav + routes removed — the backend code is still present, just not exposed):**
Payroll, Performance, Assets, Shifts, Onboarding, Approval Notes, ATS/Recruitment, HR Ops,
Admin Settings, Audit Logs.

> To re-enable any hidden module, add it back to `client/src/app/layout/nav-items.ts` and
> `client/src/app/routes.tsx`. No backend work is needed — the modules/routes still exist server-side.

---

## 3. Authentication

**Current (temporary): username / password.**
- Login page posts to **`POST /api/auth/login`** (real credential check; works in production).
- The `/api/auth/dev-login` bypass exists but is **404 in production** — do not rely on it.
- Demo accounts (login dropdown fills the username; all share the demo password set at seed time):

  | Role | Username |
  |---|---|
  | Super Admin | `superadmin` |
  | HR | `priya.nair` |
  | Finance | `finance@emoenergy.in` |
  | CEO | `ceo@emoenergy.in` |
  | Manager | `manager@emoenergy.in` |
  | Logistics | `logistics@emoenergy.in` |
  | Employee | `sneha.patel` |

### 🔑 Google SSO — to be implemented (backend scaffolding already exists)
The backend is already wired for Google SSO:
- `server/google-auth.ts` implements the handlers.
- Routes are registered: **`GET /api/auth/google`** and **`GET /api/auth/google/callback`**.

To finish it:
1. Create a Google OAuth client. Authorized redirect URI: `https://<domain>/api/auth/google/callback`.
2. Set env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `ALLOWED_EMAIL_DOMAINS`.
3. Replace the username/password form in `client/src/features/auth/pages/login-page.tsx` with a
   **"Sign in with Google"** button → `window.location.href = "/api/auth/google"`.
4. Provisioning: `google-auth.ts` admits only emails whose domain is in `ALLOWED_EMAIL_DOMAINS` **and** that
   already exist as users (no self-signup) — HR provisions accounts.

---

## 4. Database

- **Neon Postgres** (pooled connection). Set up a fresh database with:
  ```bash
  DATABASE_URL="<pooled-url>" npm run db:push          # create schema
  DATABASE_URL="<pooled-url>" SEED_PASSWORD="<pw>" npm run db:seed   # demo data + accounts
  ```
  All seeded accounts share the `SEED_PASSWORD` you provide.
- ⚠️ **Known gotcha:** `drizzle-kit push` silently omitted the `logistics` value from the `role` enum on the
  first run. If a fresh DB is missing it, run:
  ```sql
  ALTER TYPE "role" ADD VALUE IF NOT EXISTS 'logistics';
  ```
  Verify the enum has all roles: `SELECT enum_range(NULL::role);`

---

## 5. Environment variables (Vercel → Settings → Environment Variables)

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon **pooled** connection string |
| `SESSION_SECRET` | ✅ | Long random string; enforced in production |
| `SEED_PASSWORD` | seeding only (local) | Shared demo-account password |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` / `ALLOWED_EMAIL_DOMAINS` | when implementing SSO | See §3 |
| `SENDGRID_API_KEY` | optional | Outbound email; in-app notifications work without it |

---

## 6. Local development

```bash
npm install
cp .env.example .env     # set DATABASE_URL + SESSION_SECRET
npm run db:push          # first time only
npm run db:seed          # first time only (seeds demo data)
npm run dev              # http://localhost:5000 (API + client on one port)
```

`npm run build` / `npm start` runs the app as a persistent Node server (not used by Vercel — that path is
`build:vercel` + the serverless function).

---

## 7. Deploy / update flow

- **Production branch:** `vercel-deploy`. Any push here auto-deploys.
- To bring new work from `main` into the deploy: merge `main → vercel-deploy` (downstream only).
- Quick post-deploy sanity check (from a terminal):
  ```bash
  curl -s https://employee-hub-gules.vercel.app/api/health        # -> 200 {"status":"ok"}
  curl -s https://employee-hub-gules.vercel.app/api/auth/me        # -> 401 (not logged in)
  ```
