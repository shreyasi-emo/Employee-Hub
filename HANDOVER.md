# Employee Hub — Phase 1 (Handover)

Internal HRIS for EMO Energy. This branch is the Phase-1 scope, cleaned for handover.

## Stack
- **Client:** React + TypeScript + Vite (wouter, React Query, shadcn/ui + Tailwind)
- **Server:** Express + Drizzle ORM
- **DB:** PostgreSQL (Neon or any Postgres)

## Run locally
1. `npm install`
2. Copy `.env.example` → `.env`, set `DATABASE_URL` (Postgres) and `SESSION_SECRET`.
3. `npm run db:push` — create the schema
4. `npm run db:seed` — demo data (set `SEED_PASSWORD` to control the demo password)
5. `npm run dev` — http://localhost:5000

Production: `npm run build` then `npm start`.

## Sign in
Quick-login on the login screen: pick a role to sign in instantly (password `password`).
**Roles:** Super Admin, HR Admin, HR Executive, Finance, CEO, CTO, Manager, Logistics, Employee.

## Modules
Dashboard · Employees (directory, profiles, documents) · Attendance · Leave · Holidays ·
Announcements · Company Workspace (requests & approvals: office purchases, procurement, travel,
reimbursements, tickets) · Logistics · Vehicles · Resources · Admin Settings (departments,
designations, leave types, users & access).

## Not done from our end — to be implemented
- **Google SSO** — sign-in is currently temporary username/password (quick-login). Replace with Google SSO.
- **Email notifications** — outbound email for leave / WFH / approval events is not wired (in-app notifications already fire; add the email layer).

## Before production
- Set a strong `SESSION_SECRET` and replace the demo accounts / seed data.
- Quick-login stays disabled unless `ENABLE_DEV_LOGIN=true` (the `dev` script sets it; production does not).
