// Attendance xlsx builders. Kept out of the views so the report shapes live in one
// place; each returns/throws so the caller owns the toast.

import { format } from "date-fns";
import { exportXlsx } from "@/lib/export-xlsx";
import { apiRequest } from "@/lib/queryClient";
import { STATUS_DISPLAY } from "./attendance-states";

/** All-employee summary for a date range, computed server-side. */
export async function downloadAllEmployeesReport(from: string, to: string) {
  const data: any = await apiRequest("GET", `/api/attendance/report?from=${from}&to=${to}`);
  const headers = ["Employee Code", "Name", "Department", "Present (WFO)", "WFH", "On Duty", "Half Day", "Absent", "On Leave", "Working Days", "Attendance %"];
  const rows = (data.rows || []).map((r: any) => [r.code, r.name, r.department, r.present, r.wfh, r.onDuty, r.halfDay, r.absent, r.leave, r.workingDays, `${r.attendancePct}%`]);
  exportXlsx({ filename: `attendance-report-${from}_to_${to}.xlsx`, sheet: "Report", title: `Attendance Report — ${from} to ${to}`, headers, rows });
}

/** One employee's day-by-day sheet plus summary totals at the bottom. */
export async function downloadEmployeeReport(empId: string, name: string, from: string, to: string) {
  const data: any = await apiRequest("GET", `/api/attendance/report?from=${from}&to=${to}&employeeId=${empId}`);
  const days: any[] = data.days || [];
  const headers = ["Date", "Day", "Status"];
  const rows: (string | number)[][] = days.map((d: any) => {
    const dt = new Date(`${d.date}T00:00:00`);
    return [format(dt, "dd MMM yyyy"), format(dt, "EEE"), STATUS_DISPLAY[d.status] || "Present (WFO)"];
  });
  // Summary totals at the bottom of the sheet.
  const workingDays = days.length;
  const presentCount = days.filter((d) => ["present", "wfh", "on_duty"].includes(d.status)).length;
  const halfCount = days.filter((d) => d.status === "half_day").length;
  const absentCount = days.filter((d) => d.status === "absent").length;
  const leaveCount = days.filter((d) => d.status === "leave").length;
  const pct = workingDays ? Math.round(((presentCount + 0.5 * halfCount) / workingDays) * 100) : 0;
  rows.push(["", "", ""]);
  rows.push(["Summary", "", ""]);
  rows.push(["Attendance %", `${pct}%`]);
  rows.push(["Present / Working Days", `${presentCount} / ${workingDays}`]);
  rows.push(["Total Present", presentCount]);
  rows.push(["Total Not Present (Leave / Absent)", leaveCount + absentCount]);
  rows.push(["Half Days", halfCount]);
  const label = from === to
    ? format(new Date(`${from}T00:00:00`), "dd MMM yyyy")
    : `${format(new Date(`${from}T00:00:00`), "dd MMM")} – ${format(new Date(`${to}T00:00:00`), "dd MMM yyyy")}`;
  exportXlsx({ filename: `attendance-${name.replace(/\s+/g, "-")}-${from}_to_${to}.xlsx`, sheet: "Attendance", title: `${name} — ${label}`, headers, rows });
}
