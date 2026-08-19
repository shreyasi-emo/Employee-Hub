# Employee Hub — frontend map

Every screen in the app, where its code lives, and who can reach it.
**Generated from `app/routes.tsx` + `app/layout/nav-items.ts` — re-generate rather than hand-edit.**

## How the code is laid out

```
client/src/
├── app/              routing, providers, and the shell (sidebar + header)
│   ├── routes.tsx        every URL -> page component
│   └── layout/           app-sidebar, app-header, nav-items
├── components/
│   ├── ui/               shadcn primitives — don't hand-edit
│   └── shared/           components used by 2+ features
├── features/<name>/  one folder per product area
│   ├── pages/            the screen(s) — open these first
│   ├── components/       that screen's parts
│   ├── api/              every server call the feature makes
│   └── lib/              its rules, constants and calculations
├── hooks/            generic hooks (toast, mobile, paging)
└── lib/              app-wide: api client, formatting, status colours, brand
```

**Reading a screen:** open `features/<name>/pages/<name>-page.tsx`. It composes named
parts; click into whichever one you need. Change a server call → `api/`. Change a
rule → `lib/`.

## Screens

| Screen | URL | File | Who can reach it |
|---|---|---|---|
| Admin Settings | `/admin` | [features/admin/pages/admin-page](features/admin/pages/admin-page.tsx) | super_admin, hr_admin, hr_executive, finance |
| Announcements | `/announcements` | [features/announcements/pages/announcements-page](features/announcements/pages/announcements-page.tsx) | Everyone (12 roles) |
| Approval Notes | `/approval-notes` | [features/admin/pages/approval-notes-page](features/admin/pages/approval-notes-page.tsx) | 8 roles |
| Assets | `/assets` | [features/assets/pages/assets-page](features/assets/pages/assets-page.tsx) | super_admin, hr_admin, hr_executive, manager, office_admin |
| Attendance | `/attendance` | [features/attendance/pages/attendance-page](features/attendance/pages/attendance-page.tsx) | Everyone (12 roles) |
| Audit Logs | `/audit` | [features/audit/pages/audit-page](features/audit/pages/audit-page.tsx) | super_admin, hr_admin |
| Service Catalog | `/company-workspace` | [features/requests/pages/service-catalog-page](features/requests/pages/service-catalog-page.tsx) | Everyone (12 roles) |
| Dashboard | `/dashboard` | [features/dashboard/pages/dashboard-page](features/dashboard/pages/dashboard-page.tsx) | Everyone (12 roles) |
| Employees | `/employees` | [features/employees/pages/employees-page](features/employees/pages/employees-page.tsx) | super_admin, hr_admin, hr_executive, manager, hr_ops |
| Employee Profile | `/employees/:id` | [features/employees/pages/employee-profile-page](features/employees/pages/employee-profile-page.tsx) | — |
| Holidays | `/holidays` | [features/holidays/pages/holidays-page](features/holidays/pages/holidays-page.tsx) | Everyone (12 roles) |
| Invite Accept | `/invite/:token` | [features/auth/pages/invite-accept-page](features/auth/pages/invite-accept-page.tsx) | — |
| Leave | `/leave` | [features/leave/pages/leave-page](features/leave/pages/leave-page.tsx) | Everyone (12 roles) |
| Login | `/login` | [features/auth/pages/login-page](features/auth/pages/login-page.tsx) | — |
| Logistics | `/logistics` | [features/logistics/pages/logistics-page](features/logistics/pages/logistics-page.tsx) | Everyone (12 roles) |
| Company Workspace | `/my-approvals` | [features/requests/pages/service-catalog-page](features/requests/pages/service-catalog-page.tsx) | — |
| Reimbursement Review | `/my-approvals/reimbursement/:id` | [features/requests/reimbursements/pages/reimbursement-review-page](features/requests/reimbursements/pages/reimbursement-review-page.tsx) | — |
| My Requests | `/my-requests` | [features/requests/pages/my-requests-page](features/requests/pages/my-requests-page.tsx) | Everyone (12 roles) |
| My Requests | `/my-requests/:tab` | [features/requests/pages/my-requests-page](features/requests/pages/my-requests-page.tsx) | — |
| Onboarding | `/onboarding` | [features/onboarding/pages/onboarding-page](features/onboarding/pages/onboarding-page.tsx) | super_admin, hr_admin, hr_executive, manager, hr_ops |
| Payroll | `/payroll` | [features/payroll/pages/payroll-page](features/payroll/pages/payroll-page.tsx) | super_admin, hr_admin, finance, employee, manager, hr_ops |
| Performance | `/performance` | [features/performance/pages/performance-page](features/performance/pages/performance-page.tsx) | Everyone (12 roles) |
| Reimbursements | `/reimbursements` | [features/requests/reimbursements/pages/reimbursements-page](features/requests/reimbursements/pages/reimbursements-page.tsx) | — |
| Requests | `/requests` | [features/requests/pages/service-requests-page](features/requests/pages/service-requests-page.tsx) | Everyone (12 roles) |
| Invite Accept | `/reset-password/:token` | [features/auth/pages/invite-accept-page](features/auth/pages/invite-accept-page.tsx) | — |
| Resources | `/resources` | [features/resources/pages/resources-page](features/resources/pages/resources-page.tsx) | Everyone (12 roles) |
| Settings | `/settings` | [features/settings/pages/settings-page](features/settings/pages/settings-page.tsx) | Everyone (12 roles) |
| Shifts | `/shifts` | [features/shifts/pages/shifts-page](features/shifts/pages/shifts-page.tsx) | super_admin, hr_admin, hr_executive, manager, hr_ops |
| Team Requests | `/team-requests` | [features/requests/pages/team-requests-page](features/requests/pages/team-requests-page.tsx) | 7 roles |
| Vehicles | `/vehicles` | [features/vehicles/pages/vehicles-page](features/vehicles/pages/vehicles-page.tsx) | Everyone (12 roles) |
| CEO Inbox | `/workspace/approvals` | [features/requests/pages/service-catalog-page](features/requests/pages/service-catalog-page.tsx) | super_admin |
| ATS / Recruitment | `/workspace/ats` | [features/hr-workspace/pages/ats-page](features/hr-workspace/pages/ats-page.tsx) | super_admin, hr_admin, hr_executive, recruiter, hr_ops |
| HR Ops | `/workspace/hr-ops` | [features/hr-workspace/pages/hr-ops-page](features/hr-workspace/pages/hr-ops-page.tsx) | super_admin, hr_admin, hr_executive, hr_ops |
| Office Admin | `/workspace/office` | [features/hr-workspace/pages/office-admin-page](features/hr-workspace/pages/office-admin-page.tsx) | super_admin, hr_admin, office_admin |

