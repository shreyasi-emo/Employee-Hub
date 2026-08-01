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

export function registerReferenceDocRoutes(app: Express) {
  app.get("/api/reference-docs", requireAuth, async (req, res) => {
    res.json(await storage.listReferenceDocs(req.query.section as string | undefined));
  });
  app.post("/api/reference-docs", requireAuth, async (req, res) => {
    if (!hasRole(req, "super_admin", "hr_admin", "hr_executive", "office_admin")) return res.status(403).json({ error: "Forbidden" });
    res.json(await storage.createReferenceDoc({ ...req.body, uploadedBy: req.currentUser!.id }));
  });
  app.patch("/api/reference-docs/:id", requireAuth, async (req, res) => {
    if (!hasRole(req, "super_admin", "hr_admin", "hr_executive", "office_admin")) return res.status(403).json({ error: "Forbidden" });
    res.json(await storage.updateReferenceDoc(req.params.id, req.body));
  });
  app.delete("/api/reference-docs/:id", requireAuth, async (req, res) => {
    if (!hasRole(req, "super_admin", "hr_admin")) return res.status(403).json({ error: "Forbidden" });
    await storage.deleteReferenceDoc(req.params.id);
    res.json({ ok: true });
  });

  // =========================================================================
  // ZOHO CONFIG (finance only) + sync jobs visibility
  // =========================================================================
}
