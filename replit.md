# EMO HRIS — replit.md

## Overview

EMO HRIS is a full-stack Human Resource Information System (HRIS) built for a company of ~200 employees. It is inspired by products like DarwinBox and GreytHR and covers the core HR lifecycle:

- **Employee Master & Org Structure** — departments, designations, employee profiles
- **Attendance Management** — calendar view, regularization requests
- **Leave Management** — leave types, balances, approval workflows, ledger
- **Payroll (India)** — payroll runs, payslips, LOP calculations, statutory config
- **Holidays** — configurable holiday calendar
- **Announcements** — company-wide communication
- **Asset Management** — tracking laptops, devices, etc.
- **Admin Settings** — departments, designations, leave types, users, salary structures
- **Audit Logs** — tamper-evident log of sensitive actions (role-gated)
- **Performance Management** — KPI goals, review cycles, self/manager reviews, calibration, reports (DarwinBox-style)
- **Employee Self-Service** — Invite-based signup, forgot/reset password, self-edit personal fields, account settings page
- **In-App Notifications** — Bell icon in header with unread badge, mark-read, mark-all-read, auto-triggered on leave/regularization events
- **Shifts & Shift Assignments** — Shift definitions with weekly-off, grace period; individual and bulk assignment; weekly roster view
- **Employment History** — Auto-tracked changes to designation, department, manager, location, status; visible as a "History" tab on employee profile
- **HR/Admin Workspace** — ATS/Recruitment Kanban, HR Ops, Office Admin, CEO Approvals Inbox (role-gated); full purchase/travel/payment request flow with CEO approval
- **Company Workspace** — Service catalog hub visible to ALL employees; My Requests (purchase with multi-item form, travel, tickets with comments); Team Requests for managers (read-only view of direct reports)
- **Onboarding** — Template-based task checklists, instance tracking per employee, role-based task ownership

The app is designed desktop-first with mobile responsiveness and supports light/dark themes.

---

## User Preferences

Preferred communication style: Simple, everyday language.

---

## System Architecture

### Frontend

- **Framework**: React (with Vite as the build tool), TypeScript, SPA architecture
- **Routing**: `wouter` — lightweight client-side routing
- **Data Fetching**: TanStack Query (React Query) v5 — all server state managed via query keys mapped to API paths (e.g., `["/api/employees"]`)
- **Forms**: `react-hook-form` + `zod` + `@hookform/resolvers` for schema-validated forms
- **UI Components**: shadcn/ui (new-york style) built on top of Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming; custom color tokens in `index.css`
- **Theme**: Light/dark mode managed via a custom `ThemeProvider` using `localStorage` persistence and a class on `<html>`
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

Key frontend pages:
- `/` — Dashboard
- `/employees` — Employee list (HR roles) / `/employees/me` (self-service)
- `/employees/:id` — Employee profile with tabs (info, salary, assets, docs)
- `/attendance` — Calendar view + regularization
- `/leave` — Leave requests + approvals
- `/holidays` — Holiday calendar
- `/payroll` — Payroll runs + payslip viewer
- `/announcements` — Company announcements
- `/assets` — Asset tracking
- `/admin` — Admin settings (departments, designations, leave types, users, statutory config)
- `/audit` — Audit log viewer (super_admin / hr_admin only)
- `/performance` — Performance Management (goals, reviews, cycles, calibration, reports)
- `/settings` — Account Settings (change password, self-edit personal/emergency contact fields)
- `/invite/:token` — Invite accept page (set password to activate account)
- `/reset-password/:token` — Password reset page (via forgot-password flow)
- `/shifts` — Shift definitions, assignments, and weekly roster (HR/admin only)
- `/onboarding` — Onboarding instances and template management (HR/admin only)
- Employee profile `/employees/:id` has a "History" tab showing employment changes

### Backend

- **Runtime**: Node.js with Express v5 (TypeScript, ESM modules)
- **Entry point**: `server/index.ts` → registers routes via `server/routes.ts`
- **Storage layer**: `server/storage.ts` — a plain object (`storage`) with typed async methods wrapping Drizzle ORM queries. This is the single access point to the database from routes.
- **Auth**: Session-based authentication using `express-session` backed by PostgreSQL (`connect-pg-simple`). Passwords hashed with Node's built-in `crypto.scrypt`. No JWT.
- **Reset tokens**: Stored as SHA-256 hashes in the DB (never raw). Public forgot-password endpoint never reveals the URL — only HR admins can generate reset links via `POST /api/hr/users/:userId/generate-reset-link`.
- **Role system**: Multiple roles — `super_admin`, `hr_admin`, `hr_executive`, `finance`, `manager`, `employee`, etc. Middleware functions `requireAuth`, `requireRole`, `requireHR`, `requireAdmin` gate routes. Manager approval endpoints are scoped to direct reports only.
- **PII sanitization**: `server/utils/sanitize.ts` — `sanitizeEmployeeForRole()` strips bank, PAN, Aadhaar and address fields for non-HR viewers. Applied on all employee list and detail responses.
- **Audit logging**: Every sensitive mutation writes to an `auditLogs` table via a `log()` helper in `routes.ts`.
- **Seeding**: `server/seed.ts` — NOT called on startup. Run manually with `npm run seed` (dev only). In production, the first admin is created via `POST /api/auth/bootstrap` using the `BOOTSTRAP_TOKEN` env var (endpoint disables itself after first user is created).
- **Account provisioning**: New employees are created with an invite token (no default password). HR gets the invite URL in the API response and shares it with the employee, who sets their own password via `/invite/:token`.

