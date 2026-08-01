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

export function registerApprovalNotesRoutes(app: Express) {
  app.get("/api/approval-notes", requireAuth, async (req, res) => {
    const status = req.query.status as string | undefined;
    res.json(await storage.listCeoApprovalNotes(status));
  });
  app.get("/api/approval-notes/:id", requireAuth, async (req, res) => {
    const note = await storage.getCeoApprovalNote(req.params.id);
    if (!note) return res.status(404).json({ error: "Not found" });
    res.json(note);
  });
  app.post("/api/approval-notes", requireAuth, requireTeamHandler, async (req, res) => {
    // Team raises a note to CEO bundling request ids
    const body = { ...req.body, raisedById: req.currentUser!.id, status: "pending" };
    const note = await storage.createCeoApprovalNote(body);
    // Mark linked requests as pending_ceo
    if (Array.isArray(body.linkedRequestIds)) {
      for (const rid of body.linkedRequestIds) {
        await storage.updateRequest(rid, { status: "pending_ceo" });
      }
    }
    res.json(note);
  });
  app.post("/api/approval-notes/:id/approve", requireAuth, requireCEO, async (req, res) => {
    res.json(await storage.decideCeoApprovalNote(req.params.id, req.currentUser!.id, "approved", req.body?.decisionNote));
  });
  app.post("/api/approval-notes/:id/reject", requireAuth, requireCEO, async (req, res) => {
    res.json(await storage.decideCeoApprovalNote(req.params.id, req.currentUser!.id, "rejected", req.body?.decisionNote));
  });

  // =========================================================================
  // REFERENCE DOCS (Policies Â· Yearly Calendar Â· Quality)
  // =========================================================================
}
