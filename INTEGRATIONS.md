# Integrations & Mock Data — Phase 1 Handover

This document lists every place in the app that currently runs on **mock, placeholder, or
manually-entered data** in lieu of a real external integration, and what each needs to be
replaced with before/at go-live.

These are **Phase 1** items — the modules below (Logistics included) are part of the Phase 1
scope, so this list is part of the Phase 1 handover, **not** a separate/later phase. Wiring a
real integration here is a swap-in, not a rebuild: the seams are already in place.

Legend — **Impact**: 🔴 blocks real operation · 🟡 works but not production-grade · ⚪ cosmetic/optional.

---

## Logistics

### 1. Shipment tracking — MOCK provider 🔴
- **Where:** [`server/modules/logistics/tracking-provider.ts`](server/modules/logistics/tracking-provider.ts) — `MockTrackingProvider` + `MOCK_CHECKPOINTS`; `DEFAULT_TRACKING_PROVIDER = "mock"`.
- **Current behaviour:** on Dispatch and on refresh, tracking events are **synthesised deterministically** from `dispatchedAt` (picked-up → hub → in transit → out for delivery, keyed off elapsed hours). No carrier is ever contacted. Nothing is random, so refreshes are stable.
- **Replace with:** a real courier integration (Delhivery / BlueDart / Shiprocket / etc.). Implement the existing `TrackingProvider` interface (`fetchEvents()` returning the full event list) in a new class, register it in the `PROVIDERS` map, and set `DEFAULT_TRACKING_PROVIDER` (or per-request `logisticsRequests.trackingProvider`) to that key. **No route or UI change needed** — the flow only ever calls `getTrackingProvider()`.
- **Consumers to keep working:** dispatch seeding + the "Refresh" button ([`logistics.routes.ts`](server/modules/logistics/logistics.routes.ts) `/dispatch`, `/refresh-tracking`) and the 6-hourly cron below.

### 2. Tracking auto-refresh cron — drives the mock 🟡
- **Where:** [`server/scheduler.ts`](server/scheduler.ts) → `refreshLogisticsTracking()` (exported from [`logistics.routes.ts`](server/modules/logistics/logistics.routes.ts)), runs every 6 hours for all `in_transit` requests.
- **Current behaviour:** re-computes the mock events. Harmless but pointless until a real provider exists.
- **Replace with:** nothing structural — once item 1 is real, this cron polls the live carrier. Revisit the 6h cadence to match the carrier's update frequency / rate limits (or move to carrier webhooks and retire polling).

### 3. Docket / LR / AWB number — free-text, not validated 🟡
- **Where:** `logisticsRequests.docketNo` — entered by hand in the Processing panel ([`logistics-detail-dialog.tsx`](client/src/features/logistics/components/logistics-detail-dialog.tsx), field `logi-docket`); PATCH `/api/logistics/requests/:id`.
- **Current behaviour:** a plain string. It is **not** fetched from, or checked against, any transporter system, and it is not used to key the mock tracking (the mock ignores it).
- **Replace with:** once a real carrier API exists, this should be the carrier's tracking reference — validated / auto-filled on booking, and passed to `TrackingProvider.fetchEvents({ trackingId })`. (Legacy column `trackingId` still exists in the schema and is read as a fallback for display; consolidate on `docketNo`.)

### 4. e-Way bill & GST documents — uploaded files, not generated 🟡
- **Where:** document types `ewayBill` / `deliveryChallan` in `logisticsRequests.documents` (finance-only; server-enforced in [`logistics.routes.ts`](server/modules/logistics/logistics.routes.ts)).
- **Current behaviour:** treated as ordinary **manual uploads**. Nothing is generated or validated against the GST / e-Way bill portal.
- **Replace with:** if statutory automation is wanted, integrate the e-Way bill / GST e-invoice API to generate & validate these instead of relying on a human upload. Otherwise this is acceptable as-is (documents are still captured).

### 5. Document & POD storage — base64 in Postgres 🟡
- **Where:** `logisticsRequests.documents[].fileData` and `logisticsRequests.proof.fileData` — stored as base64 **data URIs** inside the JSONB column (via the shared `FileUpload` component). Same pattern as the rest of the app.
- **Current behaviour:** files live in the database as base64 strings. Works, but bloats rows and has a practical size ceiling (~10 MB/file).
- **Replace with:** an object store (S3 / GCS / Azure Blob) — upload the file, persist only the URL + metadata. This is an **app-wide** change (employee docs, reimbursements, etc.), so coordinate it globally rather than logistics-only.

### 6. Notifications — in-app only 🟡
- **Where:** `storage.notifyByRole(...)` / `storage.notifyUser(...)` calls throughout [`logistics.routes.ts`](server/modules/logistics/logistics.routes.ts) (new request, vehicle arranged, dispatched, delivered, plant/finance verified).
- **Current behaviour:** notifications are **in-app records only**. No email/SMS reaches the requester, and **nothing at all** reaches the external transporter, plant, customer, or sales — those actors are off-platform, so their steps are recorded by the logistics user on their behalf.
- **Replace with:** wire the notification layer to email/SMS if external parties need to be reached automatically; otherwise the manual-relay model is by design.

### 7. Goods-category suggestions — hardcoded list ⚪
- **Where:** `GOODS_OPTIONS` in [`raise-logistics-dialog.tsx`](client/src/features/logistics/components/raise-logistics-dialog.tsx).
- **Current behaviour:** a static suggestion list ("Battery", "Spare parts", …); the field is still free-text.
- **Replace with:** optional — move to a configurable list if the catalogue needs to be managed. Not blocking.

### 8. Not synced to Zoho ⚪
- **Note:** unlike some other modules, logistics requests are **not** pushed to Zoho (the unused import was removed). If Zoho (or any ERP) should receive logistics movements, that integration is **not yet wired** and would be net-new.

### Not mock (for the avoidance of doubt)
- Reference codes (`LR-XXXX`), the request/processing/dispatch/delivery/POD **state machine**, role/finance/plant gating, and the pickup/drop **locations** picklist are all real application logic & user-entered data — nothing to replace there.

---

## Other modules

Add real-integration gaps for other Phase 1 modules here as they are identified (e.g. auth is
currently username/password and is slated to move to Google SSO — see the auth module). Keeping
them in this one file makes the "what still needs wiring" story a single handover artifact.
