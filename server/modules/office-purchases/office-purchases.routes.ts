import type { Express, Request } from "express";
import { randomUUID } from "crypto";
import { storage } from "../../storage";
import { requireAuth, hasRole } from "../../shared/auth";
import { log } from "../../shared/audit";

// Office Purchases — small items HR orders for employees.
// Lifecycle: pending_hr → (HR prices + prioritizes) → pending_approval → (CEO approves) → approved
//            → (HR places order) → ordered → (HR marks delivered) → delivered. Plus rejected / cancelled.
// HR never rejects (they only triage); the CEO can reject. After delivery the employee can flag an
// issue, which opens a support ticket linked back to the order.
export function registerOfficePurchaseRoutes(app: Express) {
  const HR_ROLES = ["hr_admin", "hr_executive"];
  const CEO_ROLES = ["ceo_approver"];
  const isHrTriage = (r: Request) => hasRole(r, "super_admin", ...HR_ROLES);
  const isCeo = (r: Request) => hasRole(r, "super_admin", ...CEO_ROLES);
  const isFinance = (r: Request) => hasRole(r, "super_admin", "finance");
  const isApprover = (r: Request) => hasRole(r, "super_admin", ...HR_ROLES, ...CEO_ROLES, "finance");

  // Total is always derived server-side from HR-entered unit prices × quantities.
  const sumItems = (items: any): string => {
    const total = (Array.isArray(items) ? items : []).reduce((s: number, it: any) => s + (Number(it?.unitPrice) || 0) * (Number(it?.quantity) || 0), 0);
    return (Math.round(total * 100) / 100).toFixed(2);
  };

  // Claimant snapshot for the request.
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
  // Lists never need the uploaded file blobs (only the detail + the finance invoices view do) — strip base64 so list payloads stay small.
  const stripFile = (f: any) => (f && f.fileData ? { fileName: f.fileName, fileType: f.fileType, hasFile: true } : f);
  const liteOp = (o: any) => ({ ...o, invoice: stripFile(o.invoice), proformaInvoice: stripFile(o.proformaInvoice) });
  app.get("/api/office-purchases", requireAuth, async (req, res) => {
    const mineOnly = req.query.mine === "true" || req.query.mine === "1";
    const filters: any = {};
    if (!isApprover(req) || mineOnly) filters.requesterId = req.currentUser!.id;
    if (req.query.status) filters.status = req.query.status as string;
    res.json((await storage.listOfficePurchases(filters)).map(liteOp));
  });

  // Finance-only: full records (WITH file blobs) for the Purchase Invoices hub — the one place the list actually needs the attachments.
  app.get("/api/office-purchases/invoices", requireAuth, async (req, res) => {
    if (!isFinance(req)) return res.status(403).json({ error: "Finance only" });
    const all = await storage.listOfficePurchases({});
    res.json((all as any[]).filter((o: any) => o.paymentStatus || o.invoice?.fileData || o.proformaInvoice?.fileData));
  });

  app.get("/api/office-purchases/:id", requireAuth, async (req, res) => {
    const r = await storage.getOfficePurchase(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    if (!isApprover(req) && r.requesterId !== req.currentUser!.id) return res.status(403).json({ error: "Forbidden" });
    res.json(r);
  });

  // ----- Employee: create -----
  app.post("/api/office-purchases", requireAuth, async (req, res) => {
    const ctx = await requesterContext(req.currentUser!.id, req.currentUser!.username);
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length || items.some((it: any) => !String(it?.description || "").trim())) {
      return res.status(400).json({ error: "Add at least one item with a description." });
    }
    const created = await storage.createOfficePurchase({
      requesterId: req.currentUser!.id, ...ctx, items,
      justification: req.body?.justification || null,
      totalAmount: "0", status: "pending_hr",
    });
    await log(req, "OFFICE_PURCHASE_CREATE", "office_purchase", created.id, null, created);
    try {
      await storage.notifyByRole([...HR_ROLES, "super_admin"], {
        type: "office_purchase_submitted", title: "New Office Purchase Request",
        body: `${created.reference} — ${ctx.employeeName || "An employee"} requested ${items.length} item${items.length > 1 ? "s" : ""}.`,
        link: "/company-workspace",
      });
    } catch { /* best-effort */ }
    res.json(created);
  });

  const notifyApprovers = async (count: number, total: number) => {
    const label = count === 1 ? "an office purchase" : `${count} office purchases`;
    try {
      await storage.notifyByRole([...CEO_ROLES], { type: "office_purchase_pending", title: count > 1 ? "Office Purchases — Bulk Approval" : "Office Purchase — Approval Needed", body: `${label} (₹${total.toLocaleString("en-IN")}) ${count === 1 ? "is" : "are"} ready for your approval.`, link: "/my-approvals" });
      await storage.notifyByRole(["finance"], { type: "office_purchase_pending", title: "Office Purchase submitted for approval", body: `${label} — ₹${total.toLocaleString("en-IN")}.`, link: "/my-approvals" });
    } catch { /* best-effort */ }
  };

  // ----- HR: price + prioritize → priced (staged, not yet sent to the CEO) -----
  app.post("/api/office-purchases/:id/price", requireAuth, async (req, res) => {
    if (!isHrTriage(req)) return res.status(403).json({ error: "HR only" });
    const r = await storage.getOfficePurchase(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    if (!["pending_hr", "priced", "under_review"].includes(r.status)) return res.status(400).json({ error: `Cannot price a request in '${r.status}' state` });
    const items = Array.isArray(req.body?.items) ? req.body.items : r.items;
    const priority = ["low", "medium", "high"].includes(req.body?.priority) ? req.body.priority : (r.priority || "medium");
    const purchaseType = ["online", "vendor"].includes(req.body?.purchaseType) ? req.body.purchaseType : (r.purchaseType || "online");
    const updated = await storage.updateOfficePurchase(req.params.id, {
      items, priority, isDirect: !!req.body?.isDirect, totalAmount: sumItems(items),
      purchaseType, vendorName: purchaseType === "vendor" ? (req.body?.vendorName || null) : null,
      proformaInvoice: purchaseType === "vendor" ? (req.body?.proformaInvoice ?? r.proformaInvoice ?? null) : null,
      reviewedById: req.currentUser!.id, reviewNote: req.body?.reviewNote || null, reviewedAt: new Date(),
      // Editing a queried item keeps it Under Review until HR explicitly resends; a fresh price → priced.
      status: r.status === "under_review" ? "under_review" : "priced",
    });
    await log(req, "OFFICE_PURCHASE_PRICE", "office_purchase", r.id, r, updated);
    res.json(updated);
  });

  // ----- HR: send ONE priced request for approval -----
  app.post("/api/office-purchases/:id/send", requireAuth, async (req, res) => {
    if (!isHrTriage(req)) return res.status(403).json({ error: "HR only" });
    const r = await storage.getOfficePurchase(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    if (r.status !== "priced") return res.status(400).json({ error: `Only a priced request can be sent (is '${r.status}')` });
    const updated = await storage.updateOfficePurchase(req.params.id, { status: "pending_approval", batchId: null });
    await log(req, "OFFICE_PURCHASE_SEND", "office_purchase", r.id, r, updated);
    await notifyApprovers(1, Number(updated.totalAmount || 0));
    res.json(updated);
  });

  // ----- HR: send several priced requests as ONE batch (single CEO card) -----
  app.post("/api/office-purchases/batch-send", requireAuth, async (req, res) => {
    if (!isHrTriage(req)) return res.status(403).json({ error: "HR only" });
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (!ids.length) return res.status(400).json({ error: "Select at least one request." });
    const batchId = randomUUID();
    const results: any[] = [];
    let total = 0;
    for (const id of ids) {
      const r = await storage.getOfficePurchase(id);
      if (!r || r.status !== "priced") continue;
      const updated = await storage.updateOfficePurchase(id, { status: "pending_approval", batchId });
      total += Number(updated.totalAmount || 0);
      results.push(updated);
      await log(req, "OFFICE_PURCHASE_SEND", "office_purchase", id, r, updated);
    }
    await notifyApprovers(results.length, total);
    res.json({ batchId, sent: results.length, total: total.toFixed(2), items: results });
  });

  // ----- HR: resend a queried (Under Review) request back to the CEO, with a "resubmitted" marker -----
  app.post("/api/office-purchases/:id/resend", requireAuth, async (req, res) => {
    if (!isHrTriage(req)) return res.status(403).json({ error: "HR only" });
    const r = await storage.getOfficePurchase(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    if (r.status !== "under_review") return res.status(400).json({ error: `Only a queried request can be resent (is '${r.status}')` });
    const updated = await storage.updateOfficePurchase(req.params.id, { status: "pending_approval", comments: [...((r.comments as any[]) || []), mkComment(req, await actorName(req), "Updated and resent for approval.", "resubmitted")] });
    await log(req, "OFFICE_PURCHASE_RESEND", "office_purchase", r.id, r, updated);
    try { await storage.notifyByRole([...CEO_ROLES, "super_admin"], { type: "office_purchase_pending", title: "Office Purchase — Resubmitted", body: `${r.reference} (${r.employeeName || "Employee"}) was updated and resent for your approval.`, link: "/my-approvals" }); } catch { /* best-effort */ }
    res.json(updated);
  });

  // ----- CEO: approve (single) -----
  const approveOne = async (req: Request, id: string, note: string | null) => {
    const r = await storage.getOfficePurchase(id);
    if (!r) return { error: 404 as const };
    if (!["pending_approval", "under_review"].includes(r.status)) return { error: 400 as const, msg: `Cannot approve a request in '${r.status}' state` };
    const isVendor = r.purchaseType === "vendor";
    const updated = await storage.updateOfficePurchase(id, { status: "approved", approvedById: req.currentUser!.id, decisionNote: note, decidedAt: new Date(), ...(isVendor ? { paymentStatus: "pending" } : {}) });
    // #5: on approval HR is notified to place the order (NOT the requester). Vendor purchases also flag Finance to pay.
    try {
      await storage.notifyByRole([...HR_ROLES, "super_admin"], { type: "office_purchase_approved", title: "Approved — place the order", body: `${r.reference} (${r.employeeName || "Employee"}) was approved.${isVendor ? " Vendor purchase — Finance will pay via the proforma." : ""}`, link: "/company-workspace" });
      if (isVendor) await storage.notifyByRole(["finance", "super_admin"], { type: "office_purchase_payment", title: "Vendor payment needed", body: `${r.reference} — pay ${r.vendorName || "the vendor"} ₹${Number(r.totalAmount || 0).toLocaleString("en-IN")} (proforma attached).`, link: "/reimbursements" });
    } catch { /* best-effort */ }
    return { updated };
  };

  app.post("/api/office-purchases/:id/approve", requireAuth, async (req, res) => {
    if (!isCeo(req)) return res.status(403).json({ error: "CEO approval required" });
    const out = await approveOne(req, req.params.id, req.body?.note || null);
    if (out.error === 404) return res.status(404).json({ error: "Not found" });
    if (out.error === 400) return res.status(400).json({ error: out.msg });
    await log(req, "OFFICE_PURCHASE_APPROVE", "office_purchase", req.params.id, null, out.updated);
    res.json(out.updated);
  });

  // ----- CEO: bulk approve -----
  app.post("/api/office-purchases/bulk-approve", requireAuth, async (req, res) => {
    if (!isCeo(req)) return res.status(403).json({ error: "CEO approval required" });
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const results: any[] = [];
    for (const id of ids) {
      const out = await approveOne(req, id, req.body?.note || null);
      if (out.updated) { results.push(out.updated); await log(req, "OFFICE_PURCHASE_APPROVE", "office_purchase", id, null, out.updated); }
    }
    res.json({ approved: results.length, items: results });
  });

  // ----- CEO: bulk reject (reject a whole batch) -----
  app.post("/api/office-purchases/bulk-reject", requireAuth, async (req, res) => {
    if (!isCeo(req)) return res.status(403).json({ error: "CEO approval required" });
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const note = req.body?.note || null;
    const results: any[] = [];
    for (const id of ids) {
      const r = await storage.getOfficePurchase(id);
      if (!r || !["pending_approval", "under_review"].includes(r.status)) continue;
      const updated = await storage.updateOfficePurchase(id, { status: "rejected", approvedById: req.currentUser!.id, decisionNote: note, decidedAt: new Date() });
      await log(req, "OFFICE_PURCHASE_REJECT", "office_purchase", id, r, updated);
      await notifyRequester(r.requesterId, { type: "office_purchase_rejected", title: "Office Purchase Declined", body: `${r.reference} was not approved.${note ? ` Note: ${note}` : ""}`, link: "/my-requests" });
      results.push(updated);
    }
    res.json({ rejected: results.length, items: results });
  });

  // ----- CEO: reject -----
  app.post("/api/office-purchases/:id/reject", requireAuth, async (req, res) => {
    if (!isCeo(req)) return res.status(403).json({ error: "CEO approval required" });
    const r = await storage.getOfficePurchase(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    if (!["pending_approval", "under_review"].includes(r.status)) return res.status(400).json({ error: `Cannot reject a request in '${r.status}' state` });
    const updated = await storage.updateOfficePurchase(req.params.id, { status: "rejected", approvedById: req.currentUser!.id, decisionNote: req.body?.note || null, decidedAt: new Date() });
    await log(req, "OFFICE_PURCHASE_REJECT", "office_purchase", r.id, r, updated);
    await notifyRequester(r.requesterId, { type: "office_purchase_rejected", title: "Office Purchase Declined", body: `${r.reference} was not approved.${req.body?.note ? ` Note: ${req.body.note}` : ""}`, link: "/my-requests" });
    res.json(updated);
  });

  // ----- HR: place order → ordered -----
  app.post("/api/office-purchases/:id/place-order", requireAuth, async (req, res) => {
    if (!isHrTriage(req)) return res.status(403).json({ error: "HR only" });
    const r = await storage.getOfficePurchase(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    if (r.status !== "approved") return res.status(400).json({ error: `Cannot place an order in '${r.status}' state` });
    const updated = await storage.updateOfficePurchase(req.params.id, { status: "ordered", orderPlacedById: req.currentUser!.id, orderInfo: req.body?.orderInfo || null, expectedDeliveryDate: req.body?.expectedDeliveryDate || null, invoice: req.body?.invoice ?? r.invoice ?? null, orderPlacedAt: new Date() });
    await log(req, "OFFICE_PURCHASE_ORDER", "office_purchase", r.id, r, updated);
    await notifyRequester(r.requesterId, { type: "office_purchase_ordered", title: "Order Placed", body: `${r.reference} has been ordered${req.body?.orderInfo ? ` — ${req.body.orderInfo}` : ""}.`, link: "/my-requests" });
    try { await storage.notifyByRole(["finance", "super_admin"], { type: "office_purchase_invoice", title: "Invoice available", body: `${r.reference} (${r.employeeName || "Employee"}) — invoice uploaded for records.`, link: "/reimbursements" }); } catch { /* best-effort */ }
    res.json(updated);
  });

  // ----- Finance: record a vendor payment (uses the proforma) -----
  app.post("/api/office-purchases/:id/pay", requireAuth, async (req, res) => {
    if (!isFinance(req)) return res.status(403).json({ error: "Finance only" });
    const r = await storage.getOfficePurchase(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    if (r.paymentStatus !== "pending") return res.status(400).json({ error: "No payment is pending for this purchase." });
    const updated = await storage.updateOfficePurchase(req.params.id, { paymentStatus: "paid", paidById: req.currentUser!.id, paidAt: new Date(), paymentRef: req.body?.paymentRef || null });
    await log(req, "OFFICE_PURCHASE_PAY", "office_purchase", r.id, r, updated);
    try { await storage.notifyByRole([...HR_ROLES, "super_admin"], { type: "office_purchase_paid", title: "Vendor paid", body: `${r.reference} — Finance recorded the payment${req.body?.paymentRef ? ` (ref ${req.body.paymentRef})` : ""}.`, link: "/company-workspace" }); } catch { /* best-effort */ }
    res.json(updated);
  });

  // ----- HR: mark delivered → delivered -----
  app.post("/api/office-purchases/:id/deliver", requireAuth, async (req, res) => {
    if (!isHrTriage(req)) return res.status(403).json({ error: "HR only" });
    const r = await storage.getOfficePurchase(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    if (r.status !== "ordered") return res.status(400).json({ error: `Cannot mark delivered from '${r.status}' state` });
    const updated = await storage.updateOfficePurchase(req.params.id, { status: "delivered", deliveredById: req.currentUser!.id, deliveredAt: new Date() });
    await log(req, "OFFICE_PURCHASE_DELIVER", "office_purchase", r.id, r, updated);
    await notifyRequester(r.requesterId, { type: "office_purchase_delivered", title: "Delivered", body: `${r.reference} has been delivered. If anything's wrong, you can flag an issue.`, link: "/my-requests" });
    res.json(updated);
  });

  // ----- Employee: cancel (before approval) -----
  app.post("/api/office-purchases/:id/cancel", requireAuth, async (req, res) => {
    const r = await storage.getOfficePurchase(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    if (r.requesterId !== req.currentUser!.id && req.currentUser!.role !== "super_admin") return res.status(403).json({ error: "Only the requester can cancel." });
    if (!["pending_hr", "pending_approval"].includes(r.status)) return res.status(400).json({ error: "This request can no longer be cancelled." });
    const updated = await storage.updateOfficePurchase(req.params.id, { status: "cancelled" });
    await log(req, "OFFICE_PURCHASE_CANCEL", "office_purchase", r.id, r, updated);
    res.json(updated);
  });

  // ----- Employee: flag a delivery issue → opens a support ticket -----
  app.post("/api/office-purchases/:id/flag", requireAuth, async (req, res) => {
    const r = await storage.getOfficePurchase(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    if (r.requesterId !== req.currentUser!.id) return res.status(403).json({ error: "Only the requester can flag this order." });
    if (r.status !== "delivered") return res.status(400).json({ error: "You can only flag a delivered order." });
    const issue = String(req.body?.issue || "").trim();
    if (!issue) return res.status(400).json({ error: "Describe the issue." });
    const ticket = await storage.createAdminTicket({
      requesterId: req.currentUser!.id, category: "office_purchase_issue",
      subject: `Issue with order ${r.reference}`, description: issue, priority: "high", status: "open",
    });
    const updated = await storage.updateOfficePurchase(req.params.id, { linkedTicketId: ticket.id });
    await log(req, "OFFICE_PURCHASE_FLAG", "office_purchase", r.id, r, updated);
    try {
      await storage.notifyByRole([...HR_ROLES, "super_admin"], { type: "office_purchase_issue", title: "Order Issue Flagged", body: `${r.employeeName || "An employee"} flagged an issue with ${r.reference}.`, link: "/workspace/hr-ops" });
    } catch { /* best-effort */ }
    res.json({ order: updated, ticket });
  });

  // ----- CEO ⇄ HR discussion thread -----
  const actorName = async (req: Request) => (await requesterContext(req.currentUser!.id, req.currentUser!.username)).employeeName || req.currentUser!.username;
  const mkComment = (req: Request, name: string, body: string, kind?: string) => ({ id: randomUUID(), authorId: req.currentUser!.id, authorName: name, authorRole: req.currentUser!.role, body, at: new Date().toISOString(), ...(kind ? { kind } : {}) });
  // Fan a thread update to everyone involved except the author: requester → /my-requests, approver-side → /my-approvals.
  const notifyThread = async (r: any, actorId: string, payload: any) => {
    if (r.requesterId && r.requesterId !== actorId) await storage.notifyUser(r.requesterId, { ...payload, link: "/my-requests" });
    const seen = new Set<string>([r.requesterId, actorId]);
    for (const id of [r.approvedById, r.reviewedById, ...((r.comments || []) as any[]).map((c) => c.authorId)]) {
      if (id && !seen.has(id)) { seen.add(id); await storage.notifyUser(id, { ...payload, link: "/my-approvals" }); }
    }
  };

  // Anyone with access (owner or approver) can post to the thread.
  app.post("/api/office-purchases/:id/comment", requireAuth, async (req, res) => {
    const r = await storage.getOfficePurchase(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    if (!isApprover(req) && r.requesterId !== req.currentUser!.id) return res.status(403).json({ error: "Forbidden" });
    const body = String(req.body?.body || "").trim();
    if (!body) return res.status(400).json({ error: "Write a message." });
    const comment = mkComment(req, await actorName(req), body);
    const updated = await storage.updateOfficePurchase(req.params.id, { comments: [...((r.comments as any[]) || []), comment] });
    await notifyThread(r, req.currentUser!.id, { type: "office_purchase_comment", title: `New comment · ${r.reference}`, body: `${comment.authorName}: ${body.slice(0, 90)}` });
    res.json(updated);
  });

  // CEO raises a query → item goes Under Review and HR is notified. Single or bulk.
  const queryOne = async (req: Request, id: string, body: string, name: string) => {
    const r = await storage.getOfficePurchase(id);
    if (!r || !["pending_approval", "under_review"].includes(r.status)) return null;
    const updated = await storage.updateOfficePurchase(id, { status: "under_review", comments: [...((r.comments as any[]) || []), mkComment(req, name, body, "query")] });
    await log(req, "OFFICE_PURCHASE_QUERY", "office_purchase", id, r, updated);
    return updated;
  };
  app.post("/api/office-purchases/:id/query", requireAuth, async (req, res) => {
    if (!isCeo(req)) return res.status(403).json({ error: "CEO only" });
    const body = String(req.body?.body || "").trim();
    if (!body) return res.status(400).json({ error: "Add a message for HR." });
    const updated = await queryOne(req, req.params.id, body, await actorName(req));
    if (!updated) return res.status(400).json({ error: "This request can no longer be queried." });
    try { await storage.notifyByRole([...HR_ROLES, "super_admin"], { type: "office_purchase_query", title: `Query · ${updated.reference}`, body: `CEO asked: ${body.slice(0, 90)}`, link: "/company-workspace" }); } catch { /* best-effort */ }
    res.json(updated);
  });
  app.post("/api/office-purchases/bulk-query", requireAuth, async (req, res) => {
    if (!isCeo(req)) return res.status(403).json({ error: "CEO only" });
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const body = String(req.body?.body || "").trim();
    if (!body) return res.status(400).json({ error: "Add a message for HR." });
    const name = await actorName(req);
    const results: any[] = [];
    for (const id of ids) { const u = await queryOne(req, id, body, name); if (u) results.push(u); }
    try { await storage.notifyByRole([...HR_ROLES, "super_admin"], { type: "office_purchase_query", title: "CEO raised a query", body: `${results.length} request${results.length !== 1 ? "s" : ""}: ${body.slice(0, 90)}`, link: "/company-workspace" }); } catch { /* best-effort */ }
    res.json({ queried: results.length, items: results });
  });
}
