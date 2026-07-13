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

export function startScheduler() {
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
