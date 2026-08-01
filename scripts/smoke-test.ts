/**
 * API smoke test for the backend modularization refactor.
 *
 * Boots against an already-running dev server (default http://localhost:5000),
 * authenticates via the non-prod dev-login backdoor, then records
 * `METHOD path -> status` for every GET endpoint (discovering ids from list
 * endpoints) plus a few fully-reversible write flows. Output is written to
 * scratchpad/smoke-<label>.json so a pre- and post-refactor run can be diffed
 * for exact status parity.
 *
 * Usage:  tsx scripts/smoke-test.ts <label>
 *   e.g.  tsx scripts/smoke-test.ts baseline
 *         tsx scripts/smoke-test.ts after
 */
import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";

const BASE = process.env.SMOKE_BASE || "http://localhost:5000";
const LABEL = process.argv[2] || "run";
const OUT = resolve(process.cwd(), "scratchpad", `smoke-${LABEL}.json`);
mkdirSync(dirname(OUT), { recursive: true });

let cookie = "";
const results: { key: string; status: number }[] = [];

async function req(
  method: string,
  path: string,
  body?: any,
): Promise<{ status: number; json: any }> {
  const headers: Record<string, string> = {};
  if (cookie) headers["Cookie"] = cookie;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  let json: any = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

/** Record a call's status under a stable key (path templated, no dynamic ids). */
async function check(method: string, path: string, keyOverride?: string, body?: any) {
  const { status } = await req(method, path, body);
  results.push({ key: `${method} ${keyOverride || path}`, status });
  return status;
}

/** Fetch a list endpoint and return the first row's id (or null). */
async function firstId(path: string, field = "id"): Promise<string | null> {
  const { json } = await req("GET", path);
  if (Array.isArray(json) && json.length && json[0]?.[field]) return json[0][field];
  return null;
}

async function main() {
  // ---- Auth ----
  const login = await req("POST", "/api/auth/login", {
    username: "superadmin",
    password: "admin123",
  }).catch(() => ({ status: 0, json: null }));
  if (login.status !== 200) {
    // Fall back to the dev-login backdoor (any email + password "password").
    const dev = await req("POST", "/api/auth/dev-login", {
      email: "superadmin",
      password: "password",
    });
    if (dev.status !== 200) {
      console.error("AUTH FAILED", dev.status, dev.json);
      process.exit(1);
    }
  }
  results.push({ key: "POST /api/auth/login-or-dev", status: 200 });

  // ---- Simple GETs (no params) ----
  const simpleGets = [
    "/api/health",
    "/api/auth/me",
    "/api/employees",
    "/api/employees/me",
    "/api/departments",
    "/api/designations",
    "/api/attendance",
    "/api/attendance/month?month=7&year=2026",
    "/api/attendance/range?start=2026-07-01&end=2026-07-31",
    "/api/attendance/wfh-pending",
    "/api/regularizations",
    "/api/leave-types",
    "/api/leave-balances",
    "/api/leave-requests",
    "/api/leave-ledger",
    "/api/holidays",
    "/api/payroll-runs",
    "/api/payslips/me",
    "/api/statutory-config",
    "/api/announcements",
    "/api/assets",
    "/api/audit-logs",
    "/api/dashboard/stats",
    "/api/users",
    "/api/workspace/users",
    "/api/performance/rating-scales",
    "/api/performance/cycles",
    "/api/notifications",
    "/api/notifications/unread-count",
    "/api/shifts",
    "/api/shift-assignments",
    "/api/onboarding/templates",
    "/api/onboarding/instances",
    "/api/workspace/approvals/pending",
    "/api/workspace/agencies",
    "/api/workspace/pipeline-stages",
    "/api/workspace/requisitions",
    "/api/workspace/candidates",
    "/api/workspace/applications",
    "/api/workspace/interviews",
    "/api/workspace/offers",
    "/api/workspace/vendors",
    "/api/workspace/purchase-requests",
    "/api/workspace/travel-requests",
    "/api/workspace/payments",
    "/api/workspace/tickets",
    "/api/workspace/hr-tasks",
    "/api/my-requests/summary",
    "/api/my-requests/purchases",
    "/api/my-requests/travels",
    "/api/my-requests/tickets",
    "/api/team-requests",
    "/api/logistics/locations",
    "/api/logistics/movements",
    "/api/vehicles",
    "/api/vehicles/bookings",
    "/api/reimbursements",
    "/api/reimbursements/context",
    "/api/requests",
    "/api/approval-notes",
    "/api/reference-docs",
    "/api/zoho/config",
    "/api/zoho/jobs",
  ];
  for (const p of simpleGets) await check("GET", p);

  // ---- Param GETs (discover ids from list endpoints) ----
  const empId = await firstId("/api/employees");
  if (empId) {
    await check("GET", `/api/employees/${empId}`, "/api/employees/:id");
    await check("GET", `/api/employees/${empId}/salary`, "/api/employees/:id/salary");
    await check("GET", `/api/employees/${empId}/history`, "/api/employees/:id/history");
    await check("GET", `/api/payslips/employee/${empId}`, "/api/payslips/employee/:id");
  }
  const runId = await firstId("/api/payroll-runs");
  if (runId) await check("GET", `/api/payroll-runs/${runId}/payslips`, "/api/payroll-runs/:id/payslips");

  const cycleId = await firstId("/api/performance/cycles");
  if (cycleId) {
    await check("GET", `/api/performance/cycles/${cycleId}`, "/api/performance/cycles/:id");
    await check("GET", `/api/performance/goals?cycleId=${cycleId}`, "/api/performance/goals");
    await check("GET", `/api/performance/reviews/${cycleId}`, "/api/performance/reviews/:cycleId");
    await check("GET", `/api/performance/calibration/${cycleId}`, "/api/performance/calibration/:cycleId");
    await check("GET", `/api/performance/reports/distribution/${cycleId}`, "/api/performance/reports/distribution/:cycleId");
  }
  const reqId = await firstId("/api/requests");
  if (reqId) {
    await check("GET", `/api/requests/${reqId}`, "/api/requests/:id");
    await check("GET", `/api/requests/${reqId}/comments`, "/api/requests/:id/comments");
  }
  const movId = await firstId("/api/logistics/movements");
  if (movId) {
    await check("GET", `/api/logistics/movements/${movId}`, "/api/logistics/movements/:id");
    await check("GET", `/api/logistics/movements/${movId}/events`, "/api/logistics/movements/:id/events");
  }
  const reimbId = await firstId("/api/reimbursements");
  if (reimbId) await check("GET", `/api/reimbursements/${reimbId}`, "/api/reimbursements/:id");
  const noteId = await firstId("/api/approval-notes");
  if (noteId) await check("GET", `/api/approval-notes/${noteId}`, "/api/approval-notes/:id");
  const reqsId = await firstId("/api/workspace/requisitions");
  if (reqsId) await check("GET", `/api/workspace/requisitions/${reqsId}`, "/api/workspace/requisitions/:id");
  const candId = await firstId("/api/workspace/candidates");
  if (candId) await check("GET", `/api/workspace/candidates/${candId}`, "/api/workspace/candidates/:id");

  // ---- Reversible write flows (representative "safe writes") ----
  // 1) idempotent notification read-all
  await check("PUT", "/api/notifications/read-all");
  // 2) announcement create -> delete (fully reversible)
  const createAnn = await req("POST", "/api/announcements", {
    title: "SMOKE TEST — delete me",
    content: "temporary smoke-test announcement",
    category: "general",
    priority: "normal",
    visibleTo: "all",
  });
  results.push({ key: "POST /api/announcements", status: createAnn.status });
  const annId = createAnn.json?.id;
  if (annId) {
    await check("DELETE", `/api/announcements/${annId}`, "/api/announcements/:id");
  }
  // 3) dev-role switch + reset (reversible session-only change)
  await check("POST", "/api/auth/dev-role", "/api/auth/dev-role[set]", { role: "employee" });
  await check("POST", "/api/auth/dev-role", "/api/auth/dev-role[reset]", { role: "super_admin" });

  // ---- Persist ----
  results.sort((a, b) => a.key.localeCompare(b.key));
  writeFileSync(OUT, JSON.stringify(results, null, 2));
  const bad = results.filter((r) => r.status >= 500 || r.status === 0);
  console.log(`Smoke '${LABEL}': ${results.length} calls, ${bad.length} server-errors(>=500).`);
  if (bad.length) console.log("5xx/errors:", JSON.stringify(bad, null, 2));
  console.log(`Wrote ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
