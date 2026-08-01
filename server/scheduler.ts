import cron from "node-cron";
import { storage } from "./storage";
import { processZohoSyncJobs } from "./zoho";

async function accrueMonthlyLeave() {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const leaveTypesList = await storage.getLeaveTypes();
    const employees = await storage.getEmployees({ status: "active" });

    for (const emp of employees) {
      for (const lt of leaveTypesList) {
        if (!lt.maxDaysPerYear || lt.maxDaysPerYear <= 0) continue;
        const monthlyAccrual = parseFloat((lt.maxDaysPerYear / 12).toFixed(1));
        const existing = await storage.getLeaveBalance(emp.id, lt.id, year);
        const currentAccrued = parseFloat(existing?.accrued ?? "0");
        const currentTaken = parseFloat(existing?.taken ?? "0");
        const currentAdjusted = parseFloat(existing?.adjusted ?? "0");
        const openingBalance = parseFloat(existing?.openingBalance ?? "0");
        const newAccrued = parseFloat((currentAccrued + monthlyAccrual).toFixed(1));
        const newClosing = parseFloat((openingBalance + newAccrued - currentTaken + currentAdjusted).toFixed(1));
        await storage.upsertLeaveBalance({
          employeeId: emp.id,
          leaveTypeId: lt.id,
          year,
          openingBalance: (existing?.openingBalance ?? "0") as any,
          accrued: newAccrued as any,
          taken: (existing?.taken ?? "0") as any,
          adjusted: (existing?.adjusted ?? "0") as any,
          closingBalance: newClosing as any,
        });
      }
    }
    console.log(`[Scheduler] Monthly leave accrual completed for ${employees.length} employees`);
  } catch (err) {
    console.error("[Scheduler] Leave accrual error:", err);
  }
}

// Daily: birthday & work-anniversary notifications. Names are wrapped in
// parentheses so the client can resolve the celebrant's DP avatar.
export async function dailyPeopleNotifications() {
  try {
    const employees = await storage.getEmployees({ status: "active" });
    const allUsers = (await storage.getAllUsers()).filter((u: any) => u.isActive);
    const today = new Date();
    const mm = today.getMonth(), dd = today.getDate();
    let count = 0;
    for (const emp of employees) {
      const name = `${emp.firstName} ${emp.lastName}`;
      if (emp.dateOfBirth) {
        const d = new Date(emp.dateOfBirth);
        if (d.getMonth() === mm && d.getDate() === dd) {
          for (const u of allUsers) {
            const self = u.employeeId === emp.id;
            await storage.notifyUser(u.id, {
              type: "birthday",
              title: self ? "Happy Birthday! 🎂" : "Birthday Today",
              body: self ? `Wishing you a wonderful birthday, ${emp.firstName}!` : `It's (${name})'s birthday today!`,
              link: "/employees",
            });
            count++;
          }
        }
      }
      if (emp.joinDate) {
        const j = new Date(emp.joinDate);
        const years = today.getFullYear() - j.getFullYear();
        if (j.getMonth() === mm && j.getDate() === dd && years >= 1) {
          for (const u of allUsers) {
            const self = u.employeeId === emp.id;
            await storage.notifyUser(u.id, {
              type: "work_anniversary",
              title: self ? "Work Anniversary! 🎉" : "Work Anniversary",
              body: self ? `Congratulations on ${years} year${years !== 1 ? "s" : ""} with us, ${emp.firstName}!` : `(${name}) completes ${years} year${years !== 1 ? "s" : ""} today.`,
              link: "/employees",
            });
            count++;
          }
        }
      }
    }
    console.log(`[Scheduler] People notifications processed (${count} sent)`);
    return count;
  } catch (err) {
    console.error("[Scheduler] People notifications error:", err);
    return 0;
  }
}

