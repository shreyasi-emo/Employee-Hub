# EMO Employee Hub — v2 Deployment Guide

This is the production-ready v2 of the Hub. It extends the existing HRIS with:
**Logistics movements · Unified request intake · CEO approval notes · Reimbursements
with Zoho Books push · Company vehicle calendar · Reference docs (policies/calendar/
quality) · Google SSO (replaces password login)**.

The codebase already had a complete HRIS (attendance, leave, payroll, performance,
onboarding, shifts, assets, announcements, audit, workspace approvals). That stays
exactly as-is.

---

## 1. Environment variables (required)

```bash
# Postgres
DATABASE_URL=postgres://...

# Session
SESSION_SECRET=<generate a long random string>

# Google SSO (the only login method)
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
GOOGLE_REDIRECT_URI=https://<your-domain>/api/auth/google/callback
ALLOWED_EMAIL_DOMAINS=emoenergy.in   # comma-separated for multiple

# Server
PORT=5000
NODE_ENV=production

# Optional (existing features)
SENDGRID_API_KEY=...                  # for outbound email
BOOTSTRAP_TOKEN=<long random>         # for first-admin creation (one-time)
```

**Zoho Books credentials are NOT environment vars** — finance plugs them into the DB
through the Zoho config screen (`/api/zoho/config`). The Hub stays disabled until they
do, and queued sync jobs sit safely until enabled.

---

## 2. Google OAuth setup (5 minutes)

1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client (Web).
2. Authorized JavaScript origins: `https://<your-domain>`
3. Authorized redirect URI: `https://<your-domain>/api/auth/google/callback`
4. Copy client id + secret into the env vars above.
5. Set `ALLOWED_EMAIL_DOMAINS=emoenergy.in`.

Users must already exist (HR provisions them with their company email on the employee
record). Unknown emails are rejected. No self-signup.

---

## 3. Install & migrate

```bash
npm install                  # picks up google-auth-library
npm run db:push              # creates the 10 new tables (Drizzle)
npm run build                # builds the client
npm start                    # production server
```

The scheduler will register two cron jobs automatically:
- Monthly leave accrual (1st of month, Asia/Kolkata) — existing
- Zoho sync drain (every 2 minutes) — new; no-op until finance enables Zoho

---

## 4. Seed the 9 teams (one-time, via Admin Settings page)

Create departments matching your team structure so request routing works:

| Code | Name |
|---|---|
| MECH | Mechanical |
| ELEC | Electrical |
| HW | Hardware |
| FW | Firmware |
| SW | Full-Stack Software |
| OPS | Operations |
| FIN | Finance |
| HR | HR |
| ADMIN | Admin |
| LOG | Logistics |

Set each team's `headId` to the team lead's employee id (for org chart + notifications).

---

## 5. Roles

The role enum gained one new value: **`logistics`**. Assign this to the logistics team
members so they see the logistics queue and can accept/dispatch movements.

Existing roles are unchanged: `super_admin`, `hr_admin`, `hr_executive`, `finance`,
`manager`, `employee`, `recruiter`, `hr_ops`, `office_admin`, `ceo_approver`,
`interviewer`.

---

## 6. Zoho Books — when finance is ready

1. Finance creates a Zoho Books OAuth client (self-client or web app).
2. They generate a refresh token (scopes: `ZohoBooks.fullaccess.all`).
3. They open the Hub's Zoho config endpoint (`POST /api/zoho/config`) with:
   ```json
   {
     "organizationId": "<zoho org id>",
     "clientId": "...", "clientSecret": "...", "refreshToken": "...",
     "defaultExpenseAccountId": "<expense GL account id from Zoho>",
     "enabled": true
   }
   ```
4. The 2-minute cron picks up queued jobs and pushes reimbursements → Zoho Expenses.

For now, only **reimbursements → expenses** is wired end-to-end. Purchase orders,
bills, and vendor payments use the same `enqueueZohoPush` helper and `mapXToY` pattern
— finance + your team can extend `server/zoho.ts` as those mappings are needed.

**Security:** add encryption-at-rest for `zohoConfig.refreshToken` and
`zohoConfig.clientSecret` before going live. The Hub never returns these to clients.

---

## 7. What's deliberately not in this build (per scope decision)
- Amazon integration (just a request; HR buys manually)
- Gmail / WhatsApp integration (messaging stays as-is)
- Ops software, factory/ThingCharge dashboard links
- DC (delivery challan) generation — stays with logistics team
- Live company-events/RSVP (calendar is a static yearly doc in Resources)
- Email-as-action / one-click approve

---

## 8. What's new in the navigation

Sidebar (Company section) gains five items:
- **Requests** — everyone raises here; teams see their queue
- **Logistics** — material movement; logistics team's queue
- **Vehicles** — company car booking + calendar
- **Resources** — policies, yearly calendar, quality docs
- **Approval Notes** — CEO inbox for team-bundled approvals

---

## 9. Quick smoke-test sequence after deploy

1. Sign in with Google → lands on dashboard.
2. Open Resources → upload a test policy doc (HR role).
3. Open Logistics → add a few locations (BLR HQ, Mysore Factory, Gurgaon Ops).
4. Raise a movement → confirm it appears on the logistics queue.
5. Raise a Request (online purchase, with a link + photo URL) → confirm it lands on HR's team queue.
6. From HR queue, create a CEO Approval Note bundling that request → it appears in CEO's Approval Notes.
7. CEO approves → linked request flips to approved.
8. Raise a reimbursement → approve it → confirm a `zoho_sync_jobs` row is created with `status=pending` (it stays pending until finance enables Zoho — that's correct).

---

## 10. Files modified / added (for your code review)

**Modified:**
- `shared/schema.ts` — appended 10 tables + insert schemas + types
- `server/storage.ts` — appended ~40 methods for the new tables
- `server/routes.ts` — added Google SSO routes + `registerV2Routes(app)` call
- `server/scheduler.ts` — added Zoho sync cron (every 2 minutes)
- `client/src/App.tsx` — 5 new routes
- `client/src/components/app-sidebar.tsx` — 5 new nav items
- `client/src/pages/login.tsx` — replaced password login with Google SSO button
- `client/src/lib/auth.ts` — added `logistics` to UserRole + label
- `package.json` — added `google-auth-library`

**Added:**
- `server/google-auth.ts` — Google SSO handlers
- `server/zoho.ts` — Zoho Books push worker
- `server/routes-v2.ts` — all v2 API endpoints
- `client/src/pages/logistics.tsx`
- `client/src/pages/requests.tsx`
- `client/src/pages/approval-notes.tsx`
- `client/src/pages/vehicles.tsx`
- `client/src/pages/resources.tsx`
- `DEPLOY.md` (this file)