## Features

- **`features/admin/`** — api, components, lib, pages
- **`features/announcements/`** — api, components, lib, pages
- **`features/assets/`** — api, components, lib, pages
- **`features/attendance/`** — api, components, lib, pages
- **`features/audit/`** — api, components, lib, pages
- **`features/auth/`** — api, lib, pages
- **`features/dashboard/`** — api, components, lib, pages
- **`features/employees/`** — api, components, lib, pages
- **`features/holidays/`** — api, components, lib, pages
- **`features/hr-workspace/`** — api, components, lib, pages
- **`features/leave/`** — api, components, lib, pages
- **`features/logistics/`** — api, components, lib, pages
- **`features/notifications/`** — components, lib
- **`features/onboarding/`** — api, components, lib, pages
- **`features/payroll/`** — api, components, lib, pages
- **`features/performance/`** — api, components, lib, pages
- **`features/requests/`** — office-purchases, pages, procurement, reimbursements, shared, tickets, travel
- **`features/resources/`** — api, components, lib, pages
- **`features/settings/`** — api, components, lib, pages
- **`features/shifts/`** — api, components, lib, pages
- **`features/vehicles/`** — api, components, lib, pages

## Conventions

- **Query keys are URLs.** `useQuery({ queryKey: ["/api/employees"] })` fetches that path
  (`lib/queryClient.ts` joins the key). Keep that shape — the cache depends on it.
- **Pages compose, they don't compute.** Data hooks and derivations belong in
  `api/` and `lib/`; the page wires them to components.
- **`components/shared/` is earned.** A component moves there once a second feature
  needs it — not in anticipation.
- **`components/ui/` is shadcn output.** Regenerated by the CLI; don't restructure it.
