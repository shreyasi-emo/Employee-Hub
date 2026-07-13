# EMO Employee Hub — v2 Build Spec
### Logistics · Zoho Books Sync · Google SSO · Company Car · GreytHR replacement

This spec extends the existing HRIS (53 tables, 180 routes, React/Express/Postgres,
Drizzle ORM). It does **not** rebuild anything that exists. It adds four capabilities
and confirms the boundaries decided with the COO.

---

## System-of-record boundaries (the decisions that govern everything)

| Domain | System of record | Hub's role |
|---|---|---|
| HR, leave, attendance, payroll, performance | **Hub** | Owns it. Replaces GreytHR fully, fresh start, no migration. |
| Internal requests (purchase, reimbursement, travel, vehicle) | **Hub** | Owns the request + approval. |
| **Logistics movement** (parts, battery transfers) | **Hub** | New module. Owns it end-to-end. DCs stay with logistics team (out of scope). |
| Finance — invoicing, PO, billing, vendor payments, accounting | **Zoho Books** | Hub **pushes** approved events via API. Finance owns Zoho + credentials. |
| Files | **Google Drive** | Unchanged. Hub stores links, not files. |
| Human messaging | **Gmail + WhatsApp** | Unchanged, untouched. Hub does NOT integrate these (deferred). |
| Manufacturing | **ThingCharge / factory** | Out of scope. No link for now. |
| Factory/Ops dashboards | their own systems | Deferred — link later, not now. |
| Login | **Google SSO only** | Company email only. No passwords. |

---

## Module 1 — Logistics Movements (the main new build)

**Behaviour:** Anyone raises a movement. It goes **straight to the logistics team**
(they are the desk — no mandatory approver). Logistics either **accepts and fulfils**,
or **escalates to the CEO** for approval if unsure.

**Lanes:** Bengaluru HQ ↔ Mysore Factory ↔ Gurgaon Ops, plus **daily intercity battery
transfers** including shipments to customers.

**Data:** Item list with quantity, **weight, dimensions, volume** (so a movement can be
quoted). Plus an `area` field, priority, requested date.

**Tables (see `schema-additions.ts`):** `movementLocations`, `logisticsMovements`,
`movementEvents`.

**States:** `submitted → (accepted | needs_approval → approved/rejected) → dispatched →
in_transit → delivered`, plus `cancelled`. Every transition writes a `movementEvents` row
(the auditable back-and-forth).

**Routes to add (mirror `/api/workspace/*` pattern):**
```
GET    /api/logistics/movements              list (logistics see all; others see own)
POST   /api/logistics/movements              raise (any authed user)
GET    /api/logistics/movements/:id
PATCH  /api/logistics/movements/:id/accept   logistics accepts
PATCH  /api/logistics/movements/:id/escalate logistics -> CEO
PATCH  /api/logistics/movements/:id/approve  CEO approves (requireRole super_admin)
PATCH  /api/logistics/movements/:id/status   dispatched/in_transit/delivered
POST   /api/logistics/movements/:id/receive  destination acknowledges receipt
GET/POST /api/logistics/locations            manage saved locations
```
**New role:** add `logistics` to the role enum + a `requireLogistics` middleware
(mirror `requireHR`). Logistics + super_admin see the full queue.

**UI:** new page `/logistics` — a queue/kanban by status for the logistics team; a simple
"Raise a movement" form for everyone (item rows with qty/weight/dims, from/to dropdowns
from `movementLocations`, priority, date). Totals auto-sum from item rows.

---

## Module 2 — Zoho Books Sync (finance push)

**Behaviour:** Approved Hub financial events create the corresponding record in Zoho Books.
Finance owns the Zoho org and OAuth credentials; until they enable it, jobs **queue**
safely. Idempotent (no double-creates), retried up to 5×, then parked as `failed` for
finance to review.

**Mappings:**
| Hub event (on approval) | Zoho Books record |
|---|---|
| Reimbursement approved | Expense |
| Purchase request approved | Purchase Order |
| Vendor payment approved | Bill / Vendor Payment |
| Travel bill approved | Expense |

**Tables:** `zohoConfig`, `zohoSyncJobs`, `reimbursements` (reimbursement becomes a
first-class Hub object — replaces Zoho Expense for *raising*).

**Code:** `server/zoho.ts` (token refresh, push worker, `enqueueZohoPush`). Drain every
2 min via the existing `node-cron` scheduler.

**Finance setup (one-time):** generate a Zoho refresh token, paste org id + client
id/secret + default expense account into a finance-only admin screen → flip
`zohoConfig.enabled = true`. Map each Hub vendor to its `zoho_contact_id` once.

**Security:** encrypt `refreshToken` / `clientSecret` at rest; finance-role read/write only;
never log secrets.

---

## Module 3 — Google SSO (replace password login)

**Code:** `server/google-auth.ts`. Google is the **only** login. Company-domain emails
only (`ALLOWED_EMAIL_DOMAINS`). No self-signup — HR provisions the user (email on record);
unknown emails are rejected. Add `getUserByEmail` to storage; store email on `users` at
provisioning for a single-table lookup.

**Remove:** password login form, forgot/reset-password flow, invite-set-password flow
(invite can still create the account, but activation = first Google sign-in).

**Env:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`,
`ALLOWED_EMAIL_DOMAINS`.

---

## Module 4 — Travel + Company Car

**Travel:** cabs are out (Uber). Hub handles **flight requests, hotel requests, and
multi-day trip requests** → HR fulfils. The existing `travelRequests` table + workspace
flow already covers most of this; extend the form to capture trip days/flight/hotel
specifics and route to HR.

**Company car:** `companyVehicles` + `vehicleBookings`. One car now, extensible.
New page `/vehicles` with a **shared calendar** view of bookings (reuse the existing
calendar components from attendance/leave). Optional HR approval gate via
`approvedById` — default to self-serve confirm with conflict detection on time overlap.

---

## Build sequence (recommended)

1. **Schema** — merge `schema-additions.ts` into `shared/schema.ts`; `npm run db:push`.
2. **Google SSO** — wire `google-auth.ts`, provision the team's emails, cut over login.
   *(Do this first so the team logs in the new way from day one.)*
3. **Logistics module** — storage methods + routes + `/logistics` page. This is the
   highest-value new surface; ship it and start using it immediately.
4. **Reimbursements + Zoho scaffold** — ship reimbursements as a Hub object now; keep
   Zoho `enabled = false` until finance plugs in credentials. The queue fills safely.
5. **Company car calendar** — quick win, ship alongside.
6. **GreytHR cutover** — once SSO + core HR are live, switch the team off GreytHR.
7. **Flip Zoho on** — finance configures credentials; queued jobs drain into Books.

## Deferred (explicitly out for now)
- Gmail / WhatsApp integration (human messaging stays as-is)
- Factory / Ops dashboard links
- ThingCharge integration
- DC generation (stays with logistics team)
- Email-as-action / one-click approve (revisit after core is live)

## New npm dependency
- `google-auth-library` (SSO). Everything else uses existing deps + native `fetch`.

## New environment variables
```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://<hub-domain>/api/auth/google/callback
ALLOWED_EMAIL_DOMAINS=emoenergy.in
# Zoho creds live in zohoConfig (DB, finance-managed) — not env.
```
