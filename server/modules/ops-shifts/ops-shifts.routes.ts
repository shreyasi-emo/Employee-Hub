import type { Express, Request } from "express";
import { db } from "../../db";
import { storage } from "../../storage";
import { opsShiftSlots, opsShiftAssignments, employees, users } from "@shared/schema";
import { eq, and, inArray, asc, gte } from "drizzle-orm";
import { requireAuth, requireRole, hasRole } from "../../shared/auth";
import { log } from "../../shared/audit";
import { z } from "zod";

// Ops Shift Management — day-based slots with capacity for Ops Employees.
//  - Incharge (ops_shift_incharge / super_admin): create slots, assign/reassign/override, auto-assign.
//  - Ops Employee: view own shifts; self-select an OPEN slot for a day they aren't explicitly assigned.
// assignmentType: "assigned" = incharge-set (LOCKED); "self" = employee-picked; "auto" = system.
export function registerOpsShiftRoutes(app: Express) {
  const canIncharge = (req: Request) => hasRole(req, "super_admin", "ops_shift_incharge");
  const today = () => new Date().toISOString().slice(0, 10);

  // All Ops employees (role ops_employee), with their name/code — the roster the incharge manages.
  async function opsRoster() {
    const rows = await db.select({
      employeeId: employees.id, firstName: employees.firstName, lastName: employees.lastName, employeeCode: employees.employeeCode,
    }).from(employees).innerJoin(users, eq(users.employeeId, employees.id)).where(eq(users.role, "ops_employee"));
    return rows.map((r) => ({ ...r, name: `${r.firstName} ${r.lastName}`.trim() }));
  }
  const nameFor = (roster: any[], employeeId: string) => roster.find((r) => r.employeeId === employeeId)?.name || "Employee";

  // Assignments (joined to slots) for a set of slot ids.
  async function assignmentsForSlots(slotIds: string[]) {
    if (slotIds.length === 0) return [];
    return db.select().from(opsShiftAssignments).where(inArray(opsShiftAssignments.slotId, slotIds));
  }
  // An employee's assignment on a given date (via the slot's date), or null.
  async function assignmentOnDate(employeeId: string, date: string) {
    const rows = await db.select({ a: opsShiftAssignments, s: opsShiftSlots })
      .from(opsShiftAssignments)
      .innerJoin(opsShiftSlots, eq(opsShiftSlots.id, opsShiftAssignments.slotId))
      .where(and(eq(opsShiftAssignments.employeeId, employeeId), eq(opsShiftSlots.date, date)));
    return rows[0] || null;
  }

  // ===================== INCHARGE: slots + roster for a day =====================
  app.get("/api/ops-shifts", requireAuth, requireRole("super_admin", "ops_shift_incharge"), async (req, res) => {
    const date = (req.query.date as string) || today();
    const slots = await db.select().from(opsShiftSlots).where(eq(opsShiftSlots.date, date)).orderBy(asc(opsShiftSlots.startTime));
    const roster = await opsRoster();
    const assigns = await assignmentsForSlots(slots.map((s) => s.id));
    const slotsOut = slots.map((s) => {
      const mine = assigns.filter((a) => a.slotId === s.id).map((a) => ({ ...a, employeeName: nameFor(roster, a.employeeId) }));
      return { ...s, assignments: mine, taken: mine.length, remaining: Math.max(0, s.capacity - mine.length) };
    });
    // roster with each employee's assignment state for the day
    const byEmp = new Map(assigns.map((a) => [a.employeeId, a]));
    const rosterOut = roster.map((r) => {
      const a = byEmp.get(r.employeeId);
      const slot = a ? slots.find((s) => s.id === a.slotId) : null;
      return { ...r, assignment: a ? { id: a.id, slotId: a.slotId, slotName: slot?.name, assignmentType: a.assignmentType } : null };
    });
    res.json({ date, slots: slotsOut, roster: rosterOut });
  });

  const slotSchema = z.object({
    name: z.string().trim().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().trim().min(1),
    endTime: z.string().trim().min(1),
    capacity: z.coerce.number().int().positive().max(999),
    openForSelection: z.boolean().optional(),
    notes: z.string().trim().max(500).nullish(),
  });
  app.post("/api/ops-shifts", requireAuth, requireRole("super_admin", "ops_shift_incharge"), async (req, res) => {
    const parsed = slotSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid slot" });
    const [slot] = await db.insert(opsShiftSlots).values({ ...parsed.data, createdById: req.currentUser!.id } as any).returning();
    res.json(slot);
  });

  app.patch("/api/ops-shifts/:id", requireAuth, requireRole("super_admin", "ops_shift_incharge"), async (req, res) => {
    const parsed = slotSchema.partial().safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid update" });
    const [slot] = await db.update(opsShiftSlots).set({ ...parsed.data, updatedAt: new Date() } as any).where(eq(opsShiftSlots.id, String(req.params.id))).returning();
    if (!slot) return res.status(404).json({ error: "Slot not found" });
    res.json(slot);
  });

  app.delete("/api/ops-shifts/:id", requireAuth, requireRole("super_admin", "ops_shift_incharge"), async (req, res) => {
    await db.delete(opsShiftAssignments).where(eq(opsShiftAssignments.slotId, String(req.params.id)));
    await db.delete(opsShiftSlots).where(eq(opsShiftSlots.id, String(req.params.id)));
    res.json({ success: true });
  });

  // ===================== INCHARGE: assign / reassign / override =====================
  app.post("/api/ops-shifts/:slotId/assign", requireAuth, requireRole("super_admin", "ops_shift_incharge"), async (req, res) => {
    const employeeId = String(req.body?.employeeId || "");
    if (!employeeId) return res.status(400).json({ error: "employeeId required" });
    const [slot] = await db.select().from(opsShiftSlots).where(eq(opsShiftSlots.id, String(req.params.slotId)));
    if (!slot) return res.status(404).json({ error: "Slot not found" });
    const roster = await opsRoster();
    if (!roster.some((r) => r.employeeId === employeeId)) return res.status(400).json({ error: "Not an Ops employee" });
    // Override: drop the employee's existing assignment for that DAY (self / auto / assigned — incharge wins).
    const existing = await assignmentOnDate(employeeId, slot.date);
    if (existing) {
      if (existing.a.slotId === String(req.params.slotId)) {
        // already in this slot — just lock it as an explicit assignment
        const [up] = await db.update(opsShiftAssignments).set({ assignmentType: "assigned", assignedById: req.currentUser!.id, updatedAt: new Date() }).where(eq(opsShiftAssignments.id, existing.a.id)).returning();
        return res.json(up);
      }
      await db.delete(opsShiftAssignments).where(eq(opsShiftAssignments.id, existing.a.id));
    }
    // Capacity check on the target slot.
    const taken = (await db.select().from(opsShiftAssignments).where(eq(opsShiftAssignments.slotId, slot.id))).length;
    if (taken >= slot.capacity) return res.status(400).json({ error: "This slot is full." });
    const [created] = await db.insert(opsShiftAssignments).values({ slotId: slot.id, employeeId, assignmentType: "assigned", assignedById: req.currentUser!.id } as any).returning();
    try {
      const u = (await storage.getAllUsers()).find((x: any) => x.employeeId === employeeId);
      if (u) await storage.notifyUser(u.id, { type: "ops_shift_assigned", title: "Shift assigned", body: `You're assigned to ${slot.name} (${slot.startTime}–${slot.endTime}) on ${slot.date}.`, link: "/my-shifts" });
    } catch {}
    res.json(created);
  });

  app.post("/api/ops-shifts/assignments/:id/unassign", requireAuth, requireRole("super_admin", "ops_shift_incharge"), async (req, res) => {
    const [a] = await db.select().from(opsShiftAssignments).where(eq(opsShiftAssignments.id, String(req.params.id)));
    if (!a) return res.status(404).json({ error: "Assignment not found" });
    await db.delete(opsShiftAssignments).where(eq(opsShiftAssignments.id, String(req.params.id)));
    res.json({ success: true });
  });

  // Auto-assign every still-unassigned Ops employee to an open slot with remaining capacity (round-robin fill).
  app.post("/api/ops-shifts/auto-assign", requireAuth, requireRole("super_admin", "ops_shift_incharge"), async (req, res) => {
    const date = String(req.body?.date || today());
    const slots = await db.select().from(opsShiftSlots).where(eq(opsShiftSlots.date, date)).orderBy(asc(opsShiftSlots.startTime));
    if (slots.length === 0) return res.status(400).json({ error: "No slots exist for this date." });
    const roster = await opsRoster();
    const assigns = await assignmentsForSlots(slots.map((s) => s.id));
    const assignedEmp = new Set(assigns.map((a) => a.employeeId));
    const remaining: Record<string, number> = {};
    for (const s of slots) remaining[s.id] = s.capacity - assigns.filter((a) => a.slotId === s.id).length;
    const unassigned = roster.filter((r) => !assignedEmp.has(r.employeeId));
    let placed = 0;
    for (const emp of unassigned) {
      const slot = slots.find((s) => remaining[s.id] > 0);
      if (!slot) break; // no capacity left anywhere
      await db.insert(opsShiftAssignments).values({ slotId: slot.id, employeeId: emp.employeeId, assignmentType: "auto", assignedById: req.currentUser!.id } as any);
      remaining[slot.id] -= 1; placed += 1;
    }
    res.json({ placed, unplaced: unassigned.length - placed });
  });

  // ===================== OPS EMPLOYEE: my shifts + self-select =====================
  app.get("/api/ops-shifts/my", requireAuth, async (req, res) => {
    const empId = req.currentUser!.employeeId;
    if (!empId) return res.json({ assignments: [], openSlots: [] });
    const from = (req.query.from as string) || today();
    // Upcoming slots (from today) + my assignments among them.
    const slots = await db.select().from(opsShiftSlots).where(gte(opsShiftSlots.date, from)).orderBy(asc(opsShiftSlots.date), asc(opsShiftSlots.startTime));
    const slotIds = slots.map((s) => s.id);
    const allAssigns = await assignmentsForSlots(slotIds);
    const mine = allAssigns.filter((a) => a.employeeId === empId);
    const myByDate = new Map(mine.map((a) => { const s = slots.find((x) => x.id === a.slotId); return [s?.date, a]; }));
    const takenBySlot: Record<string, number> = {};
    for (const a of allAssigns) takenBySlot[a.slotId] = (takenBySlot[a.slotId] || 0) + 1;

    const assignments = mine.map((a) => {
      const s = slots.find((x) => x.id === a.slotId)!;
      return { id: a.id, slotId: a.slotId, assignmentType: a.assignmentType, locked: a.assignmentType === "assigned",
        name: s.name, date: s.date, startTime: s.startTime, endTime: s.endTime };
    });
    // Open slots I could pick: openForSelection, has room, and I'm NOT locked that day.
    const openSlots = slots.filter((s) => {
      if (!s.openForSelection) return false;
      const myA = myByDate.get(s.date);
      if (myA && (myA as any).assignmentType === "assigned") return false; // locked that day
      if ((myA as any)?.slotId === s.id) return false; // already in this one
      const remaining = s.capacity - (takenBySlot[s.id] || 0);
      return remaining > 0;
    }).map((s) => ({ id: s.id, name: s.name, date: s.date, startTime: s.startTime, endTime: s.endTime,
      capacity: s.capacity, remaining: s.capacity - (takenBySlot[s.id] || 0) }));

    res.json({ assignments, openSlots });
  });

  app.post("/api/ops-shifts/:slotId/select", requireAuth, requireRole("ops_employee", "super_admin"), async (req, res) => {
    const empId = req.currentUser!.employeeId;
    if (!empId) return res.status(400).json({ error: "No employee profile linked to your account." });
    const [slot] = await db.select().from(opsShiftSlots).where(eq(opsShiftSlots.id, String(req.params.slotId)));
    if (!slot) return res.status(404).json({ error: "Slot not found" });
    if (!slot.openForSelection) return res.status(400).json({ error: "This slot isn't open for self-selection." });
    // Locked rule: if the incharge has explicitly assigned this day, the employee cannot change it.
    const existing = await assignmentOnDate(empId, slot.date);
    if (existing) {
      if (existing.a.assignmentType === "assigned") return res.status(403).json({ error: "Your shift for this day is fixed by your incharge." });
      if (existing.a.slotId === slot.id) return res.json(existing.a); // already selected
      await db.delete(opsShiftAssignments).where(eq(opsShiftAssignments.id, existing.a.id)); // move to the new slot
    }
    const taken = (await db.select().from(opsShiftAssignments).where(eq(opsShiftAssignments.slotId, slot.id))).length;
    if (taken >= slot.capacity) return res.status(400).json({ error: "No seats left in this slot." });
    const [created] = await db.insert(opsShiftAssignments).values({ slotId: slot.id, employeeId: empId, assignmentType: "self" } as any).returning();
    res.json(created);
  });

  app.post("/api/ops-shifts/assignments/:id/release", requireAuth, async (req, res) => {
    const empId = req.currentUser!.employeeId;
    const [a] = await db.select().from(opsShiftAssignments).where(eq(opsShiftAssignments.id, String(req.params.id)));
    if (!a) return res.status(404).json({ error: "Assignment not found" });
    if (a.employeeId !== empId) return res.status(403).json({ error: "Not your shift." });
    if (a.assignmentType === "assigned") return res.status(403).json({ error: "This shift was assigned by your incharge and can't be changed." });
    await db.delete(opsShiftAssignments).where(eq(opsShiftAssignments.id, String(req.params.id)));
    res.json({ success: true });
  });
}
