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

export function registerReimbursementRoutes(app: Express) {
  // Finance does individual review; only the CEO gives final approval (super_admin excluded).
  const FINANCE_ROLES = ["finance"];
  const CEO_FINAL_ROLES = ["ceo_approver"];

  // The claim total is always derived from the line items server-side — never trust a
  // client-sent total (the form auto-sums for UX, but the API can be called directly).
  // Rounded to 2dp to match the numeric(12,2) column and avoid float drift.
  const sumLines = (lines: any): string => {
    const total = (Array.isArray(lines) ? lines : []).reduce((s: number, l: any) => s + (Number(l?.amount) || 0), 0);
    return (Math.round(total * 100) / 100).toFixed(2);
  };
  // super_admin can act at either approval stage as an emergency override (normally it won't).
  const canFinanceStage = (r: Request) => hasRole(r, "super_admin", ...FINANCE_ROLES);
  const canCeoStage = (r: Request) => hasRole(r, "super_admin", ...CEO_FINAL_ROLES);

  // List payloads are huge — every claim carries a base64 invoice image on every line. `?summary=true`
  // strips that heavy data (keeping a `hasFile` flag); callers that need the images fetch the full record
  // via GET /:id. Used by the CEO Inbox + sidebar badge so they don't drag megabytes on every load.
  const isDataUrl = (s: any) => typeof s === "string" && s.startsWith("data:");
  const liteReimb = (r: any) => ({
    ...r,
    invoiceUrl: isDataUrl(r.invoiceUrl) ? null : r.invoiceUrl,
    lines: Array.isArray(r.lines)
      ? r.lines.map((l: any) => { const { fileData, ...rest } = l || {}; return { ...rest, hasFile: !!fileData }; })
      : r.lines,
  });

  app.get("/api/reimbursements", requireAuth, async (req, res) => {
    // Finance + CEO + admin can see all claims; everyone else sees only their own.
    // `?mine=true` forces own-only regardless of role (used by the My Requests page).
    const isApprover = hasRole(req, "super_admin", "finance", "ceo_approver");
    const mineOnly = req.query.mine === "true" || req.query.mine === "1";
    const summary = req.query.summary === "true" || req.query.summary === "1";
    const filters: any = {};
    if (!isApprover || mineOnly) filters.requesterId = req.currentUser!.id;
    if (req.query.status) filters.status = req.query.status;
    const rows = await storage.listReimbursements(filters);
    res.json(summary ? rows.map(liteReimb) : rows);
  });

  app.get("/api/reimbursements/:id", requireAuth, async (req, res) => {
    const r = await storage.getReimbursement(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    const isApprover = hasRole(req, "super_admin", "finance", "ceo_approver");
    if (!isApprover && r.requesterId !== req.currentUser!.id) return res.status(403).json({ error: "Forbidden" });
    res.json(r);
  });
  // Claimant context (name / id / department / HOD) for the reimbursement form
  async function reimbursementContext(userId: string, username: string) {
    const u = await storage.getUser(userId);
    const emp = u?.employeeId ? await storage.getEmployee(u.employeeId) : null;
    if (!emp) return { employeeName: username, employeeCode: null, department: null, hodName: null };
    const depts = await storage.getDepartments();
    const dept = depts.find((d: any) => d.id === emp.departmentId);
    const hod = emp.managerId ? await storage.getEmployee(emp.managerId) : null;
    return {
      employeeName: `${emp.firstName} ${emp.lastName}`,
      employeeCode: emp.employeeCode,
      department: dept?.name || null,
      hodName: hod ? `${hod.firstName} ${hod.lastName}` : null,
    };
  }

  app.get("/api/reimbursements/context", requireAuth, async (req, res) => {
    res.json(await reimbursementContext(req.currentUser!.id, req.currentUser!.username));
  });

  app.post("/api/reimbursements", requireAuth, async (req, res) => {
    // Server stamps the claimant snapshot so it's authoritative for approvers.
    const ctx = await reimbursementContext(req.currentUser!.id, req.currentUser!.username);
    // Total is recomputed from the lines here so it can't be forged via a direct API call.
    const lines = Array.isArray(req.body?.lines) ? req.body.lines : [];
    // Strip approver/decision fields — a claimant must not pre-fill their own approval trail.
    const { approvedById, financeApprovedById, financeNote, decisionNote, zohoExpenseId, financeDecisionAt, approvedAt, id, createdAt, updatedAt, ...body } = req.body || {};
    const created = await storage.createReimbursement({ ...body, ...ctx, lines, totalAmount: sumLines(lines), requesterId: req.currentUser!.id, status: "submitted" });
    try {
      const amt = Number(created.totalAmount || 0).toLocaleString("en-IN");
      await storage.notifyByRole(["finance", "super_admin"], {
        type: "reimbursement_submitted", title: "New Reimbursement to Review",
        body: `${created.reference} (${ctx.employeeName || "Employee"}, ₹${amt}) submitted for finance review.`,
        link: "/my-approvals",
      });
    } catch {}
    res.json(created);
  });
  // Stage-aware approval. submitted -> Finance; finance_approved -> CEO (final).
  app.post("/api/reimbursements/:id/approve", requireAuth, async (req, res) => {
    const r = await storage.getReimbursement(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    if (r.requesterId === req.currentUser!.id && req.currentUser!.role !== "super_admin") {
      return res.status(403).json({ error: "You cannot approve your own reimbursement." });
    }
    const note = req.body?.note || null;

    if (r.status === "submitted") {
      if (!canFinanceStage(req)) return res.status(403).json({ error: "Finance approval required" });
      const updated = await storage.updateReimbursement(req.params.id, {
        status: "finance_approved", financeApprovedById: req.currentUser!.id, financeNote: note, financeDecisionAt: new Date(),
      });
      try {
        const ceos = (await storage.getAllUsers()).filter((u: any) => u.role === "ceo_approver");
        for (const c of ceos) await storage.createNotification({ userId: c.id, type: "approval_pending", title: "Reimbursement for Final Approval", body: `${r.reference} (${r.employeeName || "Employee"}) was approved by Finance — awaiting your approval.`, link: "/my-approvals" });
      } catch {}
      return res.json(updated);
    }

    if (r.status === "finance_approved") {
      if (!canCeoStage(req)) return res.status(403).json({ error: "CEO approval required" });
      const updated = await storage.updateReimbursement(req.params.id, {
        status: "approved", approvedById: req.currentUser!.id, decisionNote: note,
      });
      await enqueueZohoPush("reimbursement", req.params.id, "expense");
      try {
        const requester = await storage.getUser(r.requesterId);
        if (requester) await storage.createNotification({ userId: requester.id, type: "request_approved", title: "Reimbursement Approved", body: `${r.reference} has been fully approved.`, link: "/my-requests/reimbursements" });
      } catch {}
      return res.json(updated);
    }

    return res.status(400).json({ error: `Cannot approve a reimbursement in '${r.status}' state` });
  });

  app.post("/api/reimbursements/:id/reject", requireAuth, async (req, res) => {
    const r = await storage.getReimbursement(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    const note = req.body?.note || null;

    const notifyRejected = async (stage: string) => {
      try {
        await storage.notifyUser(r.requesterId, {
          type: "reimbursement_rejected", title: "Reimbursement Rejected",
          body: `${r.reference} was rejected by ${stage}.${note ? ` Note: ${note}` : ""}`,
          link: "/my-requests/reimbursements",
        });
      } catch {}
    };

    if (r.status === "submitted") {
      if (!canFinanceStage(req)) return res.status(403).json({ error: "Finance access required" });
      const u = await storage.updateReimbursement(req.params.id, { status: "rejected", financeApprovedById: req.currentUser!.id, financeNote: note, financeDecisionAt: new Date(), decisionNote: note });
      await notifyRejected("Finance");
      return res.json(u);
    }
    if (r.status === "finance_approved") {
      if (!canCeoStage(req)) return res.status(403).json({ error: "CEO access required" });
      const u = await storage.updateReimbursement(req.params.id, { status: "rejected", approvedById: req.currentUser!.id, decisionNote: note });
      await notifyRejected("CEO");
      return res.json(u);
    }
    return res.status(400).json({ error: `Cannot reject a reimbursement in '${r.status}' state` });
  });

  // Revoke — the requester cancels their own claim while it is still in flight.
  app.post("/api/reimbursements/:id/revoke", requireAuth, async (req, res) => {
    const r = await storage.getReimbursement(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    if (r.requesterId !== req.currentUser!.id) return res.status(403).json({ error: "You can only revoke your own reimbursement." });
    if (["approved", "rejected", "cancelled"].includes(r.status)) return res.status(400).json({ error: "This reimbursement can no longer be revoked." });
    res.json(await storage.updateReimbursement(req.params.id, { status: "cancelled" }));
  });

  // Request changes — sends the claim back to the requester for edits (any reviewer in the active stage).
  // The reviewer can scope exactly which fields / line items are editable; that selection is stored
  // in `notes` as JSON so the requester's form can lock everything else.
  app.post("/api/reimbursements/:id/request-changes", requireAuth, async (req, res) => {
    const r = await storage.getReimbursement(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    const note = req.body?.note || null;
    const fields: string[] = Array.isArray(req.body?.fields) ? req.body.fields : [];
    const lines: number[] = Array.isArray(req.body?.lines) ? req.body.lines : [];
    if (r.status === "submitted") {
      if (!canFinanceStage(req)) return res.status(403).json({ error: "Finance access required" });
    } else if (r.status === "finance_approved") {
      if (!canCeoStage(req)) return res.status(403).json({ error: "CEO access required" });
    } else {
      return res.status(400).json({ error: `Cannot request changes on a reimbursement in '${r.status}' state` });
    }
    // Snapshot the current values so we can show a before/after diff once the requester resubmits.
    const original = {
      businessPurpose: r.businessPurpose,
      periodFrom: r.periodFrom,
      periodTo: r.periodTo,
      cashAdvance: r.cashAdvance,
      lines: Array.isArray(r.lines) ? r.lines : [],
    };
    const u = await storage.updateReimbursement(req.params.id, {
      status: "changes_requested",
      decisionNote: note,
      notes: JSON.stringify({ kind: "change_request", fields, lines, original }),
    });
    try {
      await storage.notifyUser(r.requesterId, {
        type: "reimbursement_changes", title: "Changes Requested on Reimbursement",
        body: `${r.reference} needs changes before approval.${note ? ` Note: ${note}` : ""}`,
        link: "/my-requests/reimbursements",
      });
    } catch {}
    res.json(u);
  });

  // Resubmit — requester applies the requested edits and sends the claim back into the queue.
  app.post("/api/reimbursements/:id/resubmit", requireAuth, async (req, res) => {
    const r = await storage.getReimbursement(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    if (r.requesterId !== req.currentUser!.id) return res.status(403).json({ error: "You can only resubmit your own reimbursement." });
    if (r.status !== "changes_requested") return res.status(400).json({ error: "Only claims with requested changes can be resubmitted." });
    const b = req.body || {};
    const lines = Array.isArray(b.lines) ? b.lines : r.lines;
    const total = sumLines(lines); // always derived server-side — ignore any client-sent total
    // Carry the original snapshot + scope forward so the approver sees what changed.
    let prev: any = {};
    try { prev = JSON.parse(r.notes || "{}"); } catch {}
    const diffNotes = prev.original ? JSON.stringify({ kind: "resubmitted_diff", at: new Date().toISOString(), lines: prev.lines || [], original: prev.original }) : null;
    const updated = await storage.updateReimbursement(req.params.id, {
      businessPurpose: b.businessPurpose ?? r.businessPurpose,
      periodFrom: b.periodFrom ?? r.periodFrom,
      periodTo: b.periodTo ?? r.periodTo,
      cashAdvance: b.cashAdvance != null ? String(b.cashAdvance) : r.cashAdvance,
      category: b.category ?? r.category,
      lines,
      totalAmount: total,
      status: "submitted",
      notes: diffNotes,
      decisionNote: null,
    });
    try {
      await storage.notifyByRole(["finance", "super_admin"], {
        type: "reimbursement_submitted", title: "Reimbursement Resubmitted",
        body: `${r.reference} (${r.employeeName || "Employee"}) was updated and resubmitted for finance review.`,
        link: "/my-approvals",
      });
    } catch {}
    res.json(updated);
  });

  // =========================================================================
  // UNIFIED REQUESTS
  // =========================================================================
}
