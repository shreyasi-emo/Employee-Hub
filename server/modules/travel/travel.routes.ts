import type { Express, Request } from "express";
import { randomUUID } from "crypto";
import { storage } from "../../storage";
import { requireAuth, hasRole } from "../../shared/auth";
import { log } from "../../shared/audit";

// Travel — Flights / Stays / Transport. Employee requests → HR prices + adds details → CEO approves
// (auto-approved if the trip starts within 24h) → HR books + uploads the document. Same CEO card/query
// pattern as office purchases; `attendees` powers per-traveller calendar highlighting.
export function registerTravelRoutes(app: Express) {
  const HR_ROLES = ["hr_admin", "hr_executive"];
  const CEO_ROLES = ["ceo_approver"];
  const isHrTriage = (r: Request) => hasRole(r, "super_admin", ...HR_ROLES);
  const isCeo = (r: Request) => hasRole(r, "super_admin", ...CEO_ROLES);
  const isApprover = (r: Request) => hasRole(r, "super_admin", ...HR_ROLES, ...CEO_ROLES, "finance");
  const CAT_LABEL: Record<string, string> = { flight: "Flight", stay: "Stay", transport: "Transport" };

  const dateOnly = (v: any) => (v ? String(v).slice(0, 10) : null);
  // Normalize each category's dates for the calendar + the <24h auto-approve rule.
  const normDates = (category: string, d: any) => {
    if (category === "flight") return { startDate: dateOnly(d?.departDate), endDate: dateOnly(d?.returnDate) || dateOnly(d?.departDate) };
    if (category === "stay") return { startDate: dateOnly(d?.checkIn), endDate: dateOnly(d?.checkOut) || dateOnly(d?.checkIn) };
    return { startDate: dateOnly(d?.dateTime), endDate: dateOnly(d?.dateTime) };
  };
  // Auto-approve only when the trip is imminent (starts today or tomorrow — too soon for a CEO round-trip).
  // Fixes the old bug where any PAST date also satisfied "<= 24h" and got auto-approved.
  const within24h = (startDate: any) => {
    if (!startDate) return false;
    const start = new Date(`${String(startDate).slice(0, 10)}T00:00:00`);
    if (isNaN(start.getTime())) return false;
    const now = new Date();
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const todayDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const diffDays = Math.round((startDay - todayDay) / 86400000);
    return diffDays === 0 || diffDays === 1;
  };

  async function requesterContext(userId: string, username: string) {
    const u = await storage.getUser(userId);
    const emp = u?.employeeId ? await storage.getEmployee(u.employeeId) : null;
    if (!emp) return { employeeName: username, employeeCode: null, department: null };
    const dept = (await storage.getDepartments()).find((x: any) => x.id === emp.departmentId);
    return { employeeName: `${emp.firstName} ${emp.lastName}`.trim(), employeeCode: emp.employeeCode, department: dept?.name || null };
  }
  const notifyRequester = async (uid: string, payload: any) => { try { const u = await storage.getUser(uid); if (u) await storage.createNotification({ userId: u.id, ...payload }); } catch { /* best-effort */ } };
  const actorName = async (req: Request) => (await requesterContext(req.currentUser!.id, req.currentUser!.username)).employeeName || req.currentUser!.username;
  const mkComment = (req: Request, name: string, body: string, kind?: string) => ({ id: randomUUID(), authorId: req.currentUser!.id, authorName: name, authorRole: req.currentUser!.role, body, at: new Date().toISOString(), ...(kind ? { kind } : {}) });
  const notifyThread = async (r: any, actorId: string, payload: any) => {
    if (r.requesterId && r.requesterId !== actorId) await storage.notifyUser(r.requesterId, { ...payload, link: "/my-requests" });
    const seen = new Set<string>([r.requesterId, actorId]);
    for (const id of [r.approvedById, r.reviewedById, ...((r.comments || []) as any[]).map((c: any) => c.authorId)]) { if (id && !seen.has(id)) { seen.add(id); await storage.notifyUser(id, { ...payload, link: "/my-approvals" }); } }
  };

  // ----- List / get -----
  // Lists never use the ticket/voucher blob (only the detail does) — strip the base64 so list payloads stay small.
  const lite = (t: any) => (t?.document?.fileData ? { ...t, document: { fileName: t.document.fileName, fileType: t.document.fileType, hasFile: true } } : t);
  app.get("/api/travel", requireAuth, async (req, res) => {
    const mineOnly = req.query.mine === "true" || req.query.mine === "1";
    const uid = req.currentUser!.id;
    if (mineOnly || !isApprover(req)) {
      // "Mine" = trips I requested OR am a co-traveller (attendee) on, so co-travellers see booked trips + calendar highlights.
      const all = await storage.listTripRequests(req.query.status ? { status: req.query.status as string } : {});
      return res.json((all as any[]).filter((t) => t.requesterId === uid || ((t.attendees || []) as any[]).some((a) => a?.userId === uid)).map(lite));
    }
    const filters: any = {};
    if (req.query.status) filters.status = req.query.status as string;
    res.json((await storage.listTripRequests(filters)).map(lite));
  });
  app.get("/api/travel/:id", requireAuth, async (req, res) => {
    const r = await storage.getTripRequest(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    const onTrip = ((r.attendees || []) as any[]).some((a) => a?.userId === req.currentUser!.id);
    if (!isApprover(req) && r.requesterId !== req.currentUser!.id && !onTrip) return res.status(403).json({ error: "Forbidden" });
    res.json(r);
  });

  // ----- Employee: create -----
  app.post("/api/travel", requireAuth, async (req, res) => {
    const category = ["flight", "stay", "transport"].includes(req.body?.category) ? req.body.category : null;
    if (!category) return res.status(400).json({ error: "Pick a travel type." });
    const ctx = await requesterContext(req.currentUser!.id, req.currentUser!.username);
    const details = req.body?.details || {};
    const { startDate, endDate } = normDates(category, details);
    const extra = Array.isArray(req.body?.attendees) ? req.body.attendees : [];
    const attendees = [{ userId: req.currentUser!.id, name: ctx.employeeName }, ...extra.filter((a: any) => a?.userId && a.userId !== req.currentUser!.id)];
    const created = await storage.createTripRequest({
      requesterId: req.currentUser!.id, ...ctx, category, purpose: req.body?.purpose || null,
      details, attendees, startDate, endDate, notes: req.body?.notes || null, status: "pending_hr",
    });
    await log(req, "TRAVEL_CREATE", "trip", created.id, null, created);
    try { await storage.notifyByRole([...HR_ROLES, "super_admin"], { type: "travel_submitted", title: `New ${CAT_LABEL[category]} request`, body: `${created.reference} — ${ctx.employeeName || "An employee"}.`, link: "/company-workspace" }); } catch { /* best-effort */ }
    res.json(created);
  });

  // ----- HR: price + add details → CEO, or auto-approve if the trip starts within 24h -----
  app.post("/api/travel/:id/price", requireAuth, async (req, res) => {
    if (!isHrTriage(req)) return res.status(403).json({ error: "HR only" });
    const r = await storage.getTripRequest(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    if (!["pending_hr", "pending_approval", "under_review"].includes(r.status)) return res.status(400).json({ error: `Cannot price a request in '${r.status}' state` });
    const auto = within24h(r.startDate);
    const amount = String(Number(req.body?.amount) || 0);
    const wasQueried = r.status === "under_review";  // HR answering a CEO query → resend for approval
    const resubmitComment = wasQueried ? mkComment(req, await actorName(req), "Updated and resent for approval.", "resubmitted") : null;
    const updated = await storage.updateTripRequest(req.params.id, {
      amount, hrDetails: req.body?.hrDetails || r.hrDetails || {}, reviewedById: req.currentUser!.id, reviewedAt: new Date(),
      status: auto ? "approved" : "pending_approval", autoApproved: auto,
      ...(resubmitComment ? { comments: [...((r.comments as any[]) || []), resubmitComment] } : {}),
      ...(auto ? { approvedById: req.currentUser!.id, decidedAt: new Date(), decisionNote: "Auto-approved — travel within 24h" } : {}),
    });
    await log(req, "TRAVEL_PRICE", "trip", r.id, r, updated);
    try {
      if (auto) await storage.notifyByRole([...HR_ROLES, "super_admin"], { type: "travel_approved", title: "Auto-approved — book it", body: `${r.reference} starts within 24h — approved automatically, please book.`, link: "/company-workspace" });
      else await storage.notifyByRole([...CEO_ROLES, "super_admin"], { type: "travel_pending", title: wasQueried ? "Travel — Resubmitted for approval" : "Travel — Approval Needed", body: `${r.reference} (${r.employeeName || "Employee"}, ₹${(Number(req.body?.amount) || 0).toLocaleString("en-IN")}) ${wasQueried ? "was updated and resent." : "needs your approval."}`, link: "/my-approvals" });
    } catch { /* best-effort */ }
    res.json(updated);
  });

  // ----- CEO: approve / reject / query (single + bulk) -----
  const approveOne = async (req: Request, id: string, note: string | null) => {
    const r = await storage.getTripRequest(id);
    if (!r) return { error: 404 as const };
    if (!["pending_approval", "under_review"].includes(r.status)) return { error: 400 as const, msg: `Cannot approve a request in '${r.status}' state` };
    const updated = await storage.updateTripRequest(id, { status: "approved", approvedById: req.currentUser!.id, decisionNote: note, decidedAt: new Date() });
    try { await storage.notifyByRole([...HR_ROLES, "super_admin"], { type: "travel_approved", title: "Approved — book it", body: `${r.reference} (${r.employeeName || "Employee"}) was approved.`, link: "/company-workspace" }); } catch { /* best-effort */ }
    return { updated };
  };
  const rejectOne = async (req: Request, id: string, note: string | null) => {
    const r = await storage.getTripRequest(id);
    if (!r) return { error: 404 as const };
    if (!["pending_approval", "under_review"].includes(r.status)) return { error: 400 as const, msg: `Cannot reject a request in '${r.status}' state` };
    const updated = await storage.updateTripRequest(id, { status: "rejected", approvedById: req.currentUser!.id, decisionNote: note, decidedAt: new Date() });
    await notifyRequester(r.requesterId, { type: "travel_rejected", title: "Travel Declined", body: `${r.reference} was not approved.${note ? ` Note: ${note}` : ""}`, link: "/my-requests" });
    return { updated };
  };
  app.post("/api/travel/:id/approve", requireAuth, async (req, res) => {
    if (!isCeo(req)) return res.status(403).json({ error: "CEO approval required" });
    const out = await approveOne(req, req.params.id, req.body?.note || null);
    if (out.error === 404) return res.status(404).json({ error: "Not found" });
    if (out.error === 400) return res.status(400).json({ error: out.msg });
    await log(req, "TRAVEL_APPROVE", "trip", req.params.id, null, out.updated);
    res.json(out.updated);
  });
  app.post("/api/travel/:id/reject", requireAuth, async (req, res) => {
    if (!isCeo(req)) return res.status(403).json({ error: "CEO approval required" });
    const out = await rejectOne(req, req.params.id, req.body?.note || null);
    if (out.error === 404) return res.status(404).json({ error: "Not found" });
    if (out.error === 400) return res.status(400).json({ error: out.msg });
    await log(req, "TRAVEL_REJECT", "trip", req.params.id, null, out.updated);
    res.json(out.updated);
  });
  app.post("/api/travel/bulk-approve", requireAuth, async (req, res) => {
    if (!isCeo(req)) return res.status(403).json({ error: "CEO approval required" });
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const results: any[] = [];
    for (const id of ids) { const out = await approveOne(req, id, req.body?.note || null); if (out.updated) { results.push(out.updated); await log(req, "TRAVEL_APPROVE", "trip", id, null, out.updated); } }
    res.json({ approved: results.length, items: results });
  });
  app.post("/api/travel/bulk-reject", requireAuth, async (req, res) => {
    if (!isCeo(req)) return res.status(403).json({ error: "CEO approval required" });
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const results: any[] = [];
    for (const id of ids) { const out = await rejectOne(req, id, req.body?.note || null); if (out.updated) { results.push(out.updated); await log(req, "TRAVEL_REJECT", "trip", id, null, out.updated); } }
    res.json({ rejected: results.length, items: results });
  });
  const queryOne = async (req: Request, id: string, body: string, name: string) => {
    const r = await storage.getTripRequest(id);
    if (!r || !["pending_approval", "under_review"].includes(r.status)) return null;
    const updated = await storage.updateTripRequest(id, { status: "under_review", comments: [...((r.comments as any[]) || []), mkComment(req, name, body, "query")] });
    await log(req, "TRAVEL_QUERY", "trip", id, r, updated);
    return updated;
  };
  app.post("/api/travel/:id/query", requireAuth, async (req, res) => {
    if (!isCeo(req)) return res.status(403).json({ error: "CEO only" });
    const body = String(req.body?.body || "").trim();
    if (!body) return res.status(400).json({ error: "Add a message for HR." });
    const updated = await queryOne(req, req.params.id, body, await actorName(req));
    if (!updated) return res.status(400).json({ error: "This request can no longer be queried." });
    try { await storage.notifyByRole([...HR_ROLES, "super_admin"], { type: "travel_query", title: `Query · ${updated.reference}`, body: `CEO asked: ${body.slice(0, 90)}`, link: "/company-workspace" }); } catch { /* best-effort */ }
    res.json(updated);
  });
  app.post("/api/travel/bulk-query", requireAuth, async (req, res) => {
    if (!isCeo(req)) return res.status(403).json({ error: "CEO only" });
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const body = String(req.body?.body || "").trim();
    if (!body) return res.status(400).json({ error: "Add a message for HR." });
    const name = await actorName(req);
    const results: any[] = [];
    for (const id of ids) { const u = await queryOne(req, id, body, name); if (u) results.push(u); }
    try { await storage.notifyByRole([...HR_ROLES, "super_admin"], { type: "travel_query", title: "CEO raised a query", body: `${results.length} request${results.length !== 1 ? "s" : ""}: ${body.slice(0, 90)}`, link: "/company-workspace" }); } catch { /* best-effort */ }
    res.json({ queried: results.length, items: results });
  });

  // ----- HR: book (final details + document) → booked; notify every traveller -----
  app.post("/api/travel/:id/book", requireAuth, async (req, res) => {
    if (!isHrTriage(req)) return res.status(403).json({ error: "HR only" });
    const r = await storage.getTripRequest(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    if (r.status !== "approved") return res.status(400).json({ error: `Cannot book a request in '${r.status}' state` });
    const updated = await storage.updateTripRequest(req.params.id, {
      status: "booked", hrDetails: req.body?.hrDetails || r.hrDetails || {}, document: req.body?.document ?? r.document ?? null,
      bookedById: req.currentUser!.id, bookedAt: new Date(),
    });
    await log(req, "TRAVEL_BOOK", "trip", r.id, r, updated);
    for (const a of ((updated.attendees || []) as any[])) await notifyRequester(a?.userId, { type: "travel_booked", title: `${CAT_LABEL[r.category] || "Travel"} booked`, body: `${r.reference} is booked — details & document are on your request.`, link: "/my-requests" });
    res.json(updated);
  });

  // ----- Thread comment (requester / travellers / approvers) -----
  app.post("/api/travel/:id/comment", requireAuth, async (req, res) => {
    const r = await storage.getTripRequest(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    const onTrip = ((r.attendees || []) as any[]).some((a) => a?.userId === req.currentUser!.id);
    if (!isApprover(req) && r.requesterId !== req.currentUser!.id && !onTrip) return res.status(403).json({ error: "Forbidden" });
    const body = String(req.body?.body || "").trim();
    if (!body) return res.status(400).json({ error: "Write a message." });
    const comment = mkComment(req, await actorName(req), body);
    const updated = await storage.updateTripRequest(req.params.id, { comments: [...((r.comments as any[]) || []), comment] });
    await notifyThread(r, req.currentUser!.id, { type: "travel_comment", title: `New comment · ${r.reference}`, body: `${comment.authorName}: ${body.slice(0, 90)}` });
    res.json(updated);
  });

  // ----- Owner: cancel (before it's booked) -----
  app.post("/api/travel/:id/cancel", requireAuth, async (req, res) => {
    const r = await storage.getTripRequest(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    if (r.requesterId !== req.currentUser!.id && req.currentUser!.role !== "super_admin") return res.status(403).json({ error: "Only the requester can cancel." });
    if (["booked", "rejected", "cancelled"].includes(r.status)) return res.status(400).json({ error: "This request can no longer be cancelled." });
    const updated = await storage.updateTripRequest(req.params.id, { status: "cancelled" });
    await log(req, "TRAVEL_CANCEL", "trip", r.id, r, updated);
    res.json(updated);
  });
}
