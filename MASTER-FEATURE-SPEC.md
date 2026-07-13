# EMO Employee Hub — Master Feature Spec & Productionization Handoff

**For:** Co-founder review → productionization
**From:** COO (scope owner)
**What this is:** The company-level operating layer for EMO Energy. Every team —
Mechanical, Electrical, Hardware, Firmware, Full-Stack Software, Operations, Finance,
HR, Admin, Logistics — uses it. It replaces GreytHR entirely and becomes the single
front door for company life: attendance, leave, payroll, requests, logistics, policies.

**What it is NOT:** It does not replace Ops' own software, the factory/ThingCharge
systems, Zoho (finance accounting stays in Zoho — Hub only pushes to it), or Gmail/
WhatsApp (human messaging stays as-is). See "Boundaries" below.

---

## 1. Current build status (already implemented — verified in code)

A real full-stack app: **53 tables, 180 API routes, 22 pages.** React + TypeScript +
Vite frontend; Express v5 + Postgres + Drizzle ORM backend; session auth; role-based
access; PII sanitization by role; tamper-evident audit logs; SendGrid email; a monthly
leave-accrual cron.

**HR core (the GreytHR replacement) — DONE:**
- Employee master + org structure (departments, designations)
- Attendance (calendar, regularization) · Leave (types, balances, ledger, accrual, approvals)
- Payroll (runs, payslips, LOP) + **India statutory** (PF, ESI, PT)
- Performance (goals, review cycles, calibration) · Onboarding (templates, instances)
- Shifts & rosters · Assets · Announcements · Holidays
- Employee self-service (each login sees only their own data) · In-app notifications
- Audit logs · Admin settings

**Workspace (partial) — DONE:** ATS/recruitment, HR ops, office admin, purchase &
travel requests, a CEO approvals inbox, vendor records.

---

## 2. What's being ADDED in v2 (this handoff)

### A. Google SSO — the only login
Company email only, no passwords, no self-signup (HR provisions). Removes the entire
password/reset/invite-password surface. → `server/google-auth.ts`. Needs a Google OAuth
client + `google-auth-library`.

### B. Logistics Movements (the main new module)
Material movement: parts/components across **Bengaluru ↔ Mysore ↔ Gurgaon** + **daily
intercity battery transfers** (incl. customer shipments). Item list with **quantity,
weight, dimensions, volume** (so it can be quoted). Anyone raises → goes **straight to
the logistics team** (no mandatory approver). Logistics **accepts & fulfils**, or
**escalates to CEO** if unsure. Full lifecycle: submitted → accepted/escalated →
dispatched → in_transit → delivered, with a per-movement event log.
→ `schema-additions.ts` (movementLocations, logisticsMovements, movementEvents).
**DCs stay with the logistics team — out of scope.**

### C. Unified Request Intake ("I need something")
One front door that routes by type to the right team:
- **Online/Amazon purchase** — request with **item link + photo + qty** → routes to **HR**,
  who purchase on Amazon themselves. (No Amazon integration — just the request.)
- Supplies / facilities / IT → **Admin**
- HR asks → **HR** · Finance asks → **Finance**
- Material movement → uses the richer **Logistics Movements** module (B)
Threaded comments per request for back-and-forth (no chatbot — structured requests carry it).
→ `schema-additions-part2.ts` (requests, requestComments).

