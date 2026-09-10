import type { Express } from "express";
import { storage } from "../../storage";
import { requireAuth, requireHR, hasRole } from "../../shared/auth";
import { log } from "../../shared/audit";

// Fields an employee may request to change (mirrors the self-edit dialog). Statutory / employment /
// role fields are never editable this way — anything outside this set is dropped server-side.
const ALLOWED = new Set([
  "dateOfBirth", "gender", "maritalStatus", "bloodGroup", "phone",
  "currentAddress", "permanentAddress",
  "emergencyContactName", "emergencyContactPhone", "emergencyContactRelation",
  "bankName", "bankAccountMasked", "ifscCode",
]);

// changes are stored as { field: { label, old, new } }; pull the new value (tolerating a bare value).
const newValue = (v: any) => (v && typeof v === "object" && "new" in v ? v.new : v);

export function registerProfileEditRoutes(app: Express) {
  // List — HR sees all (optional employeeId/status filter); everyone else sees only their own.
  app.get("/api/profile-edit-requests", requireAuth, async (req, res) => {
    const viewer = req.currentUser!;
    const { employeeId, status } = req.query as any;
    if (hasRole(req, "super_admin", "hr_admin", "hr_executive")) {
      return res.json(await storage.getProfileEditRequests(employeeId || undefined, status || undefined));
    }
    if (!viewer.employeeId) return res.json([]);
    return res.json(await storage.getProfileEditRequests(viewer.employeeId, status || undefined));
  });

  // Create — an employee requests changes to their OWN profile (no direct write happens here).
  app.post("/api/profile-edit-requests", requireAuth, async (req, res) => {
    const viewer = req.currentUser!;
    if (!viewer.employeeId) return res.status(400).json({ error: "No linked employee record" });
    const raw = req.body?.changes;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return res.status(400).json({ error: "No changes provided" });
    const changes: Record<string, any> = {};
    for (const [k, v] of Object.entries(raw)) if (ALLOWED.has(k)) changes[k] = v;
    if (Object.keys(changes).length === 0) return res.status(400).json({ error: "No editable changes provided" });
    const created = await storage.createProfileEditRequest({ employeeId: viewer.employeeId, changes, reason: req.body?.reason || null, status: "pending" } as any);
    const n = Object.keys(changes).length;
    try {
      const emp = await storage.getEmployee(viewer.employeeId);
      const who = emp ? `${emp.firstName} ${emp.lastName}` : "An employee";
      await storage.notifyByRole(["super_admin", "hr_admin", "hr_executive"], {
        type: "profile_edit_request", title: "Profile change request",
        body: `${who} requested ${n} profile change${n !== 1 ? "s" : ""} for your review.`,
        link: emp ? `/employees/${emp.id}` : "/employees",
      });
    } catch {}
    await log(req, "PROFILE_EDIT_REQUEST", "employee", viewer.employeeId, null, changes);
    res.json(created);
  });

  // Decide — HR approves/rejects. Approving applies the (allowed) changes to the employee record.
  app.put("/api/profile-edit-requests/:id", requireAuth, requireHR, async (req, res) => {
    const id = String(req.params.id);
    const reqRow = await storage.getProfileEditRequest(id);
    if (!reqRow) return res.status(404).json({ error: "Not found" });
    const { status, approvalNotes } = req.body || {};
    if (!["approved", "rejected"].includes(status)) return res.status(400).json({ error: "status must be approved or rejected" });
    if (reqRow.status !== "pending") return res.status(400).json({ error: "This request has already been decided." });

    if (status === "approved") {
      const changes = (reqRow.changes || {}) as Record<string, any>;
      const updates: Record<string, any> = {};
      for (const [k, v] of Object.entries(changes)) if (ALLOWED.has(k)) updates[k] = newValue(v) ?? null;
      if (Object.keys(updates).length) {
        const before = await storage.getEmployee(reqRow.employeeId);
        const after = await storage.updateEmployee(reqRow.employeeId, updates as any);
        await log(req, "PROFILE_EDIT_APPROVE", "employee", reqRow.employeeId, before, after);
      }
    }
    const updated = await storage.updateProfileEditRequest(id, { status, approvalNotes: approvalNotes || null, approvedBy: req.currentUser!.id } as any);
    try {
      const empUser = (await storage.getAllUsers()).find((u: any) => u.employeeId === reqRow.employeeId);
      if (empUser) await storage.notifyUser(empUser.id, {
        type: `profile_edit_${status}`, title: `Profile change ${status}`,
        body: `Your profile change request was ${status}.${approvalNotes ? ` Note: ${approvalNotes}` : ""}`,
        link: `/employees/${reqRow.employeeId}`,
      });
    } catch {}
    res.json(updated);
  });
}
