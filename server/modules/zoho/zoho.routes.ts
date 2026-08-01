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

export function registerZohoRoutes(app: Express) {
  app.get("/api/zoho/config", requireAuth, async (req, res) => {
    if (!hasRole(req, "super_admin", "finance")) return res.status(403).json({ error: "Forbidden" });
    const cfg = await storage.getZohoConfig();
    if (!cfg) return res.json({ enabled: false });
    // Never return secrets to client
    res.json({
      id: cfg.id, organizationId: cfg.organizationId, region: cfg.region,
      clientId: cfg.clientId ? cfg.clientId.slice(0, 6) + "…" : null,
      hasRefreshToken: !!cfg.refreshToken,
      hasClientSecret: !!cfg.clientSecret,
      enabled: cfg.enabled, defaultExpenseAccountId: cfg.defaultExpenseAccountId,
      updatedAt: cfg.updatedAt,
    });
  });
  app.post("/api/zoho/config", requireAuth, async (req, res) => {
    if (!hasRole(req, "super_admin", "finance")) return res.status(403).json({ error: "Forbidden" });
    const cfg = await storage.upsertZohoConfig(req.body);
    res.json({ ok: true, id: cfg.id });
  });
  app.get("/api/zoho/jobs", requireAuth, async (req, res) => {
    if (!hasRole(req, "super_admin", "finance")) return res.status(403).json({ error: "Forbidden" });
    res.json(await storage.listZohoJobs(200));
  });
}
