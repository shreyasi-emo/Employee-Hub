// v2 routes: logistics, vehicles, reimbursements, unified requests,
// CEO approval notes, reference docs, Zoho config & jobs.
// Registered from server/routes.ts via registerV2Routes(app).
import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { requireAuth } from "./auth";
import { enqueueZohoPush } from "./zoho";
import { randomUUID } from "crypto";

// Role helpers
function hasRole(req: Request, ...roles: string[]) {
  return !!req.currentUser && roles.includes(req.currentUser.role);
}
function requireLogistics(req: Request, res: Response, next: NextFunction) {
  if (hasRole(req, "super_admin", "logistics", "hr_admin")) return next();
  return res.status(403).json({ error: "Logistics access required" });
}
function requireTeamHandler(req: Request, res: Response, next: NextFunction) {
  // Teams that handle requests: HR, Admin, Logistics, Finance, IT
  if (hasRole(req, "super_admin", "hr_admin", "hr_executive", "hr_ops", "office_admin", "logistics", "finance")) return next();
  return res.status(403).json({ error: "Team handler access required" });
}
function requireCEO(req: Request, res: Response, next: NextFunction) {
  if (hasRole(req, "super_admin", "ceo_approver")) return next();
  return res.status(403).json({ error: "CEO access required" });
}

// The vehicle booking window is evaluated in India Standard Time (UTC+5:30, no DST) so it
// behaves identically regardless of the timezone the server process runs in.
const IST_OFFSET_MS = 330 * 60000;
// The UTC instant of a given IST wall-clock hour on the same IST calendar day as `ref`.
function istBoundary(ref: Date, hour: number): Date {
  const ist = new Date(ref.getTime() + IST_OFFSET_MS);
  ist.setUTCHours(hour, 0, 0, 0);
  return new Date(ist.getTime() - IST_OFFSET_MS);
}

