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

export function registerLogisticsRoutes(app: Express) {
  // =========================================================================
  // LOGISTICS — LOCATIONS
  // =========================================================================
  app.get("/api/logistics/locations", requireAuth, async (_req, res) => {
    res.json(await storage.listMovementLocations());
  });
  app.post("/api/logistics/locations", requireAuth, requireLogistics, async (req, res) => {
    res.json(await storage.createMovementLocation(req.body));
  });
  app.patch("/api/logistics/locations/:id", requireAuth, requireLogistics, async (req, res) => {
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
    res.json(m);
  });

  app.post("/api/logistics/movements", requireAuth, async (req, res) => {
    const body = { ...req.body, requesterId: req.currentUser!.id, status: "submitted" };
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
    res.json(await storage.updateLogisticsMovement(req.params.id, req.body));
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
  app.post("/api/logistics/movements/:id/deliver", requireAuth, (req, res) =>
    transition(req, res, "delivered", ["dispatched", "in_transit"], "Delivered / received"));
  app.post("/api/logistics/movements/:id/cancel", requireAuth, async (req, res) => {
    const m = await storage.getLogisticsMovement(req.params.id);
    if (!m) return res.status(404).json({ error: "Not found" });
    if (m.requesterId !== req.currentUser!.id && !hasRole(req, "super_admin", "logistics")) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return transition(req, res, "cancelled", ["submitted", "needs_approval", "accepted"], "Cancelled");
  });

  app.get("/api/logistics/movements/:id/events", requireAuth, async (req, res) => {
    res.json(await storage.listMovementEvents(req.params.id));
  });

  // =========================================================================
  // COMPANY VEHICLES
  // =========================================================================
}