### D. CEO Approval Notes (the single approval mechanism)
Approval is **not** an automatic amount/threshold gate. A team (typically **HR batching
the day's purchase requests**) bundles items into **one note to the CEO**. CEO approves/
rejects the note; approval flips the linked requests to approved → team proceeds to buy.
→ `schema-additions-part2.ts` (ceoApprovalNotes).

### E. Reference Docs — Policies · Yearly Calendar · Quality
HR/admin **uploads a file + a short summary note**; everyone views/downloads. The yearly
company calendar is a static doc prepared once (not a live events system). Quality and
policy docs use the same mechanism. No in-Hub rendering.
→ `schema-additions-part2.ts` (referenceDocs).

### F. Zoho Books Sync (finance push)
Hub is **not** the finance system of record. Approved financial events push into **Zoho
Books** via API; **finance owns the Zoho org + credentials**. Idempotent (no double-
creates), queued, retried 5× then parked. Mappings: reimbursement→expense,
purchase→PO, vendor payment→bill, travel bill→expense. Until finance enables it, jobs
queue safely. → `server/zoho.ts`. Reimbursements become a first-class Hub object so
people raise them here (replacing Zoho Expense for raising).

### G. Company Car calendar
`companyVehicles` + `vehicleBookings` with a shared calendar. One car now, extensible.
→ `schema-additions.ts`.

### H. Team model
The 9+ teams (Mechanical, Electrical, Hardware, Firmware, Software, Ops, Finance, HR,
Admin, Logistics) seed into the existing `departments` table — no schema change, just
seed data + set each team's head. Drives request routing and the org chart.

---

## 3. Boundaries (system-of-record map)

| Domain | System of record | Hub's role |
|---|---|---|
| HR / leave / attendance / payroll / performance | **Hub** | Owns it. Replaces GreytHR. |
| Internal requests + logistics movement | **Hub** | Owns it end-to-end. |
| Reference docs (policy/calendar/quality) | **Hub** | Hosts uploaded files + notes. |
| Finance accounting / invoicing / PO / billing | **Zoho Books** | Hub pushes approved events in. |
| Files | **Google Drive** | Unchanged. Hub stores links. |
| Human messaging | **Gmail + WhatsApp** | Unchanged. Hub does not integrate (deferred). |
| Operations | **Ops' own software** | Out of scope — not rebuilt. |
| Manufacturing | **ThingCharge / factory** | Out of scope. |
| Login | **Google SSO** | Company email only. |

---

## 4. Explicitly deferred / out of scope
- Amazon integration (just a request; HR buys manually)
- Gmail / WhatsApp integration (messaging stays as-is)
- Ops software, factory/ThingCharge, factory/ops dashboard links
- DC (delivery challan) generation — stays with logistics team
- Live company-events/RSVP system (calendar is a static yearly doc)
- Email-as-action / one-click approve from email (revisit after core is live)

---

## 5. Build sequence (recommended for productionization)
1. **Schema** — merge `schema-additions.ts` + `schema-additions-part2.ts` into
   `shared/schema.ts`; `npm run db:push`. Seed the 9 teams + heads.
2. **Google SSO** — wire it, provision team emails, cut over login (day-one change).
3. **Logistics Movements** — storage + routes + `/logistics` page. Highest-value new surface.
4. **Unified Requests + CEO Approval Notes** — intake form, team queues, CEO note inbox.
5. **Reimbursements + Zoho scaffold** — ship reimbursements; keep Zoho disabled (queue fills safely).
6. **Reference Docs + Company Car calendar** — quick wins.
7. **GreytHR cutover** — switch the team off GreytHR once SSO + HR core are live.
8. **Flip Zoho on** — finance configures credentials; queued jobs drain into Books.

## 6. Remaining engineering work (follows existing patterns mechanically)
- Storage methods for each new table (mirror `server/storage.ts` style)
- Route handlers (mirror `/api/workspace/*`) + new `requireLogistics` middleware + `logistics` role
- React pages: `/logistics`, `/requests`, `/approvals` (CEO notes), `/resources` (reference docs), `/vehicles`
- Finance-only admin screen for Zoho config
- Encrypt Zoho secrets at rest; finance-role gating on zohoConfig

## 7. New dependency & env
- `npm i google-auth-library`
- Env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`,
  `ALLOWED_EMAIL_DOMAINS=emoenergy.in`. (Zoho creds live in DB, finance-managed.)

---

## Files in this handoff
- `BUILD-SPEC-V2.md` — module-level build spec (routes, states, UI)
- `MASTER-FEATURE-SPEC.md` — this document
- `schema-additions.ts` — logistics, vehicles, Zoho, reimbursements
- `schema-additions-part2.ts` — unified requests, CEO approval notes, reference docs
- `server-google-auth.ts` — Google SSO
- `server-zoho.ts` — Zoho Books push worker