// Auto-approve requests the manager hasn't actioned by 24h before the date (mirrors the
// employee-facing rule). Runs on a short interval so approvals never sit stale.
export async function autoApproveOverdue() {
  const now = new Date();
  const cutoff = now.getTime() + 24 * 60 * 60 * 1000; // "within 24h of the date"
  // ---- Leaves: pending → approved (deduct balance) ----
  try {
    const pending = await storage.getLeaveRequests(undefined, "pending");
    for (const lr of pending as any[]) {
      const startMs = new Date(`${lr.startDate}T00:00:00`).getTime();
      if (startMs > cutoff) continue; // still more than 24h away
      if (!(await storage.isLeaveBalanceSufficient(lr))) continue; // never auto-approve into a negative paid balance
      await storage.updateLeaveRequest(lr.id, { status: "approved" as any, approvalNotes: "Auto-approved (no manager action within 24h)" });
      await storage.deductLeaveOnApproval(lr);
      try {
        const emp = await storage.getEmployee(lr.employeeId);
        const u = emp ? (await storage.getAllUsers()).find((x: any) => x.employeeId === emp.id) : null;
        if (u) await storage.createNotification({ userId: u.id, type: "leave_approved", title: "Leave auto-approved", body: `Your leave from ${lr.startDate} to ${lr.endDate} was auto-approved (no manager action within 24h).`, link: "/leave" });
      } catch { /* best-effort */ }
    }
  } catch (err) { console.error("[Scheduler] Leave auto-approve error:", err); }

  // ---- WFH: pending attendance records → approved ----
  try {
    const pad = (n: number) => String(n).padStart(2, "0");
    const d0 = new Date(now); const from = `${d0.getFullYear()}-${pad(d0.getMonth() + 1)}-${pad(d0.getDate())}`;
    const d1 = new Date(now); d1.setDate(d1.getDate() + 7); const to = `${d1.getFullYear()}-${pad(d1.getMonth() + 1)}-${pad(d1.getDate())}`;
    const recs = await storage.getWfhInRange(from, to);
    for (const r of recs as any[]) {
      let meta: any; try { meta = JSON.parse(r.notes || "{}"); } catch { continue; }
      if (meta.kind !== "wfh" || meta.approval !== "pending") continue;
      if (!meta.autoApproveAt || new Date(meta.autoApproveAt).getTime() > now.getTime()) continue;
      meta.approval = "approved"; meta.decidedAt = now.toISOString(); meta.decidedBy = "auto";
      await storage.upsertAttendance({ employeeId: r.employeeId, date: r.date, status: "wfh", source: r.source, checkIn: r.checkIn, notes: JSON.stringify(meta) } as any);
      try {
        const u = (await storage.getAllUsers()).find((x: any) => x.employeeId === r.employeeId);
        if (u) await storage.createNotification({ userId: u.id, type: "wfh_approved", title: "WFH auto-approved", body: `Your WFH request for ${r.date} was auto-approved (no manager action within 24h).`, link: "/attendance" });
      } catch { /* best-effort */ }
    }
  } catch (err) { console.error("[Scheduler] WFH auto-approve error:", err); }
}

export function startScheduler() {
  // Auto-approve overdue WFH/Leave — every 15 minutes (IST, matching the rest of the schedule).
  cron.schedule("*/15 * * * *", async () => { try { await autoApproveOverdue(); } catch (e) { console.error("[Scheduler] auto-approve error:", e); } }, { timezone: "Asia/Kolkata" });
  console.log("[Scheduler] Auto-approve (WFH/Leave 24h) cron registered (every 15 min)");

  // Birthdays & anniversaries — every day at 8:00 AM IST
  cron.schedule("0 8 * * *", dailyPeopleNotifications, { timezone: "Asia/Kolkata" });
  console.log("[Scheduler] Daily birthday/anniversary cron registered (08:00 IST)");

  cron.schedule("0 0 1 * *", accrueMonthlyLeave, { timezone: "Asia/Kolkata" });
  console.log("[Scheduler] Monthly leave accrual cron registered (runs 1st of each month)");

  // Zoho Books push — drains queued sync jobs every 2 minutes (no-op if disabled)
  cron.schedule("*/2 * * * *", async () => {
    try { await processZohoSyncJobs(); } catch (e) { console.error("[Scheduler] Zoho drain error:", e); }
  });
  console.log("[Scheduler] Zoho sync cron registered (every 2 minutes)");
}
