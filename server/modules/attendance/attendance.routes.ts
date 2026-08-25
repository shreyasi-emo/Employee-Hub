import type { Express, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { db, pool } from "../../db";
import { storage } from "../../storage";
import { eq } from "drizzle-orm";
import { users, roleEnum } from "@shared/schema";
import {
  requireAuth, requireHR, requireAdmin, requireRole,
  requireWorkspace, requireCEO, requireLogistics, requireTeamHandler,
  hasRole, hashPassword, verifyPassword,
} from "../../shared/auth";
import { log, hashToken } from "../../shared/audit";
import { getDaysInMonth, countWeekends } from "../../shared/date-utils";
import { sanitizeEmployeeForRole } from "../../utils/sanitize";
import { googleStart, googleCallback, logout as googleLogout } from "../../google-auth";
import {
  insertEmployeeSchema, insertDepartmentSchema, insertDesignationSchema,
  insertSalaryStructureSchema, insertAttendanceSchema, insertRegularizationSchema,
  insertLeaveTypeSchema, insertLeaveRequestSchema, insertHolidaySchema,
  insertPayrollRunSchema, insertAnnouncementSchema, insertAssetSchema,
  insertRatingScaleSchema, insertPerformanceCycleSchema, insertGoalSchema,
  insertGoalProgressSchema, insertReviewSchema, insertCalibrationSchema,
  insertShiftSchema, insertShiftAssignmentSchema, insertOnboardingTemplateSchema, insertOnboardingTaskSchema,
} from "@shared/schema";

// A rejected WFH request is "not happening" — the UI hides it and it must NOT occupy the day
// (otherwise it blocks an approved-leave overlay from showing). Drop these from attendance payloads.
function isRejectedWfh(r: any): boolean {
  if (r?.status !== "wfh") return false;
  try { return JSON.parse(r.notes || "{}").approval === "rejected"; } catch { return false; }
}
function visibleAttendance(records: any[]): any[] {
  return (records || []).filter((r) => !isRejectedWfh(r));
}

// Expand approved leave requests into synthetic per-day attendance entries within [from, to].
// Weekends are skipped, and any day that already has a real attendance record is left untouched
// (the real record wins). This keeps the attendance calendar in sync with approved leaves without
// duplicating/persisting rows — so cancelling or rejecting a leave instantly removes it from view.
function expandApprovedLeaveDays(leaves: any[], from: string, to: string, existing: Set<string>) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const out: any[] = [];
  for (const lr of leaves) {
    const startStr = lr.startDate < from ? from : lr.startDate;
    const endStr = lr.endDate > to ? to : lr.endDate;
    const end = parse(endStr);
    for (let d = parse(startStr); d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      const wd = d.getDay();
      if (wd === 0 || wd === 6) continue; // leave doesn't mark weekends
      const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const key = `${lr.employeeId}|${date}`;
      if (existing.has(key)) continue; // explicit attendance record takes precedence
      existing.add(key);
      out.push({
        id: `leave-${lr.id}-${date}`,
        employeeId: lr.employeeId,
        date,
        status: lr.isHalfDay ? "half_day" : "leave",
        source: "leave",
        checkIn: null,
        checkOut: null,
        notes: lr.isHalfDay ? "Half-day leave" : "Approved leave",
        leaveRequestId: lr.id,
        createdAt: lr.createdAt ?? null,
        updatedAt: lr.updatedAt ?? null,
      });
    }
  }
  return out;
}

