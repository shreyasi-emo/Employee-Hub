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

// The vehicle booking window is evaluated in India Standard Time (UTC+5:30, no DST) so it
// behaves identically regardless of the timezone the server process runs in.
const IST_OFFSET_MS = 330 * 60000;
// The UTC instant of a given IST wall-clock hour on the same IST calendar day as `ref`.
function istBoundary(ref: Date, hour: number): Date {
  const ist = new Date(ref.getTime() + IST_OFFSET_MS);
  ist.setUTCHours(hour, 0, 0, 0);
  return new Date(ist.getTime() - IST_OFFSET_MS);
}

export function registerVehicleRoutes(app: Express) {
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
}
