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

export function registerRequestRoutes(app: Express) {
  // A service request (and its comments) is visible only to its requester or a handling team.
  const canHandle = (req: Request) => hasRole(req, "super_admin", "hr_admin", "hr_executive", "hr_ops", "office_admin", "logistics", "finance", "ceo_approver");
  app.get("/api/requests", requireAuth, async (req, res) => {
    const isHandler = hasRole(req, "super_admin", "hr_admin", "hr_executive", "hr_ops", "office_admin", "logistics", "finance", "ceo_approver");
    const filters: any = {};
    if (!isHandler) filters.requesterId = req.currentUser!.id;
    if (req.query.team) filters.routeToTeam = req.query.team;
    if (req.query.status) filters.status = req.query.status;
    res.json(await storage.listRequests(filters));
  });
  app.get("/api/requests/:id", requireAuth, async (req, res) => {
    const r = await storage.getRequest(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    if (r.requesterId !== req.currentUser!.id && !canHandle(req)) return res.status(403).json({ error: "Forbidden" });
    res.json(r);
  });
  app.post("/api/requests", requireAuth, async (req, res) => {
    // Auto-route based on type
    const routing: Record<string, string> = {
      purchase_online: "HR", supplies: "ADMIN", it_request: "ADMIN",
      facilities: "ADMIN", hr_request: "HR", finance_request: "FIN",
    };
    const team = req.body.routeToTeam || routing[req.body.type] || "ADMIN";
    const created = await storage.createRequest({
      ...req.body, requesterId: req.currentUser!.id, routeToTeam: team, status: "submitted",
    });
    try {
      await storage.notifyByRole(["super_admin", "hr_admin", "hr_executive", "hr_ops", "office_admin", "logistics", "finance"], {
        type: "request_submitted", title: "New Service Request",
        body: `${created.title || "Request"} (${(created.type || "").replace(/_/g, " ")}) routed to ${team}.`,
        link: "/requests",
      });
    } catch {}
    res.json(created);
  });
  app.patch("/api/requests/:id", requireAuth, requireTeamHandler, async (req, res) => {
    // Status/ownership transitions belong to the assign/fulfill/reject endpoints, not the generic update.
    const { status, requesterId, id, createdAt, updatedAt, ...safe } = req.body;
    res.json(await storage.updateRequest(req.params.id, safe));
  });
  app.post("/api/requests/:id/assign", requireAuth, requireTeamHandler, async (req, res) => {
    const r = await storage.updateRequest(req.params.id, { assignedToId: req.currentUser!.id, status: "in_review" });
    try { await storage.notifyUser(r.requesterId, { type: "request_in_review", title: "Request In Review", body: `Your request "${r.title || "request"}" is being reviewed.`, link: "/my-requests" }); } catch {}
    res.json(r);
  });
  app.post("/api/requests/:id/fulfill", requireAuth, requireTeamHandler, async (req, res) => {
    const r = await storage.updateRequest(req.params.id, { status: "fulfilled", resolutionNote: req.body?.resolutionNote });
    try { await storage.notifyUser(r.requesterId, { type: "request_approved", title: "Request Fulfilled", body: `Your request "${r.title || "request"}" has been fulfilled.${req.body?.resolutionNote ? ` ${req.body.resolutionNote}` : ""}`, link: "/my-requests" }); } catch {}
    res.json(r);
  });
  app.post("/api/requests/:id/reject", requireAuth, requireTeamHandler, async (req, res) => {
    const r = await storage.updateRequest(req.params.id, { status: "rejected", resolutionNote: req.body?.resolutionNote });
    try { await storage.notifyUser(r.requesterId, { type: "request_rejected", title: "Request Rejected", body: `Your request "${r.title || "request"}" was rejected.${req.body?.resolutionNote ? ` ${req.body.resolutionNote}` : ""}`, link: "/my-requests" }); } catch {}
    res.json(r);
  });

  app.get("/api/requests/:id/comments", requireAuth, async (req, res) => {
    const r = await storage.getRequest(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    if (r.requesterId !== req.currentUser!.id && !canHandle(req)) return res.status(403).json({ error: "Forbidden" });
    res.json(await storage.listRequestComments(req.params.id));
  });
  app.post("/api/requests/:id/comments", requireAuth, async (req, res) => {
    const r = await storage.getRequest(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    if (r.requesterId !== req.currentUser!.id && !canHandle(req)) return res.status(403).json({ error: "Forbidden" });
    res.json(await storage.addRequestComment({
      requestId: req.params.id, authorId: req.currentUser!.id, body: req.body.body,
    }));
  });

  // =========================================================================
  // CEO APPROVAL NOTES
  // =========================================================================
}