### Shared Layer

- **Location**: `shared/schema.ts`
- **Purpose**: Single source of truth for all database table definitions and TypeScript types, shared between server and client (for type safety on API responses)
- **ORM**: Drizzle ORM with `drizzle-zod` for automatic schema → Zod validator generation
- **Validation**: `insertXSchema` validators are exported from `shared/schema.ts` and used in both routes (server-side validation) and forms (client-side)

### Database

- **Engine**: PostgreSQL
- **ORM**: Drizzle ORM (`drizzle-orm/node-postgres` with the `pg` Pool driver)
- **Connection**: `DATABASE_URL` environment variable; SSL enabled in production
- **Migrations**: Drizzle Kit (`drizzle-kit push` for schema sync, migrations output to `./migrations/`)
- **Session store**: `session` table managed by `connect-pg-simple` (auto-created)

Key tables in `shared/schema.ts`:
- `users` — auth accounts linked to employees
- `employees` — master employee records
- `departments`, `designations` — org structure
- `salaryStructures` — per-employee salary breakdown (basic, HRA, allowances, deductions)
- `attendanceRecords`, `regularizationRequests` — daily attendance
- `leaveTypes`, `leaveBalances`, `leaveLedger`, `leaveRequests` — full leave lifecycle
- `holidays` — configurable holiday list
- `payrollRuns`, `payslips` — payroll cycle management
- `statutoryConfig` — India-specific statutory settings (PF, ESI, PT)
- `documents`, `announcements`, `assets` — supporting modules
- `auditLogs` — immutable action log
- `ratingScales` — performance rating scale definitions (1-5, labels, etc.)
- `performanceCycles` — HR-configured review cycles (draft/active/locked/archived)
- `goals` — employee KPI/goals per cycle (with weight, category, status, approval)
- `goalProgressUpdates` — timeline of progress entries per goal
- `reviews` — self + manager review data per cycle per employee (versioned with revisions)
- `calibrationSessions` — HR calibration with rating distribution adjustments

### Build & Deployment

- **Dev**: `tsx server/index.ts` serves both API (Express) and frontend (Vite middleware mode with HMR)
- **Production build**: `script/build.ts` — runs `vite build` (client → `dist/public`) then `esbuild` (server → `dist/index.cjs`), bundling a curated allowlist of server dependencies
- **Static serving**: In production, Express serves `dist/public` as static files and falls through to `index.html` for SPA routing

---

## External Dependencies

### Core Infrastructure
| Dependency | Purpose |
|---|---|
| PostgreSQL | Primary database |
| `pg` (node-postgres) | Database driver |
| `connect-pg-simple` | PostgreSQL-backed session store |
| `express-session` | Session management |

### ORM & Validation
| Dependency | Purpose |
|---|---|
| `drizzle-orm` | Database ORM |
| `drizzle-kit` | Schema migration tooling |
| `drizzle-zod` | Auto-generate Zod schemas from Drizzle tables |
| `zod` | Runtime validation |

### UI Libraries
| Dependency | Purpose |
|---|---|
| Radix UI (many packages) | Headless accessible components (dialog, select, tabs, etc.) |
| `shadcn/ui` | Pre-styled component layer over Radix |
| Tailwind CSS | Utility-first CSS |
| `lucide-react` | Icon set |
| `recharts` | Charts (used in dashboard/payroll views) |
| `date-fns` | Date formatting and calculation |
| `embla-carousel-react` | Carousel component |
| `cmdk` | Command palette |
| `vaul` | Drawer component |

### State & Forms
| Dependency | Purpose |
|---|---|
| `@tanstack/react-query` | Server state management and caching |
| `react-hook-form` | Form state management |
| `@hookform/resolvers` | Zod integration for react-hook-form |

### Build & Dev Tools
| Dependency | Purpose |
|---|---|
| Vite + `@vitejs/plugin-react` | Frontend bundler / dev server |
| `tsx` | TypeScript execution for server in dev |
| `esbuild` | Server bundler for production |
| `@replit/vite-plugin-runtime-error-modal` | Dev overlay for runtime errors |
| `@replit/vite-plugin-cartographer` | Replit-specific dev tool |
| `typescript` | Type checking |

### Environment Variables Required
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string **(required — server exits on boot if missing)** |
| `SESSION_SECRET` | Express session signing secret (falls back to insecure dev default if missing) |
| `BOOTSTRAP_TOKEN` | One-time secret for creating the first admin; endpoint disables after first user |
| `NODE_ENV` | `development` or `production` |