export function registerV2Routes(app: Express) {

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
  app.get("/api/vehicles", requireAuth, async (_req, res) => {
    res.json(await storage.listCompanyVehicles());
  });
  app.post("/api/vehicles", requireAuth, async (req, res) => {
    if (!hasRole(req, "super_admin", "hr_admin")) return res.status(403).json({ error: "Forbidden" });
    res.json(await storage.createCompanyVehicle(req.body));
  });
  app.patch("/api/vehicles/:id", requireAuth, async (req, res) => {
    if (!hasRole(req, "super_admin", "hr_admin")) return res.status(403).json({ error: "Forbidden" });
    res.json(await storage.updateCompanyVehicle(req.params.id, req.body));
  });
  app.delete("/api/vehicles/:id", requireAuth, async (req, res) => {
    if (!hasRole(req, "super_admin", "hr_admin")) return res.status(403).json({ error: "Forbidden" });
    res.json(await storage.deleteCompanyVehicle(req.params.id));
  });
  app.get("/api/vehicles/bookings", requireAuth, async (req, res) => {
    res.json(await storage.listVehicleBookings(req.query.vehicleId as string | undefined));
  });

  // Unified booking entry point. Decides between an instant company-car booking and an
  // HR-approval rental request based on slot availability + passenger count (car seats 4).
  app.post("/api/vehicles/book", requireAuth, async (req, res) => {
    try {
      const b = req.body || {};
      const vehicles = await storage.listCompanyVehicles() as any[];

      const start = new Date(b.startTime), end = new Date(b.endTime);
      if (isNaN(+start) || isNaN(+end) || !(start < end)) return res.status(400).json({ error: "Please provide a valid start and end time (end must be after start)." });
      if (start.getTime() < Date.now()) return res.status(400).json({ error: "Bookings can't start in the past — pick a future time." });

      // Booking window is fixed 7:00 AM – 7:00 PM.
      const W_START = 7, W_END = 19, BLOCK = 3;
      const dayStart = istBoundary(start, W_START);
      const dayEnd = istBoundary(start, W_END);
      if (start < dayStart || end > dayEnd) return res.status(400).json({ error: "Bookings must be between 7:00 AM and 7:00 PM." });

      const tripType = b.tripType === "inter_city" ? "inter_city" : "intra_city";
      const computeBlock = () => {
        if (tripType === "inter_city") return { blockStart: dayStart, blockEnd: dayEnd };
        const durH = Math.max(1, (+end - +start) / 3600000);
        const blocks = Math.max(1, Math.ceil(durH / BLOCK));
        let be = new Date(+start + blocks * BLOCK * 3600000);
        if (be > dayEnd) be = dayEnd;
        return { blockStart: new Date(start), blockEnd: be };
      };
      const { blockStart, blockEnd } = computeBlock();
      const capOf = (v: any) => Math.max(1, (v?.seatingCapacity ? Number(v.seatingCapacity) : 5) - 1); // seats minus driver

      const attendees = Array.isArray(b.attendees) ? b.attendees : [];
      const pax = Math.max(1, attendees.length);

      // Resolve the requested company car(s): explicit vehicleIds[] > single vehicleId > all active cars.
      const requestedIds: string[] = Array.isArray(b.vehicleIds) && b.vehicleIds.length
        ? b.vehicleIds : (b.vehicleId ? [b.vehicleId] : []);
      const requested: any[] = [];
      for (const id of requestedIds) {
        const v = vehicles.find((x) => x.id === id);
        if (!v) return res.status(400).json({ error: "That vehicle no longer exists." });
        if (v.status !== "active") return res.status(400).json({ error: `"${v.model || v.name}" isn't available for booking (in maintenance).` });
        requested.push(v);
      }
      if (!requested.length) {
        const active = vehicles.filter((v) => v.status === "active");
        if (!active.length) return res.status(400).json({ error: vehicles.length
          ? "No company car is available right now — all vehicles are in maintenance."
          : "No company vehicle is configured yet. Ask HR to add one." });
        requested.push(...active);
      }

      const base = (vId: string) => ({
        vehicleId: vId, requesterId: req.currentUser!.id, purpose: b.purpose || "Vehicle booking",
        startTime: start, endTime: end,
        pickupLocation: b.pickupLocation || null, dropLocation: b.dropLocation || null, notes: b.notes || null,
      });
      const groupId = randomUUID();

      const notifyHr = async (rental: any) => {
        try {
          await storage.notifyByRole(["hr_admin", "super_admin"], {
            type: "approval_pending", title: "Rental Car Request",
            body: `A rental car was requested for "${rental.purpose}" (${rental.passengers} passenger${rental.passengers !== 1 ? "s" : ""}). Awaiting your approval.`,
            link: "/vehicles",
          });
        } catch { /* best-effort */ }
      };
      const bookerName = (attendees.find((a: any) => a?.userId === req.currentUser!.id)?.name || "").trim() || req.currentUser!.username || "A colleague";
      const dateLabel = start.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      const notifyRentalPassengers = async (rental: any) => {
        for (const a of (Array.isArray(rental.attendees) ? rental.attendees : [])) {
          if (!a?.userId || a.userId === req.currentUser!.id) continue;
          try {
            await storage.notifyUser(a.userId, { type: "info", title: "Added to a rental car request",
              body: `${bookerName} added you as a passenger for "${rental.purpose}" on ${dateLabel}. It's pending HR approval.`, link: "/vehicles" });
          } catch { /* best-effort */ }
        }
      };

      // Which requested cars are free for this block window (pre-check; the transaction re-checks under a lock).
      const freeCars: any[] = [];
      for (const v of requested) {
        const conflicts = await storage.companyCarConflicts(v.id, blockStart, blockEnd);
        if (!conflicts.length) freeCars.push(v);
      }

      // No free company car (or the employee explicitly chose rental) → one rental request for everyone.
      if (b.intent === "rental" || freeCars.length === 0) {
        const nominalVehicle = (freeCars[0] || requested[0]).id;
        const [rental] = await storage.createBookingTransaction([], [{
          ...base(nominalVehicle), bookingType: "rental", status: "pending_hr_approval", passengers: pax, attendees, groupId,
        }]);
        await notifyHr(rental); await notifyRentalPassengers(rental);
        return res.json({ companies: [], rental, company: null });
      }

      // Fill passengers across the free company cars by capacity; any remainder becomes an overflow rental.
      const companyLegs: any[] = [];
      let idx = 0;
      for (const v of freeCars) {
        if (idx >= pax) break;
        const cap = capOf(v);
        companyLegs.push({
          ...base(v.id), bookingType: "company_car", status: "confirmed", tripType, blockStart, blockEnd,
          passengers: Math.min(cap, pax - idx), attendees: attendees.slice(idx, idx + cap), groupId,
        });
        idx += cap;
      }
      const remaining = pax - idx;
      const rentalLegs: any[] = [];
      if (remaining > 0) {
        rentalLegs.push({
          ...base(freeCars[0].id), bookingType: "rental", status: "pending_hr_approval",
          passengers: remaining, attendees: attendees.slice(idx), groupId,
          notes: `${b.notes ? b.notes + " · " : ""}Overflow from company car booking (excess passengers).`,
        });
      }
      const created = await storage.createBookingTransaction(companyLegs, rentalLegs);
      const companies = created.filter((r: any) => r.bookingType === "company_car");
      const rental = created.find((r: any) => r.bookingType === "rental") || null;
      if (rental) { await notifyHr(rental); await notifyRentalPassengers(rental); }
      return res.json({ companies, rental, company: companies[0] || null });
    } catch (e: any) {
      res.status(409).json({ error: e.message });
    }
  });

  app.post("/api/vehicles/bookings/:id/cancel", requireAuth, async (req, res) => {
    const bk = await storage.getVehicleBooking(req.params.id);
    if (!bk) return res.status(404).json({ error: "Not found" });
    if (bk.requesterId !== req.currentUser!.id && !hasRole(req, "super_admin", "hr_admin"))
      return res.status(403).json({ error: "You can only cancel your own bookings." });
    const cancelled = await storage.cancelVehicleBooking(req.params.id);
    // A trip can span several legs (multiple company cars + an overflow rental) sharing a groupId —
    // cancel the whole trip. Fall back to the pairwise link for bookings made before groupId existed.
    const siblings = (bk as any).groupId
      ? await storage.getBookingsByGroup((bk as any).groupId)
      : (bk.linkedBookingId ? [await storage.getVehicleBooking(bk.linkedBookingId)] : []);
    for (const sib of siblings) {
      if (!sib || sib.id === bk.id || sib.status === "cancelled" || sib.status === "rejected") continue;
      try { await storage.cancelVehicleBooking(sib.id); } catch { /* best-effort */ }
    }
    res.json(cancelled);
  });

  // Edit a booking in place (organiser or HR). Keeps its type/status; recomputes the company-car block.
  app.patch("/api/vehicles/bookings/:id", requireAuth, async (req, res) => {
    try {
      const bk = await storage.getVehicleBooking(req.params.id);
      if (!bk) return res.status(404).json({ error: "Not found" });
      if (bk.requesterId !== req.currentUser!.id && !hasRole(req, "super_admin", "hr_admin"))
        return res.status(403).json({ error: "You can only edit your own bookings." });
      const b = req.body || {};
      const start = new Date(b.startTime), end = new Date(b.endTime);
      if (isNaN(+start) || isNaN(+end) || !(start < end)) return res.status(400).json({ error: "Please provide a valid start and end time." });
      if (start.getTime() < Date.now()) return res.status(400).json({ error: "Bookings can't start in the past — pick a future time." });
      const W_START = 7, W_END = 19, BLOCK = 3;
      const dayStart = istBoundary(start, W_START);
      const dayEnd = istBoundary(start, W_END);
      if (start < dayStart || end > dayEnd) return res.status(400).json({ error: "Bookings must be between 7:00 AM and 7:00 PM." });
      const attendees = Array.isArray(b.attendees) ? b.attendees : (bk.attendees as any[]) || [];
      const patch: any = {
        purpose: (b.purpose || bk.purpose || "").trim() || "Vehicle booking",
        startTime: start, endTime: end,
        pickupLocation: b.pickupLocation ?? bk.pickupLocation, dropLocation: b.dropLocation ?? bk.dropLocation,
        notes: b.notes ?? bk.notes, attendees, passengers: Math.max(1, attendees.length),
      };
      if (bk.bookingType === "company_car") {
        const tripType = b.tripType === "inter_city" ? "inter_city" : "intra_city";
        let blockStart: Date, blockEnd: Date;
        if (tripType === "inter_city") { blockStart = dayStart; blockEnd = dayEnd; }
        else {
          const durH = Math.max(1, (+end - +start) / 3600000);
          const blocks = Math.max(1, Math.ceil(durH / BLOCK));
          let be = new Date(+start + blocks * BLOCK * 3600000);
          if (be > dayEnd) be = dayEnd;
          blockStart = new Date(start); blockEnd = be;
        }
        const vehicleId = b.vehicleId || bk.vehicleId;
        // Capacity guard — a company car can't be edited past its passenger seats (total − driver).
        const veh = (await storage.listCompanyVehicles() as any[]).find((v) => v.id === vehicleId);
        const CAP = Math.max(1, (veh?.seatingCapacity ? Number(veh.seatingCapacity) : 5) - 1);
        if (attendees.length > CAP) return res.status(400).json({ error: `This car seats ${CAP} passenger${CAP !== 1 ? "s" : ""}. Remove some, or cancel and re-book to add a second car or a rental.` });
        const conflicts = await storage.companyCarConflicts(vehicleId, blockStart, blockEnd, bk.id);
        if (conflicts.length) return res.status(409).json({ error: "The company car is already booked/blocked for that time." });
        patch.tripType = tripType; patch.blockStart = blockStart; patch.blockEnd = blockEnd; patch.vehicleId = vehicleId;
      }
      res.json(await storage.updateVehicleBooking(bk.id, patch));
    } catch (e: any) {
      res.status(409).json({ error: e.message });
    }
  });

  // A passenger (not the organiser) removes themselves from a trip.
  app.post("/api/vehicles/bookings/:id/opt-out", requireAuth, async (req, res) => {
    const bk = await storage.getVehicleBooking(req.params.id);
    if (!bk) return res.status(404).json({ error: "Not found" });
    const me = req.currentUser!.id;
    if (bk.requesterId === me) return res.status(400).json({ error: "The organiser can't opt out — cancel the trip instead." });
    const attendees = Array.isArray(bk.attendees) ? (bk.attendees as any[]) : [];
    if (!attendees.some((a) => a?.userId === me)) return res.status(400).json({ error: "You're not a passenger on this trip." });
    res.json(await storage.setVehicleBookingAttendees(req.params.id, attendees.filter((a) => a?.userId !== me)));
  });

  // HR Admin / Super Admin approve or reject a rental car request.
  app.post("/api/vehicles/rentals/:id/approve", requireAuth, async (req, res) => {
    if (!hasRole(req, "super_admin", "hr_admin")) return res.status(403).json({ error: "HR approval required" });
    const bk = await storage.getVehicleBooking(req.params.id);
    if (!bk || bk.bookingType !== "rental") return res.status(404).json({ error: "Rental request not found" });
    if (bk.status !== "pending_hr_approval") return res.status(400).json({ error: `Cannot approve a rental in '${bk.status}' state` });
    const r = await storage.setRentalDecision(req.params.id, "approved", req.currentUser!.id, req.body?.note || null);
    try { await storage.notifyUser(bk.requesterId, { type: "request_approved", title: "Rental Car Approved", body: `Your rental car request for "${bk.purpose}" was approved and is now on the shared calendar.`, link: "/vehicles" }); } catch {}
    // Notify the other passengers (not the booker) that the rental is confirmed.
    try {
      const atts = Array.isArray(bk.attendees) ? (bk.attendees as any[]) : [];
      const bookerName = (atts.find((a) => a?.userId === bk.requesterId)?.name || "").trim() || "A colleague";
      for (const a of atts) {
        if (!a?.userId || a.userId === bk.requesterId) continue;
        await storage.notifyUser(a.userId, { type: "request_approved", title: "Rental Car Confirmed", body: `${bookerName}'s rental car for "${bk.purpose}" was approved — you're on the trip.`, link: "/vehicles" });
      }
    } catch {}
    res.json(r);
  });
  app.post("/api/vehicles/rentals/:id/reject", requireAuth, async (req, res) => {
    if (!hasRole(req, "super_admin", "hr_admin")) return res.status(403).json({ error: "HR approval required" });
    const bk = await storage.getVehicleBooking(req.params.id);
    if (!bk || bk.bookingType !== "rental") return res.status(404).json({ error: "Rental request not found" });
    if (bk.status !== "pending_hr_approval") return res.status(400).json({ error: `Cannot reject a rental in '${bk.status}' state` });
    const note = req.body?.note || null;
    const r = await storage.setRentalDecision(req.params.id, "rejected", req.currentUser!.id, note);
    try { await storage.notifyUser(bk.requesterId, { type: "request_rejected", title: "Rental Car Rejected", body: `Your rental car request for "${bk.purpose}" was rejected.${note ? " Note: " + note : ""}`, link: "/vehicles" }); } catch {}
    res.json(r);
  });

  // =========================================================================
  // REIMBURSEMENTS  (raise here -> on approve, push to Zoho Books)
  // =========================================================================
  // Approval stages: submitted -> (Finance) finance_approved -> (CEO) approved
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

  app.get("/api/reimbursements", requireAuth, async (req, res) => {
    // Finance + CEO + admin can see all claims; everyone else sees only their own.
    // `?mine=true` forces own-only regardless of role (used by the My Requests page).
    const isApprover = hasRole(req, "super_admin", "finance", "ceo_approver");
    const mineOnly = req.query.mine === "true" || req.query.mine === "1";
    const filters: any = {};
    if (!isApprover || mineOnly) filters.requesterId = req.currentUser!.id;
    if (req.query.status) filters.status = req.query.status;
    res.json(await storage.listReimbursements(filters));
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
    const created = await storage.createReimbursement({ ...req.body, ...ctx, lines, totalAmount: sumLines(lines), requesterId: req.currentUser!.id, status: "submitted" });
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
    res.json(await storage.updateRequest(req.params.id, req.body));
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
    res.json(await storage.listRequestComments(req.params.id));
  });
  app.post("/api/requests/:id/comments", requireAuth, async (req, res) => {
    res.json(await storage.addRequestComment({
      requestId: req.params.id, authorId: req.currentUser!.id, body: req.body.body,
    }));
  });

  // =========================================================================
  // CEO APPROVAL NOTES
  // =========================================================================
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
