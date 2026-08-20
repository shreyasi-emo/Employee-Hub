// The single list of Support Ticket categories. Every ticket form reads this one array —
// the employee forms on Company Workspace and My Requests, and the HR Ops helpdesk form.
//
// It used to be three hard-coded copies with three different vocabularies, so the same
// issue filed under different labels depending on which screen raised it. `attendance` and
// `office_admin` came from the HR Ops list; `office_repairs` and `guest_access` from the
// employee list; they are now all available everywhere.
//
// Deliberately NO "stationery" — asking for supplies is a Purchase Request
// (Company Workspace -> Purchase Request -> Office Purchase), not a support ticket.
//
// Category is display-only: nothing routes, escalates or SLA-tracks on it, so tickets
// saved under a since-retired category still render fine via `cap()`.
export const TICKET_CATEGORIES = [
  "hr_query",
  "payroll",
  "leave",
  "attendance",
  "it_support",
  "office_repairs",
  "office_admin",
  "guest_access",
  "other",
] as const;