export function registerAttendanceRoutes(app: Express) {
  app.get("/api/attendance", requireAuth, async (req, res) => {
    const { employeeId, month, year } = req.query;
    const empId = (employeeId as string) || req.currentUser!.employeeId || "";
    if (!empId) return res.status(400).json({ error: "Employee ID required" });
    const m = parseInt(month as string) || new Date().getMonth() + 1;
    const y = parseInt(year as string) || new Date().getFullYear();

    // Check access
    const allowedRoles = ["super_admin", "hr_admin", "hr_executive", "manager", "ceo_approver"];
    if (!allowedRoles.includes(req.currentUser!.role) && req.currentUser!.employeeId !== empId) {
      return res.status(403).json({ error: "Access denied" });
    }
    const records = visibleAttendance(await storage.getAttendanceRecords(empId, m, y));
    const from = `${y}-${String(m).padStart(2, "0")}-01`;
    const to = `${y}-${String(m).padStart(2, "0")}-${String(getDaysInMonth(m, y)).padStart(2, "0")}`;
    const leaves = await storage.getApprovedLeavesInRange(from, to, empId);
    const existing = new Set(records.map((r: any) => `${r.employeeId}|${r.date}`));
    res.json([...records, ...expandApprovedLeaveDays(leaves, from, to, existing)]);
  });

  // Org-wide monthly attendance (for summaries / side panel). HR/manager only.
  app.get("/api/attendance/month", requireAuth, async (req, res) => {
    if (!["super_admin", "hr_admin", "hr_executive", "manager", "ceo_approver"].includes(req.currentUser!.role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const m = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const y = parseInt(req.query.year as string) || new Date().getFullYear();
    const records = visibleAttendance(await storage.getMonthlyAttendance(m, y));
    const from = `${y}-${String(m).padStart(2, "0")}-01`;
    const to = `${y}-${String(m).padStart(2, "0")}-${String(getDaysInMonth(m, y)).padStart(2, "0")}`;
    const leaves = await storage.getApprovedLeavesInRange(from, to);
    const existing = new Set(records.map((r: any) => `${r.employeeId}|${r.date}`));
    res.json([...records, ...expandApprovedLeaveDays(leaves, from, to, existing)]);
  });

  // Org-wide attendance within a date range. HR/manager only.
  app.get("/api/attendance/range", requireAuth, async (req, res) => {
    if (!["super_admin", "hr_admin", "hr_executive", "manager", "ceo_approver"].includes(req.currentUser!.role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: "from and to are required" });
    const records = visibleAttendance(await storage.getAttendanceInRange(from as string, to as string));
    const leaves = await storage.getApprovedLeavesInRange(from as string, to as string);
    const existing = new Set(records.map((r: any) => `${r.employeeId}|${r.date}`));
    res.json([...records, ...expandApprovedLeaveDays(leaves, from as string, to as string, existing)]);
  });

  // Attendance report over a date range. Computes the same present-by-default model used across the
  // app (real record → approved-leave overlay → default Present for elapsed working days). Weekends
  // and holidays are excluded; future days are never counted. Without employeeId → per-employee
  // summary for all active staff; with employeeId → per-day detail for one person.
  app.get("/api/attendance/report", requireAuth, async (req, res) => {
    const viewer = req.currentUser!;
    const { from, to, employeeId } = req.query as any;
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ error: "Valid from and to dates are required." });
    }
    const privileged = ["super_admin", "hr_admin", "hr_executive", "manager", "ceo_approver"].includes(viewer.role);
    if (!privileged && viewer.employeeId !== employeeId) return res.status(403).json({ error: "Access denied" });

    const pad = (n: number) => String(n).padStart(2, "0");
    const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
    const todayD = new Date(); todayD.setHours(0, 0, 0, 0);
    const startD = parse(from);
    let endD = parse(to); if (endD > todayD) endD = todayD;
    if (endD < startD) return res.status(400).json({ error: "The range ends before it starts (or is entirely in the future)." });

    const holSet = new Set<string>();
    for (const yr of Array.from(new Set([startD.getFullYear(), endD.getFullYear()]))) {
      (await storage.getHolidays(yr) as any[]).forEach((h) => holSet.add(h.date));
    }
    const toStr = `${endD.getFullYear()}-${pad(endD.getMonth() + 1)}-${pad(endD.getDate())}`;
    const records = visibleAttendance(await storage.getAttendanceInRange(from, toStr));
    const recMap = new Map<string, string>();
    for (const r of records as any[]) recMap.set(`${r.employeeId}|${r.date}`, r.status);
    const leaves = await storage.getApprovedLeavesInRange(from, toStr, employeeId || undefined);
    const leaveMap = new Map<string, string>();
    for (const ld of expandApprovedLeaveDays(leaves, from, toStr, new Set(recMap.keys()))) {
      leaveMap.set(`${ld.employeeId}|${ld.date}`, ld.status);
    }

    const allEmps = await storage.getEmployees({});
    const emps = (employeeId ? allEmps.filter((e: any) => e.id === employeeId) : allEmps.filter((e: any) => e.employmentStatus !== "exited"));
    const depts = await storage.getDepartments();
    const deptName = (id: string | null | undefined) => (depts as any[]).find((d) => d.id === id)?.name || "—";

    const workDays: string[] = [];
    for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
      const wd = d.getDay(); if (wd === 0 || wd === 6) continue;
      const ds = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      if (holSet.has(ds)) continue;
      workDays.push(ds);
    }
    const statusFor = (emp: any, ds: string): string | null => {
      if (emp.joinDate && ds < String(emp.joinDate).slice(0, 10)) return null; // before joining
      return recMap.get(`${emp.id}|${ds}`) || leaveMap.get(`${emp.id}|${ds}`) || "present";
    };

    if (employeeId) {
      const emp = emps[0];
      if (!emp) return res.status(404).json({ error: "Employee not found" });
      const days = workDays.map((ds) => ({ date: ds, status: statusFor(emp, ds) })).filter((x) => x.status);
      return res.json({
        mode: "individual", from, to: toStr,
        employee: { id: emp.id, code: emp.employeeCode, name: `${emp.firstName} ${emp.lastName}`, department: deptName(emp.departmentId) },
        days,
      });
    }

    const rows = emps.map((emp: any) => {
      const c: Record<string, number> = { present: 0, wfh: 0, on_duty: 0, half_day: 0, absent: 0, leave: 0, workingDays: 0 };
      for (const ds of workDays) {
        const st = statusFor(emp, ds);
        if (!st) continue;
        c.workingDays++;
        if (c[st] !== undefined) c[st]++;
      }
      const pct = c.workingDays ? Math.round(((c.present + c.wfh + c.on_duty + 0.5 * c.half_day) / c.workingDays) * 100) : 0;
      return {
        employeeId: emp.id, code: emp.employeeCode || "—", name: `${emp.firstName} ${emp.lastName}`,
        departmentId: emp.departmentId || null, department: deptName(emp.departmentId), location: emp.workLocation || null,
        present: c.present, wfh: c.wfh, onDuty: c.on_duty, halfDay: c.half_day,
        absent: c.absent, leave: c.leave, workingDays: c.workingDays, attendancePct: pct,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    res.json({ mode: "all", from, to: toStr, rows });
  });

  // Today's attendance for the whole active workforce (self-view widget). Any authenticated user can
  // see who's in / out today. Returns a minimal, non-sensitive projection + managerId so the client
  // can surface the viewer's teammates first.
  app.get("/api/attendance/today-list", requireAuth, async (req, res) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const dow = now.getDay();
    const weekend = dow === 0 || dow === 6;
    const isHoliday = (await storage.getHolidays(now.getFullYear()) as any[]).some((h) => h.date === todayStr);

    const records = visibleAttendance(await storage.getAttendanceInRange(todayStr, todayStr));
    const recMap = new Map<string, string>(records.map((r: any) => [r.employeeId, r.status]));
    const leaves = await storage.getApprovedLeavesInRange(todayStr, todayStr);
    const leaveMap = new Map<string, string>();
    for (const ld of expandApprovedLeaveDays(leaves, todayStr, todayStr, new Set(records.map((r: any) => `${r.employeeId}|${r.date}`)))) {
      leaveMap.set(ld.employeeId, ld.status);
    }
    const emps = (await storage.getEmployees({})).filter((e: any) => e.employmentStatus !== "exited");
    const depts = await storage.getDepartments();
    const deptName = (id: string | null | undefined) => (depts as any[]).find((d) => d.id === id)?.name || null;

    const list = emps.map((e: any) => {
      let status: string;
      if (e.joinDate && todayStr < String(e.joinDate).slice(0, 10)) status = "not_joined";
      else if (weekend) status = "weekend";
      else if (isHoliday) status = "holiday";
      else status = recMap.get(e.id) || leaveMap.get(e.id) || "present";
      return {
        id: e.id, firstName: e.firstName, lastName: e.lastName, employeeCode: e.employeeCode,
        avatarUrl: e.avatarUrl || null, departmentId: e.departmentId || null, department: deptName(e.departmentId),
        managerId: e.managerId || null, status,
      };
    });
    res.json(list);
  });

  // Consecutive-days streak ending today for one employee's *current* status (skips weekends/holidays
  // without breaking the run). Used on hover in the Today's Attendance list.
  app.get("/api/attendance/streak", requireAuth, async (req, res) => {
    // Others' streaks only for HR/managers; everyone else sees their own.
    const privileged = hasRole(req, "super_admin", "hr_admin", "hr_executive", "manager", "ceo_approver");
    const empId = (privileged && req.query.employeeId) ? (req.query.employeeId as string) : req.currentUser!.employeeId;
    if (!empId) return res.status(400).json({ error: "employeeId required" });
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const now = new Date();
    const start = new Date(now); start.setDate(start.getDate() - 90);
    const fromStr = fmt(start), toStr = fmt(now);

    const emp = await storage.getEmployee(empId);
    const records = visibleAttendance(await storage.getAttendanceInRange(fromStr, toStr)).filter((r: any) => r.employeeId === empId);
    const recMap = new Map<string, string>(records.map((r: any) => [r.date, r.status]));
    const leaves = await storage.getApprovedLeavesInRange(fromStr, toStr, empId);
    const leaveMap = new Map<string, string>();
    for (const ld of expandApprovedLeaveDays(leaves, fromStr, toStr, new Set(records.map((r: any) => `${r.employeeId}|${r.date}`)))) {
      leaveMap.set(ld.date, ld.status);
    }
    const holSet = new Set<string>();
    for (const yr of Array.from(new Set([start.getFullYear(), now.getFullYear()]))) {
      (await storage.getHolidays(yr) as any[]).forEach((h) => holSet.add(h.date));
    }
    const joinStr = emp?.joinDate ? String(emp.joinDate).slice(0, 10) : null;
    const statusOn = (d: Date): string | null => {
      const ds = fmt(d);
      if (joinStr && ds < joinStr) return null;
      const wd = d.getDay(); if (wd === 0 || wd === 6) return "weekend";
      if (holSet.has(ds)) return "holiday";
      return recMap.get(ds) || leaveMap.get(ds) || "present";
    };
    const todayStatus = statusOn(now);
    let days = 0;
    const cur = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let guard = 0;
    while (guard++ < 120) {
      const st = statusOn(cur);
      if (st === "weekend" || st === "holiday") { cur.setDate(cur.getDate() - 1); continue; } // skip non-working days
      if (!st || st !== todayStatus) break;
      days++;
      cur.setDate(cur.getDate() - 1);
    }
    res.json({ status: todayStatus, days });
  });

  // Unified approvals feed for the Employee-Attendance screen: Leave + WFH requests as a single
  // list per request (current status, not an event log). Pending items + decided ones, each with
  // timestamps and who decided. Super Admin / HR / CEO see everyone; a manager sees only their team.
  app.get("/api/approvals/feed", requireAuth, async (req, res) => {
    const viewer = req.currentUser!;
    const privileged = ["super_admin", "hr_admin", "hr_executive", "ceo_approver"].includes(viewer.role);
    const asManager = viewer.role === "manager" && !!viewer.employeeId;
    let teamIds: Set<string> | null = null;
    if (asManager) teamIds = new Set((await storage.getEmployeesByManager(viewer.employeeId!)).map((e) => e.id));

    const emps = await storage.getEmployees({});
    const empName = new Map<string, string>(emps.map((e: any) => [e.id, `${e.firstName} ${e.lastName}`.trim()]));
    const users = await storage.getAllUsers();
    const userName = new Map<string, string>();
    for (const u of users) userName.set(u.id, (u.employeeId && empName.get(u.employeeId)) || u.username);
    const canActFor = (empId: string) => viewer.role === "super_admin" || (asManager && teamIds!.has(empId));

    const items: any[] = [];

    // ----- Leave requests -----
    let leaveReqs: any[] = [];
    if (privileged) leaveReqs = await storage.getLeaveRequests(undefined, undefined);
    else if (asManager) leaveReqs = await storage.getTeamLeaveRequests(viewer.employeeId!);
    else if (viewer.employeeId) leaveReqs = await storage.getLeaveRequests(viewer.employeeId, undefined);
    for (const lr of leaveReqs) {
      if (!["pending", "approved", "rejected"].includes(lr.status)) continue;
      if (teamIds && !teamIds.has(lr.employeeId)) continue;
      const decided = lr.status !== "pending";
      items.push({
        id: `leave-${lr.id}`, kind: "leave", employeeId: lr.employeeId,
        employeeName: empName.get(lr.employeeId) || "Employee", status: lr.status,
        startDate: lr.startDate, endDate: lr.endDate, isHalfDay: !!lr.isHalfDay, reason: lr.reason || null,
        requestedAt: lr.createdAt || null,
        decidedAt: decided ? (lr.updatedAt || null) : null,
        decidedByName: decided && lr.approvedBy ? (userName.get(lr.approvedBy) || null) : null,
        canAct: lr.status === "pending" && canActFor(lr.employeeId),
        link: "/leave",
      });
    }

    // ----- WFH requests (recent window: last 30d .. next 7d) -----
    const pad = (n: number) => String(n).padStart(2, "0");
    const now = new Date();
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const fromD = new Date(now); fromD.setDate(fromD.getDate() - 30);
    const toD = new Date(now); toD.setDate(toD.getDate() + 7);
    const wfhRecs = await storage.getWfhInRange(fmt(fromD), fmt(toD));
    for (const r of wfhRecs as any[]) {
      if (!privileged) {
        if (asManager) { if (!teamIds!.has(r.employeeId)) continue; }
        else if (r.employeeId !== viewer.employeeId) continue;
      }
      let meta: any; try { meta = JSON.parse(r.notes || "{}"); } catch { continue; }
      if (meta.kind !== "wfh") continue;
      if (meta.rangeStart && r.date !== meta.rangeStart) continue; // one item per multi-day request
      let status = meta.approval || "pending";
      let decidedByName: string | null = meta.decidedBy && meta.decidedBy !== "auto" ? (userName.get(meta.decidedBy) || null) : (meta.decidedBy === "auto" ? "Auto-approved" : null);
      const autoDue = meta.autoApproveAt && new Date(meta.autoApproveAt) <= now;
      if (status === "pending" && autoDue) { status = "approved"; decidedByName = decidedByName || "Auto-approved"; }
      const decided = status !== "pending";
      items.push({
        id: `wfh-${r.employeeId}-${r.date}`, kind: "wfh", employeeId: r.employeeId,
        employeeName: empName.get(r.employeeId) || "Employee", status,
        startDate: r.date, endDate: meta.rangeEnd || r.date, isHalfDay: !!(meta.duration && meta.duration !== "full"), reason: meta.reason || null,
        requestedAt: meta.requestedAt || r.createdAt || null,
        decidedAt: decided ? (meta.decidedAt || null) : null,
        decidedByName: decided ? decidedByName : null,
        canAct: status === "pending" && !autoDue && canActFor(r.employeeId),
        link: "/attendance",
      });
    }

    res.json(items);
  });

  app.post("/api/attendance", requireAuth, requireHR, async (req, res) => {
    const parsed = insertAttendanceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { reason } = req.body;
    if (parsed.data.source === "admin_override" && !reason) {
      return res.status(400).json({ error: "Reason required for admin override" });
    }

    const rec = await storage.upsertAttendance({
      ...parsed.data,
      overrideBy: parsed.data.source === "admin_override" ? req.currentUser!.id : undefined,
      overrideReason: reason,
    });
    if (parsed.data.source === "admin_override") {
      await log(req, "ATTENDANCE_OVERRIDE", "attendance", rec.id, null, rec, reason);
    }
    res.json(rec);
  });

  // Self-service: mark yourself "On Duty" (out for official work) for today.
  // No approval — it just records today's status + notifies your manager. On-duty details
  // (purpose / location / expected return / remarks) are stored as JSON in `notes`.
  app.post("/api/attendance/on-duty", requireAuth, async (req, res) => {
    const empId = req.currentUser!.employeeId;
    if (!empId) return res.status(400).json({ error: "No employee record is linked to your account." });
    const { purpose, location, expectedReturn, remarks } = req.body || {};
    if (!purpose || !String(purpose).trim()) return res.status(400).json({ error: "Please choose a purpose for the on-duty trip." });
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    // If Expected Return falls on a later date, the trip spans multiple days — mark each working
    // day from today through the return date as On Duty (subsequent days show as calendar labels).
    const spanEnd = expectedReturn ? String(expectedReturn).slice(0, 10) : dateStr;
    // Cap the span so a far-off return date can't create an unbounded run of records.
    const MAX_SPAN_DAYS = 14;
    const spanCap = new Date(now.getFullYear(), now.getMonth(), now.getDate() + MAX_SPAN_DAYS);
    if (spanEnd > dateStr && new Date(`${spanEnd}T00:00:00`) > spanCap) {
      return res.status(400).json({ error: `On Duty can span at most ${MAX_SPAN_DAYS} days.` });
    }
    const meta = {
      kind: "on_duty",
      purpose: String(purpose).trim(),
      location: location ? String(location).trim() : null,
      expectedReturn: expectedReturn || null,
      remarks: remarks ? String(remarks).trim() : null,
      spanStart: dateStr,
      spanEnd: spanEnd > dateStr ? spanEnd : dateStr,
    };
    // Today's record carries the check-in time; subsequent days are markers only.
    const rec = await storage.upsertAttendance({
      employeeId: empId, date: dateStr, status: "on_duty", source: "manual",
      checkIn: now, notes: JSON.stringify(meta),
    } as any);
    if (meta.spanEnd > dateStr) {
      const cur = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(`${meta.spanEnd}T00:00:00`);
      cur.setDate(cur.getDate() + 1);
      while (cur <= end) {
        const wd = cur.getDay();
        if (wd !== 0 && wd !== 6) {
          const ds = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
          await storage.upsertAttendance({ employeeId: empId, date: ds, status: "on_duty", source: "manual", checkIn: null, notes: JSON.stringify({ ...meta, marker: true }) } as any);
        }
        cur.setDate(cur.getDate() + 1);
      }
    }
    await log(req, "MARK_ON_DUTY", "attendance", rec.id, null, rec);
    // Notify the employee's manager (best-effort).
    try {
      const emp = await storage.getEmployee(empId);
      if (emp?.managerId) {
        const nm = `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || "A team member";
        await storage.notifyEmployee(emp.managerId, {
          type: "info", title: "Team member on duty",
          body: `${nm} marked On Duty — ${meta.purpose}${meta.location ? " · " + meta.location : ""}.`,
          link: "/attendance",
        });
      }
    } catch { /* best-effort */ }
    res.json(rec);
  });

  // End an active On-Duty trip: stamp today's record as ended and drop any future span markers.
  app.post("/api/attendance/on-duty/end", requireAuth, async (req, res) => {
    const empId = req.currentUser!.employeeId;
    if (!empId) return res.status(400).json({ error: "No employee record is linked to your account." });
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const todayRec = await storage.getAttendanceByDate(empId, todayStr);
    if (todayRec?.status === "on_duty") {
      let meta: any; try { meta = JSON.parse(todayRec.notes || "{}"); } catch { meta = {}; }
      meta.endedAt = now.toISOString();
      await storage.upsertAttendance({ employeeId: empId, date: todayStr, status: "on_duty", source: todayRec.source, checkIn: todayRec.checkIn, notes: JSON.stringify(meta) } as any);
    }
    // Remove future on-duty markers of the span — sweep this month + the next two (covers the capped span).
    for (let k = 0; k < 3; k++) {
      const d = new Date(now.getFullYear(), now.getMonth() + k, 1);
      const recs = await storage.getAttendanceRecords(empId, d.getMonth() + 1, d.getFullYear());
      for (const r of recs as any[]) if (r.status === "on_duty" && r.date > todayStr) await storage.deleteAttendanceByDate(empId, r.date);
    }
    await log(req, "END_ON_DUTY", "attendance", todayRec?.id, todayRec, null);
    res.json({ ok: true });
  });

  // Self-service: request Work From Home for a day (today .. +5). Needs manager approval, but
  // auto-approves if not actioned by 24h before the WFH date. Stored as an attendance record
  // (status "wfh") whose `notes` carries the approval state.
  app.post("/api/attendance/wfh", requireAuth, async (req, res) => {
    const empId = req.currentUser!.employeeId;
    if (!empId) return res.status(400).json({ error: "No employee record is linked to your account." });
    const { date, endDate, reason, duration } = req.body || {};
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "Please pick a valid date." });
    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return res.status(400).json({ error: "Invalid end date." });
    const pad = (n: number) => String(n).padStart(2, "0");
    const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    // Max = the 5th working day (Mon–Fri) ahead of today.
    const maxD = new Date(today); let bd = 0;
    while (bd < 5) { maxD.setDate(maxD.getDate() + 1); const w = maxD.getDay(); if (w !== 0 && w !== 6) bd++; }
    const startD = parse(date);
    const endD = endDate ? parse(endDate) : startD;
    if (endD < startD) return res.status(400).json({ error: "End date can't be before the start date." });
    if (startD < today || endD > maxD) return res.status(400).json({ error: "WFH can be requested for today up to 5 working days ahead." });
    const isRange = endD > startD;
    // Working days in the range (weekends skipped).
    const days: string[] = [];
    for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
      const w = d.getDay(); if (w === 0 || w === 6) continue;
      days.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    }
    if (!days.length) return res.status(400).json({ error: "Pick at least one working day (weekends aren't allowed)." });
    // Conflict guards across every day — a holiday or an approved leave blocks the whole request.
    const holsSet = new Set<string>();
    for (const yr of Array.from(new Set(days.map((d) => parseInt(d.slice(0, 4)))))) (await storage.getHolidays(yr) as any[]).forEach((h) => holsSet.add(h.date));
    for (const ds of days) {
      if (holsSet.has(ds)) return res.status(400).json({ error: `${ds} is a public holiday.` });
      const ov = await storage.getApprovedLeavesInRange(ds, ds, empId);
      if ((ov as any[]).length) return res.status(400).json({ error: `You have approved leave on ${ds}.` });
    }
    const now = new Date();
    // Duration only applies to a single day; a range is always full days.
    const dur = isRange ? "full" : (["full", "first_half", "second_half"].includes(duration) ? duration : "full");
    let firstRec: any = null;
    for (const ds of days) {
      const autoApproveAt = new Date(parse(ds).getTime() - 24 * 60 * 60 * 1000);
      const approval = now >= autoApproveAt ? "approved" : "pending";
      const meta: any = {
        kind: "wfh", approval, duration: dur,
        reason: reason ? String(reason).trim() : null,
        requestedAt: now.toISOString(), autoApproveAt: autoApproveAt.toISOString(),
        decidedAt: approval === "approved" ? now.toISOString() : null,
        decidedBy: approval === "approved" ? "auto" : null,
      };
      if (isRange) { meta.rangeStart = days[0]; meta.rangeEnd = days[days.length - 1]; }
      const rec = await storage.upsertAttendance({ employeeId: empId, date: ds, status: "wfh", source: "manual", checkIn: null, notes: JSON.stringify(meta) } as any);
      if (!firstRec) firstRec = rec;
    }
    await log(req, "WFH_REQUEST", "attendance", firstRec?.id, null, firstRec);
    const rangeLabel = isRange ? `${days[0]} to ${days[days.length - 1]}` : days[0];
    try {
      const emp = await storage.getEmployee(empId);
      const nm = `${emp?.firstName || ""} ${emp?.lastName || ""}`.trim() || "A team member";
      if (emp?.managerId) await storage.notifyEmployee(emp.managerId, { type: "info", title: "WFH request to review", body: `${nm} requested WFH (${rangeLabel})${reason ? " — " + String(reason).trim() : ""}. Approve or reject it in Attendance.`, link: "/attendance" });
      await storage.notifyByRole(["hr_admin", "hr_executive"], { type: "info", title: "WFH request", body: `${nm} requested WFH (${rangeLabel}).`, link: "/attendance" });
    } catch { /* best-effort */ }
    res.json(firstRec);
  });

  // Manager/HR decision on a pending WFH request (identified by employee + date).
  app.patch("/api/attendance/wfh", requireAuth, async (req, res) => {
    const { employeeId, date, decision } = req.body || {};
    if (!employeeId || !date || !["approved", "rejected"].includes(decision)) return res.status(400).json({ error: "employeeId, date and a valid decision are required." });
    const viewer = req.currentUser!;
    // Only the employee's direct manager or a Super Admin can decide. HR/CEO are view-only.
    let canDecide = viewer.role === "super_admin";
    if (!canDecide && viewer.role === "manager" && viewer.employeeId) {
      const reports = await storage.getEmployeesByManager(viewer.employeeId);
      canDecide = reports.some((e) => e.id === employeeId);
    }
    if (!canDecide) return res.status(403).json({ error: "Only the employee's manager or a Super Admin can decide this request." });
    const rec = await storage.getAttendanceByDate(employeeId, date);
    if (!rec) return res.status(404).json({ error: "WFH request not found." });
    let meta: any; try { meta = JSON.parse(rec.notes || "{}"); } catch { meta = {}; }
    if (meta.kind !== "wfh") return res.status(400).json({ error: "Not a WFH request." });
    if (meta.approval !== "pending" || new Date() >= new Date(meta.autoApproveAt)) return res.status(400).json({ error: "This request can no longer be decided (already resolved or auto-approved)." });
    meta.approval = decision; meta.decidedAt = new Date().toISOString(); meta.decidedBy = viewer.id;
    const updated = await storage.upsertAttendance({ employeeId, date, status: "wfh", source: rec.source, checkIn: rec.checkIn, notes: JSON.stringify(meta) } as any);
    await log(req, "WFH_DECISION", "attendance", rec.id, rec, updated, decision);
    try {
      const empUser = (await storage.getAllUsers()).find((u) => u.employeeId === employeeId);
      if (empUser) await storage.createNotification({ userId: empUser.id, type: `wfh_${decision}`, title: `WFH ${decision}`, body: `Your WFH request for ${date} was ${decision}.`, link: "/attendance" });
    } catch { /* best-effort */ }
    res.json(updated);
  });

  // Pending WFH requests a manager/HR can act on (their team; HR = everyone). Only truly-pending
  // ones (not yet within the 24h auto-approve window) are returned.
  app.get("/api/attendance/wfh-pending", requireAuth, async (req, res) => {
    const viewer = req.currentUser!;
    // Only actionable roles get the queue: Super Admin (all) or a manager (their reports).
    if (!(viewer.role === "super_admin" || viewer.role === "manager")) return res.json([]);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const toD = new Date(today); toD.setDate(toD.getDate() + 6);
    const to = `${toD.getFullYear()}-${String(toD.getMonth() + 1).padStart(2, "0")}-${String(toD.getDate()).padStart(2, "0")}`;
    const recs = await storage.getWfhInRange(from, to);
    let allowIds: Set<string> | null = null;
    if (viewer.role === "manager" && viewer.employeeId) {
      allowIds = new Set((await storage.getEmployeesByManager(viewer.employeeId)).map((e) => e.id));
    }
    const now = new Date();
    const out: any[] = [];
    for (const r of recs) {
      let meta: any; try { meta = JSON.parse(r.notes || "{}"); } catch { continue; }
      if (meta.kind !== "wfh" || meta.approval !== "pending") continue;
      if (new Date(meta.autoApproveAt) <= now) continue; // already auto-approved
      if (allowIds && !allowIds.has(r.employeeId)) continue;
      out.push({ ...r, meta });
    }
    res.json(out);
  });

  // ===== REGULARIZATION =====
  app.get("/api/regularizations", requireAuth, async (req, res) => {
    const { employeeId, status } = req.query;
    const empId = (employeeId as string) || req.currentUser!.employeeId || undefined;
    const hrRoles = ["super_admin", "hr_admin", "hr_executive"];
    const viewer = req.currentUser!;

    if (hrRoles.includes(viewer.role)) {
      res.json(await storage.getRegularizationRequests(undefined, status as string));
    } else if (viewer.role === "manager" && viewer.employeeId) {
      const directReports = await storage.getEmployeesByManager(viewer.employeeId);
      const directReportIds = new Set(directReports.map(e => e.id));
      const all = await storage.getRegularizationRequests(undefined, status as string);
      res.json(all.filter(r => directReportIds.has(r.employeeId)));
    } else {
      // Non-HR/non-manager: own only — never a query-supplied employeeId.
      res.json(await storage.getRegularizationRequests(viewer.employeeId || undefined, status as string));
    }
  });

  app.post("/api/regularizations", requireAuth, async (req, res) => {
    const parsed = insertRegularizationSchema.safeParse({
      ...req.body,
      // Only HR may file on another employee's behalf.
      employeeId: (hasRole(req, "super_admin", "hr_admin", "hr_executive") && req.body.employeeId) ? req.body.employeeId : req.currentUser!.employeeId,
    });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const req_ = await storage.createRegularizationRequest({ ...parsed.data, status: "pending" } as any);
    try {
      const emp = await storage.getEmployee(req_.employeeId);
      const who = emp ? `${emp.firstName} ${emp.lastName}` : "An employee";
      const payload = { type: "regularization_applied", title: "Attendance Regularization", body: `${who} requested regularization for ${req_.attendanceDate}.`, link: "/attendance" };
      if (emp?.managerId) await storage.notifyEmployee(emp.managerId, payload);
      await storage.notifyByRole(["hr_admin", "hr_executive"], payload);
    } catch {}
    res.json(req_);
  });

  app.put("/api/regularizations/:id", requireAuth, async (req, res) => {
    const { status, approvalNotes } = req.body;
    const viewer = req.currentUser!;
    const managerAndAbove = ["super_admin", "hr_admin", "hr_executive", "manager", "ceo_approver"];
    if (!managerAndAbove.includes(viewer.role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const allRegs = await storage.getRegularizationRequests(undefined, undefined);
    const reg = allRegs.find(r => r.id === req.params.id);
    if (!reg) return res.status(404).json({ error: "Request not found" });

    if (viewer.role === "manager" && viewer.employeeId) {
      const directReports = await storage.getEmployeesByManager(viewer.employeeId);
      const isDirectReport = directReports.some(e => e.id === reg.employeeId);
      if (!isDirectReport) {
        return res.status(403).json({ error: "Can only approve requests from your direct reports" });
      }
    }

    const updated = await storage.updateRegularizationRequest(req.params.id, {
      status,
      approvalNotes,
      approvedBy: req.currentUser!.id,
    });

    // If approved, update attendance
    if (status === "approved" && reg) {
      await storage.upsertAttendance({
        employeeId: reg.employeeId,
        date: reg.attendanceDate,
        checkIn: reg.requestedCheckIn ?? undefined,
        checkOut: reg.requestedCheckOut ?? undefined,
        status: reg.requestedStatus || "present",
        source: "admin_override",
        overrideBy: req.currentUser!.id,
        overrideReason: `Regularization approved by ${req.currentUser!.username}`,
      });
    }

    // Notify employee of decision
    if (["approved", "rejected"].includes(status) && reg) {
      try {
        const empUser = (await storage.getAllUsers()).find(u => u.employeeId === reg.employeeId);
        if (empUser) {
          await storage.createNotification({
            userId: empUser.id,
            type: `regularization_${status}`,
            title: `Attendance Regularization ${status.charAt(0).toUpperCase() + status.slice(1)}`,
            body: `Your attendance regularization request for ${reg.attendanceDate} has been ${status}.${approvalNotes ? ` Note: ${approvalNotes}` : ""}`,
            link: "/attendance",
          });
        }
      } catch {}
    }

    res.json(updated);
  });

  // ===== LEAVE TYPES =====
}
