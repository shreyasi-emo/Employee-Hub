import type { Express, Request } from "express";
import { randomUUID } from "crypto";
import { storage } from "../../storage";
import { requireAuth, hasRole } from "../../shared/auth";
import { log } from "../../shared/audit";

// Procurement — employee-priced purchases (Amazon for now) that go STRAIGHT to the CEO.
// No HR triage: the employee enters the link + cost, the CEO approves (single or bulk).
// Lifecycle: pending_approval → approved / rejected (CEO) · cancelled (owner, pre-decision).
export function registerProcurementRoutes(app: Express) {
  const CEO_ROLES = ["ceo_approver"];
  const isCeo = (r: Request) => hasRole(r, "super_admin", ...CEO_ROLES);
  const isApprover = (r: Request) => hasRole(r, "super_admin", ...CEO_ROLES, "finance");

  const sumItems = (items: any): string => {
    const total = (Array.isArray(items) ? items : []).reduce((s: number, it: any) => s + (Number(it?.unitPrice) || 0) * (Number(it?.quantity) || 0), 0);
    return (Math.round(total * 100) / 100).toFixed(2);
  };

  async function requesterContext(userId: string, username: string) {
    const u = await storage.getUser(userId);
    const emp = u?.employeeId ? await storage.getEmployee(u.employeeId) : null;
    if (!emp) return { employeeName: username, employeeCode: null, department: null };
    const dept = (await storage.getDepartments()).find((d: any) => d.id === emp.departmentId);
    return { employeeName: `${emp.firstName} ${emp.lastName}`.trim(), employeeCode: emp.employeeCode, department: dept?.name || null };
  }
  const notifyRequester = async (requesterId: string, payload: any) => {
    try { const u = await storage.getUser(requesterId); if (u) await storage.createNotification({ userId: u.id, ...payload }); } catch { /* best-effort */ }
  };

  // ----- List / get -----
  app.get("/api/procurement", requireAuth, async (req, res) => {
    const mineOnly = req.query.mine === "true" || req.query.mine === "1";
    const filters: any = {};
    if (!isApprover(req) || mineOnly) filters.requesterId = req.currentUser!.id;
    if (req.query.status) filters.status = req.query.status as string;
    res.json(await storage.listProcurementRequests(filters));
  });

  app.get("/api/procurement/:id", requireAuth, async (req, res) => {
    const r = await storage.getProcurementRequest(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    if (!isApprover(req) && r.requesterId !== req.currentUser!.id) return res.status(403).json({ error: "Forbidden" });
    res.json(r);
  });

  // ----- Employee: create → straight to CEO -----
  app.post("/api/procurement", requireAuth, async (req, res) => {
    const ctx = await requesterContext(req.currentUser!.id, req.currentUser!.username);
    const items = (Array.isArray(req.body?.items) ? req.body.items : [])
      .map((it: any) => ({ description: String(it?.description || "").trim(), quantity: Number(it?.quantity) || 1, link: String(it?.link || "").trim(), unitPrice: Number(it?.unitPrice) || 0 }))
      .filter((it: any) => it.description);
    if (!items.length) return res.status(400).json({ error: "Add at least one item with a description." });
    const created = await storage.createProcurementRequest({
      requesterId: req.currentUser!.id, ...ctx,
      category: req.body?.category || "amazon",
      items, totalAmount: sumItems(items),
      justification: req.body?.justification || null,
      status: "pending_approval",
    });
    await log(req, "PROCUREMENT_CREATE", "procurement", created.id, null, created);
    try {
      await storage.notifyByRole([...CEO_ROLES, "super_admin"], {
        type: "procurement_submitted", title: "Procurement — Approval Needed",
        body: `${created.reference} (${ctx.employeeName || "An employee"}, ₹${Number(created.totalAmount || 0).toLocaleString("en-IN")}) needs your approval.`,
        link: "/my-approvals",
      });
    } catch { /* best-effort */ }
    res.json(created);
  });

  // ----- CEO: approve (single) -----
  const approveOne = async (req: Request, id: string, note: string | null) => {
    const r = await storage.getProcurementRequest(id);
    if (!r) return { error: 404 as const };
    if (!["pending_approval", "under_review"].includes(r.status)) return { error: 400 as const, msg: `Cannot approve a request in '${r.status}' state` };
    const updated = await storage.updateProcurementRequest(id, { status: "approved", approvedById: req.currentUser!.id, decisionNote: note, decidedAt: new Date() });
    await notifyRequester(r.requesterId, { type: "procurement_approved", title: "Procurement Approved", body: `${r.reference} was approved.`, link: "/my-requests" });
    return { updated };
  };
  const rejectOne = async (req: Request, id: string, note: string | null) => {
    const r = await storage.getProcurementRequest(id);
    if (!r) return { error: 404 as const };
    if (!["pending_approval", "under_review"].includes(r.status)) return { error: 400 as const, msg: `Cannot reject a request in '${r.status}' state` };
    const updated = await storage.updateProcurementRequest(id, { status: "rejected", approvedById: req.currentUser!.id, decisionNote: note, decidedAt: new Date() });
    await notifyRequester(r.requesterId, { type: "procurement_rejected", title: "Procurement Declined", body: `${r.reference} was not approved.${note ? ` Note: ${note}` : ""}`, link: "/my-requests" });
    return { updated };
  };

  app.post("/api/procurement/:id/approve", requireAuth, async (req, res) => {
    if (!isCeo(req)) return res.status(403).json({ error: "CEO approval required" });
    const out = await approveOne(req, req.params.id, req.body?.note || null);
    if (out.error === 404) return res.status(404).json({ error: "Not found" });
    if (out.error === 400) return res.status(400).json({ error: out.msg });
    await log(req, "PROCUREMENT_APPROVE", "procurement", req.params.id, null, out.updated);
    res.json(out.updated);
  });

  app.post("/api/procurement/:id/reject", requireAuth, async (req, res) => {
    if (!isCeo(req)) return res.status(403).json({ error: "CEO approval required" });
    const out = await rejectOne(req, req.params.id, req.body?.note || null);
    if (out.error === 404) return res.status(404).json({ error: "Not found" });
    if (out.error === 400) return res.status(400).json({ error: out.msg });
    await log(req, "PROCUREMENT_REJECT", "procurement", req.params.id, null, out.updated);
    res.json(out.updated);
  });

  // ----- CEO: bulk approve / reject -----
  app.post("/api/procurement/bulk-approve", requireAuth, async (req, res) => {
    if (!isCeo(req)) return res.status(403).json({ error: "CEO approval required" });
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const results: any[] = [];
    for (const id of ids) {
      const out = await approveOne(req, id, req.body?.note || null);
      if (out.updated) { results.push(out.updated); await log(req, "PROCUREMENT_APPROVE", "procurement", id, null, out.updated); }
    }
    res.json({ approved: results.length, items: results });
  });

  app.post("/api/procurement/bulk-reject", requireAuth, async (req, res) => {
    if (!isCeo(req)) return res.status(403).json({ error: "CEO approval required" });
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const results: any[] = [];
    for (const id of ids) {
      const out = await rejectOne(req, id, req.body?.note || null);
      if (out.updated) { results.push(out.updated); await log(req, "PROCUREMENT_REJECT", "procurement", id, null, out.updated); }
    }
    res.json({ rejected: results.length, items: results });
  });

  // ----- Employee: cancel (before decision) -----
  app.post("/api/procurement/:id/cancel", requireAuth, async (req, res) => {
    const r = await storage.getProcurementRequest(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    if (r.requesterId !== req.currentUser!.id && req.currentUser!.role !== "super_admin") return res.status(403).json({ error: "Only the requester can cancel." });
    if (r.status !== "pending_approval") return res.status(400).json({ error: "This request can no longer be cancelled." });
    const updated = await storage.updateProcurementRequest(req.params.id, { status: "cancelled" });
    await log(req, "PROCUREMENT_CANCEL", "procurement", r.id, r, updated);
    res.json(updated);
  });

  // ----- CEO ⇄ requester discussion thread -----
  const actorName = async (req: Request) => (await requesterContext(req.currentUser!.id, req.currentUser!.username)).employeeName || req.currentUser!.username;
  const mkComment = (req: Request, name: string, body: string, kind?: string) => ({ id: randomUUID(), authorId: req.currentUser!.id, authorName: name, authorRole: req.currentUser!.role, body, at: new Date().toISOString(), ...(kind ? { kind } : {}) });
  const notifyThread = async (r: any, actorId: string, payload: any) => {
    if (r.requesterId && r.requesterId !== actorId) await storage.notifyUser(r.requesterId, { ...payload, link: "/my-requests" });
    const seen = new Set<string>([r.requesterId, actorId]);
    for (const id of [r.approvedById, ...((r.comments || []) as any[]).map((c) => c.authorId)]) {
      if (id && !seen.has(id)) { seen.add(id); await storage.notifyUser(id, { ...payload, link: "/my-approvals" }); }
    }
  };

  app.post("/api/procurement/:id/comment", requireAuth, async (req, res) => {
    const r = await storage.getProcurementRequest(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    if (!isApprover(req) && r.requesterId !== req.currentUser!.id) return res.status(403).json({ error: "Forbidden" });
    const body = String(req.body?.body || "").trim();
    if (!body) return res.status(400).json({ error: "Write a message." });
    const comment = mkComment(req, await actorName(req), body);
    const updated = await storage.updateProcurementRequest(req.params.id, { comments: [...((r.comments as any[]) || []), comment] });
    await notifyThread(r, req.currentUser!.id, { type: "procurement_comment", title: `New comment · ${r.reference}`, body: `${comment.authorName}: ${body.slice(0, 90)}` });
    res.json(updated);
  });

  const queryOne = async (req: Request, id: string, body: string, name: string) => {
    const r = await storage.getProcurementRequest(id);
    if (!r || !["pending_approval", "under_review"].includes(r.status)) return null;
    const updated = await storage.updateProcurementRequest(id, { status: "under_review", comments: [...((r.comments as any[]) || []), mkComment(req, name, body, "query")] });
    await log(req, "PROCUREMENT_QUERY", "procurement", id, r, updated);
    await notifyRequester(r.requesterId, { type: "procurement_query", title: `Query · ${r.reference}`, body: `CEO asked: ${body.slice(0, 90)}`, link: "/my-requests" });
    return updated;
  };
  app.post("/api/procurement/:id/query", requireAuth, async (req, res) => {
    if (!isCeo(req)) return res.status(403).json({ error: "CEO only" });
    const body = String(req.body?.body || "").trim();
    if (!body) return res.status(400).json({ error: "Add a message." });
    const updated = await queryOne(req, req.params.id, body, await actorName(req));
    if (!updated) return res.status(400).json({ error: "This request can no longer be queried." });
    res.json(updated);
  });
  app.post("/api/procurement/bulk-query", requireAuth, async (req, res) => {
    if (!isCeo(req)) return res.status(403).json({ error: "CEO only" });
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const body = String(req.body?.body || "").trim();
    if (!body) return res.status(400).json({ error: "Add a message." });
    const name = await actorName(req);
    const results: any[] = [];
    for (const id of ids) { const u = await queryOne(req, id, body, name); if (u) results.push(u); }
    res.json({ queried: results.length, items: results });
  });
}
