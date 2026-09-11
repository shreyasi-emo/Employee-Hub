import type { Express, Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { db, pool } from "../../db";
import { storage } from "../../storage";
import {
  requireAuth, requireHR, requireAdmin, requireRole,
  requireWorkspace, requireCEO, requireLogistics, requireTeamHandler, hasRole,
} from "../../shared/auth";
import { log } from "../../shared/audit";
import { enqueueZohoPush } from "../../zoho";
import { getTrackingProvider, DEFAULT_TRACKING_PROVIDER } from "./tracking-provider";
import { z } from "zod";

// Document types a logistics request can carry. `ewayBill` / `deliveryChallan` are finance-only (hidden from the requester).
const LOGI_DOC_TYPES = ["packList", "pdir", "invoice", "logisticsReport", "dc", "debitNote", "ewayBill", "deliveryChallan", "customerDoc", "other"] as const;

// Whitelist + validate the client-settable fields of a logistics request (server owns status/requester/reference/proof).
const createLogisticsRequestSchema = z.object({
  requestType: z.enum(["inboard", "outboard"]),
  cargoType: z.enum(["pack", "material"]).default("material"),
  customerName: z.string().trim().min(1).nullish(),
  fromLocationId: z.string().trim().min(1).nullish(),
  fromLocationText: z.string().trim().min(1).nullish(),
  toLocationId: z.string().trim().min(1).nullish(),
  toLocationText: z.string().trim().min(1).nullish(),
  pickupDate: z.string().nullish(),
  deliveryDate: z.string().nullish(),
  pocName: z.string().nullish(),
  pocPhone: z.string().nullish(),
  quantity: z.coerce.number().int().positive(),
  weightKg: z.union([z.string(), z.number()]).nullish(),
  goodsCategory: z.string().nullish(),
  description: z.string().nullish(),
  priority: z.enum(["regular", "urgent"]).default("regular"),
}).refine((d) => !!(d.fromLocationId || d.fromLocationText), { message: "A pickup location is required" })
  .refine((d) => !!(d.toLocationId || d.toLocationText), { message: "A drop location is required" });

export function registerLogisticsRoutes(app: Express) {
  // =========================================================================
  // LOGISTICS — LOCATIONS
  // =========================================================================
  app.get("/api/logistics/locations", requireAuth, async (_req, res) => {
    res.json(await storage.listMovementLocations());
  });
  // Common pickup/drop locations are curated by HR, Super Admin (and the Logistics team) — company config, not a manager's team scope.
  app.post("/api/logistics/locations", requireAuth, requireRole("super_admin", "hr_admin", "hr_executive", "logistics"), async (req, res) => {
    res.json(await storage.createMovementLocation(req.body));
  });
  app.patch("/api/logistics/locations/:id", requireAuth, requireRole("super_admin", "hr_admin", "hr_executive", "logistics"), async (req, res) => {
    res.json(await storage.updateMovementLocation(req.params.id, req.body));
  });

  // =========================================================================
  // LOGISTICS — MOVEMENTS
  // =========================================================================
  app.get("/api/logistics/movements", requireAuth, async (req, res) => {
    // Logistics + super_admin + CEO approver see all; others see only their own
    const isHandler = hasRole(req, "super_admin", "logistics", "hr_admin", "ceo_approver");
    const filters: any = {};
    if (!isHandler) filters.requesterId = req.currentUser!.id;
    if (req.query.status) filters.status = req.query.status;
    res.json(await storage.listLogisticsMovements(filters));
  });

  app.get("/api/logistics/movements/:id", requireAuth, async (req, res) => {
    const m = await storage.getLogisticsMovement(req.params.id);
    if (!m) return res.status(404).json({ error: "Not found" });
    if (m.requesterId !== req.currentUser!.id && !hasRole(req, "super_admin", "logistics", "hr_admin", "ceo_approver")) return res.status(403).json({ error: "Forbidden" });
    res.json(m);
  });

  app.post("/api/logistics/movements", requireAuth, async (req, res) => {
    // Strip server-controlled fields — status transitions + handler stamps go through their own endpoints.
    const { status, requesterId, receivedById, receivedAt, assignedToId, escalatedToId, reference, id, createdAt, updatedAt, ...safe } = req.body || {};
    const body = { ...safe, requesterId: req.currentUser!.id, status: "submitted" };
    const m = await storage.createLogisticsMovement(body);
    await storage.addMovementEvent({
      movementId: m.id, actorId: req.currentUser!.id,
      fromStatus: null, toStatus: "submitted", note: "Raised",
    });
    res.json(m);
  });

  app.patch("/api/logistics/movements/:id", requireAuth, async (req, res) => {
    const m = await storage.getLogisticsMovement(req.params.id);
    if (!m) return res.status(404).json({ error: "Not found" });
    // Only requester (in submitted state) or logistics can edit
    if (m.requesterId !== req.currentUser!.id && !hasRole(req, "super_admin", "logistics")) {
      return res.status(403).json({ error: "Forbidden" });
    }
    // Status changes go through the transition endpoints, not the generic PATCH.
    const { status, requesterId, receivedById, receivedAt, assignedToId, id, createdAt, updatedAt, ...safe } = req.body;
    res.json(await storage.updateLogisticsMovement(req.params.id, safe));
  });

  // Transition helpers
  async function transition(req: Request, res: Response, toStatus: string, allowedFrom: string[], note?: string) {
    const m = await storage.getLogisticsMovement(req.params.id);
    if (!m) return res.status(404).json({ error: "Not found" });
    if (!allowedFrom.includes(m.status)) {
      return res.status(400).json({ error: `Cannot move from ${m.status} to ${toStatus}` });
    }
    const updates: any = { status: toStatus };
    if (toStatus === "accepted") updates.assignedToId = req.currentUser!.id;
    if (toStatus === "delivered") { updates.receivedById = req.currentUser!.id; updates.receivedAt = new Date(); }
    const updated = await storage.updateLogisticsMovement(req.params.id, updates);
    await storage.addMovementEvent({
      movementId: m.id, actorId: req.currentUser!.id,
      fromStatus: m.status, toStatus, note: req.body?.note || note,
    });
    try {
      const ref = (m as any).reference || "Movement";
      if (toStatus === "needs_approval") {
        await storage.notifyByRole(["super_admin", "ceo_approver"], { type: "approval_pending", title: "Logistics Movement Needs Approval", body: `${ref} escalated for CEO approval.`, link: "/logistics" });
      } else if (toStatus === "approved") {
        await storage.notifyUser(m.requesterId, { type: "approval_approved", title: "Movement Approved", body: `${ref} was approved.`, link: "/logistics" });
      } else if (toStatus === "rejected") {
        await storage.notifyUser(m.requesterId, { type: "approval_rejected", title: "Movement Rejected", body: `${ref} was rejected.`, link: "/logistics" });
      } else if (toStatus === "delivered") {
        await storage.notifyUser(m.requesterId, { type: "request_approved", title: "Movement Delivered", body: `${ref} has been delivered.`, link: "/logistics" });
      }
    } catch {}
    res.json(updated);
  }

  app.post("/api/logistics/movements/:id/accept", requireAuth, requireLogistics, (req, res) =>
    transition(req, res, "accepted", ["submitted", "approved"], "Accepted by logistics"));
  app.post("/api/logistics/movements/:id/escalate", requireAuth, requireLogistics, (req, res) =>
    transition(req, res, "needs_approval", ["submitted"], "Escalated to CEO"));
  app.post("/api/logistics/movements/:id/approve", requireAuth, requireCEO, (req, res) =>
    transition(req, res, "approved", ["needs_approval"], "Approved by CEO"));
  app.post("/api/logistics/movements/:id/reject", requireAuth, async (req, res) => {
    if (!hasRole(req, "super_admin", "ceo_approver", "logistics")) return res.status(403).json({ error: "Forbidden" });
    return transition(req, res, "rejected", ["submitted", "needs_approval", "accepted"], "Rejected");
  });
  app.post("/api/logistics/movements/:id/dispatch", requireAuth, requireLogistics, (req, res) =>
    transition(req, res, "dispatched", ["accepted"], "Dispatched"));
  app.post("/api/logistics/movements/:id/in-transit", requireAuth, requireLogistics, (req, res) =>
    transition(req, res, "in_transit", ["dispatched"], "In transit"));
  app.post("/api/logistics/movements/:id/deliver", requireAuth, async (req, res) => {
    const m = await storage.getLogisticsMovement(req.params.id);
    if (!m) return res.status(404).json({ error: "Not found" });
    // Only the requester/recipient or logistics may confirm receipt (it stamps receivedById).
    if (m.requesterId !== req.currentUser!.id && !hasRole(req, "super_admin", "logistics")) return res.status(403).json({ error: "Forbidden" });
    return transition(req, res, "delivered", ["dispatched", "in_transit"], "Delivered / received");
  });
  app.post("/api/logistics/movements/:id/cancel", requireAuth, async (req, res) => {
    const m = await storage.getLogisticsMovement(req.params.id);
    if (!m) return res.status(404).json({ error: "Not found" });
    if (m.requesterId !== req.currentUser!.id && !hasRole(req, "super_admin", "logistics")) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return transition(req, res, "cancelled", ["submitted", "needs_approval", "accepted"], "Cancelled");
  });

  app.get("/api/logistics/movements/:id/events", requireAuth, async (req, res) => {
    const m = await storage.getLogisticsMovement(req.params.id);
    if (!m) return res.status(404).json({ error: "Not found" });
    if (m.requesterId !== req.currentUser!.id && !hasRole(req, "super_admin", "logistics", "hr_admin", "ceo_approver")) return res.status(403).json({ error: "Forbidden" });
    res.json(await storage.listMovementEvents(req.params.id));
  });

  // =========================================================================
  // LOGISTICS REQUESTS (employee Inboard / Outboard)
  // =========================================================================
  const canManageLogistics = (req: Request) => hasRole(req, "super_admin", "logistics");
  // Finance monitors read-only (from arrangement onward) and verifies customer docs — sees all, can't process.
  const canViewAllLogistics = (req: Request) => hasRole(req, "super_admin", "logistics", "finance");
  // The plain requester never sees finance-only documents (e-Way bill, delivery challan).
  const redactLogistics = (r: any, req: Request) => {
    if (!r || canViewAllLogistics(req)) return r;
    const documents = Array.isArray(r.documents) ? r.documents.filter((d: any) => !d?.financeOnly) : r.documents;
    return { ...r, documents };
  };

  app.get("/api/logistics/requests", requireAuth, async (req, res) => {
    // Employees see only their own; logistics + super_admin process; finance monitors read-only.
    const filters: any = {};
    if (!canViewAllLogistics(req)) filters.requesterId = req.currentUser!.id;
    if (req.query.status) filters.status = req.query.status as string;
    const list = await storage.listLogisticsRequests(filters);
    res.json((list as any[]).map((r) => redactLogistics(r, req)));
  });

  app.get("/api/logistics/requests/:id", requireAuth, async (req, res) => {
    const r = await storage.getLogisticsRequest(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    if (r.requesterId !== req.currentUser!.id && !canViewAllLogistics(req)) return res.status(403).json({ error: "Forbidden" });
    res.json(redactLogistics(r, req));
  });

  app.post("/api/logistics/requests", requireAuth, async (req, res) => {
    // Any employee can raise. Whitelist-validate input; status/handler/proof/reference are server-controlled.
    const parsed = createLogisticsRequestSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid request" });
    const created = await storage.createLogisticsRequest({ ...parsed.data, requesterId: req.currentUser!.id, status: "pending" });
    try {
      await storage.notifyByRole(["super_admin", "logistics"], {
        type: "logistics_request", title: "New Logistics Request",
        body: `${created.reference} — ${created.requestType === "inboard" ? "Inboard" : "Outboard"} movement raised by ${req.currentUser!.username}.`,
        link: "/logistics",
      });
    } catch {}
    res.json(created);
  });

  app.post("/api/logistics/requests/:id/cancel", requireAuth, async (req, res) => {
    const r = await storage.getLogisticsRequest(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    const isOwner = r.requesterId === req.currentUser!.id;
    // Requester may cancel only while Pending; logistics/super_admin may cancel any open request.
    if (!canManageLogistics(req) && !(isOwner && r.status === "pending")) return res.status(403).json({ error: "Forbidden" });
    if (r.status === "completed" || r.status === "cancelled") return res.status(400).json({ error: "Request is already closed." });
    const updated = await storage.updateLogisticsRequest(req.params.id, { status: "cancelled", cancelledById: req.currentUser!.id, decisionNote: req.body?.note || null });
    try { await storage.notifyUser(r.requesterId, { type: "logistics_cancelled", title: "Logistics Request Cancelled", body: `${r.reference} was cancelled.`, link: "/logistics" }); } catch {}
    res.json(updated);
  });

  app.post("/api/logistics/requests/:id/start", requireAuth, requireRole("super_admin", "logistics"), async (req, res) => {
    const r = await storage.getLogisticsRequest(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    if (r.status !== "pending") return res.status(400).json({ error: `Cannot start from ${r.status}` });
    res.json(await storage.updateLogisticsRequest(req.params.id, { status: "in_progress", processedById: req.currentUser!.id }));
  });

  app.post("/api/logistics/requests/:id/complete", requireAuth, requireRole("super_admin", "logistics"), async (req, res) => {
    const r = await storage.getLogisticsRequest(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    // POD is the ONLY completion gate — allowed from any active processing stage.
    if (!["in_progress", "in_transit", "delivered"].includes(r.status)) return res.status(400).json({ error: `Cannot complete a request that is ${r.status}. Start processing it first.` });
    const proof = req.body?.proof;
    if (!proof || !proof.fileData) return res.status(400).json({ error: "Proof of delivery / document is required to complete." });
    const updated = await storage.updateLogisticsRequest(req.params.id, { status: "completed", completedById: req.currentUser!.id, completedAt: new Date(), proof });
    try { await storage.notifyUser(r.requesterId, { type: "logistics_completed", title: "Logistics Request Completed", body: `${r.reference} has been completed.`, link: "/logistics" }); } catch {}
    res.json(updated);
  });

  // ---- Processing data-entry: vehicle/partner arranged, tracking no., customer, verification flag ----
  const patchLogisticsSchema = z.object({
    carrier: z.string().trim().max(200).nullish(),
    vehicleNo: z.string().trim().max(60).nullish(),
    trackingId: z.string().trim().max(120).nullish(),
    docketNo: z.string().trim().max(120).nullish(),
    customerName: z.string().trim().max(200).nullish(),
    cargoType: z.enum(["pack", "material"]).optional(),
    qtyVerified: z.boolean().optional(),
    discrepancyNote: z.string().trim().max(2000).nullish(),
  });
  app.patch("/api/logistics/requests/:id", requireAuth, requireRole("super_admin", "logistics"), async (req, res) => {
    const r = await storage.getLogisticsRequest(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    if (["completed", "cancelled"].includes(r.status)) return res.status(400).json({ error: "This request is closed." });
    const parsed = patchLogisticsSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid update" });
    const updated = await storage.updateLogisticsRequest(req.params.id, parsed.data as any);
    // "Vehicle arranged" — first time a carrier is set, notify Finance (they monitor from here).
    if (parsed.data.carrier && !r.carrier) {
      try { await storage.notifyByRole(["finance", "super_admin"], { type: "logistics_arranged", title: "Vehicle arranged", body: `${r.reference} — ${parsed.data.carrier} arranged for ${r.customerName || (r.requestType === "inboard" ? "inbound pickup" : "dispatch")}.`, link: "/logistics" }); } catch {}
    }
    res.json(updated);
  });

  // ---- Documents: append a typed document (logistics). `financeOnly` hides it from the requester. ----
  const uploadDocSchema = z.object({
    type: z.enum(LOGI_DOC_TYPES),
    financeOnly: z.boolean().optional(),
    file: z.object({ fileName: z.string(), fileType: z.string().nullish(), fileData: z.string().min(1) }),
  });
  app.post("/api/logistics/requests/:id/documents", requireAuth, requireRole("super_admin", "logistics"), async (req, res) => {
    const r = await storage.getLogisticsRequest(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    if (["completed", "cancelled"].includes(r.status)) return res.status(400).json({ error: "This request is closed." });
    const parsed = uploadDocSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid document" });
    // e-Way bill & delivery challan are always finance-only regardless of the flag sent.
    const financeOnly = parsed.data.financeOnly || ["ewayBill", "deliveryChallan"].includes(parsed.data.type);
    const doc = { type: parsed.data.type, ...parsed.data.file, financeOnly, uploadedById: req.currentUser!.id, uploadedAt: new Date().toISOString() };
    const documents = [...(Array.isArray(r.documents) ? r.documents : []), doc];
    res.json(await storage.updateLogisticsRequest(req.params.id, { documents } as any));
  });
  app.delete("/api/logistics/requests/:id/documents/:index", requireAuth, requireRole("super_admin", "logistics"), async (req, res) => {
    const r = await storage.getLogisticsRequest(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    const docs = Array.isArray(r.documents) ? [...r.documents] : [];
    const i = parseInt(String(req.params.index), 10);
    if (isNaN(i) || i < 0 || i >= docs.length) return res.status(400).json({ error: "No such document" });
    docs.splice(i, 1);
    res.json(await storage.updateLogisticsRequest(req.params.id, { documents: docs } as any));
  });

  // ---- Transition: dispatch (→ in_transit). Requires an arranged carrier; seeds mock tracking. ----
  app.post("/api/logistics/requests/:id/dispatch", requireAuth, requireRole("super_admin", "logistics"), async (req, res) => {
    const r = await storage.getLogisticsRequest(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    if (r.status !== "in_progress") return res.status(400).json({ error: `Cannot dispatch from ${r.status}.` });
    if (!r.carrier) return res.status(400).json({ error: "Arrange a vehicle / logistics partner first." });
    const dispatchedAt = new Date();
    const provider = getTrackingProvider(r.trackingProvider || DEFAULT_TRACKING_PROVIDER);
    let trackingEvents: any[] = [];
    try { trackingEvents = await provider.fetchEvents({ trackingId: r.trackingId, carrier: r.carrier, dispatchedAt, from: r.fromLocationText, to: r.toLocationText }); } catch {}
    const updated = await storage.updateLogisticsRequest(req.params.id, { status: "in_transit", dispatchedAt, trackingProvider: r.trackingProvider || DEFAULT_TRACKING_PROVIDER, trackingEvents } as any);
    try {
      await storage.notifyUser(r.requesterId, { type: "logistics_in_transit", title: "Shipment dispatched", body: `${r.reference} is in transit${r.trackingId ? ` (tracking ${r.trackingId})` : ""}.`, link: "/logistics" });
      await storage.notifyByRole(["finance", "super_admin"], { type: "logistics_in_transit", title: "Shipment dispatched", body: `${r.reference} dispatched via ${r.carrier}.`, link: "/logistics" });
    } catch {}
    res.json(updated);
  });

  // ---- Transition: mark delivered (→ delivered). POD still needed to close. ----
  app.post("/api/logistics/requests/:id/deliver", requireAuth, requireRole("super_admin", "logistics"), async (req, res) => {
    const r = await storage.getLogisticsRequest(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    if (!["in_transit", "in_progress"].includes(r.status)) return res.status(400).json({ error: `Cannot mark delivered from ${r.status}.` });
    const updated = await storage.updateLogisticsRequest(req.params.id, { status: "delivered", deliveredAt: new Date() } as any);
    try { await storage.notifyUser(r.requesterId, { type: "logistics_delivered", title: "Shipment delivered", body: `${r.reference} was delivered — awaiting POD to close.`, link: "/logistics" }); } catch {}
    res.json(updated);
  });

  // ---- Inward: logistics records the plant's "packs OK" confirmation; Finance is notified. ----
  app.post("/api/logistics/requests/:id/plant-verify", requireAuth, requireRole("super_admin", "logistics"), async (req, res) => {
    const r = await storage.getLogisticsRequest(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    if (r.requestType !== "inboard") return res.status(400).json({ error: "Plant verification applies to inbound pickups only." });
    const updated = await storage.updateLogisticsRequest(req.params.id, { plantVerifiedAt: new Date(), plantVerifiedById: req.currentUser!.id } as any);
    try { await storage.notifyByRole(["finance", "super_admin"], { type: "logistics_plant_ok", title: "Plant verified packs", body: `${r.reference} — plant confirmed packs received & OK.`, link: "/logistics" }); } catch {}
    res.json(updated);
  });

  // ---- Finance verifies the customer document (co-sign for inbound battery packs). ----
  app.post("/api/logistics/requests/:id/finance-verify", requireAuth, requireRole("super_admin", "finance"), async (req, res) => {
    const r = await storage.getLogisticsRequest(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    const updated = await storage.updateLogisticsRequest(req.params.id, { financeVerifiedAt: new Date(), financeVerifiedById: req.currentUser!.id } as any);
    try { await storage.notifyByRole(["super_admin", "logistics"], { type: "logistics_finance_ok", title: "Finance verified document", body: `${r.reference} — Finance verified the customer document.`, link: "/logistics" }); } catch {}
    res.json(updated);
  });

  // ---- Pull fresh tracking events from the (mock) provider. ----
  app.post("/api/logistics/requests/:id/refresh-tracking", requireAuth, requireRole("super_admin", "logistics"), async (req, res) => {
    const r = await storage.getLogisticsRequest(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    if (!["in_transit", "delivered"].includes(r.status)) return res.status(400).json({ error: "Tracking is only available once dispatched." });
    const provider = getTrackingProvider(r.trackingProvider || DEFAULT_TRACKING_PROVIDER);
    const trackingEvents = await provider.fetchEvents({ trackingId: r.trackingId, carrier: r.carrier, dispatchedAt: r.dispatchedAt, from: r.fromLocationText, to: r.toLocationText });
    res.json(await storage.updateLogisticsRequest(req.params.id, { trackingEvents } as any));
  });

  // =========================================================================
  // COMPANY VEHICLES
  // =========================================================================
}

// Scheduler hook: refresh tracking for all in-transit logistics requests via their provider (mock now).
// Wired into the 6-hourly cron in server/scheduler.ts.
export async function refreshLogisticsTracking() {
  const { storage } = await import("../../storage");
  const inTransit = await storage.listLogisticsRequests({ status: "in_transit" });
  for (const r of inTransit as any[]) {
    try {
      const provider = getTrackingProvider(r.trackingProvider || DEFAULT_TRACKING_PROVIDER);
      const trackingEvents = await provider.fetchEvents({ trackingId: r.trackingId, carrier: r.carrier, dispatchedAt: r.dispatchedAt, from: r.fromLocationText, to: r.toLocationText });
      await storage.updateLogisticsRequest(r.id, { trackingEvents } as any);
    } catch { /* best-effort per request */ }
  }
}
