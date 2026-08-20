// The single list of Support Ticket categories, so the employee-facing ticket forms
// cannot drift apart (they did: two copies, both carrying "stationery").
//
// Deliberately NO "stationery" — asking for supplies is a Purchase Request
// (Company Workspace → Purchase Request → Office Purchase), not a support ticket.
// Category is display-only: nothing routes, escalates or SLA-tracks on it, so older
// tickets saved under a retired category still render fine via `cap()`.
export const TICKET_CATEGORIES = [
  "hr_query",
  "office_repairs",
  "guest_access",
  "it_support",
  "payroll",
  "leave",
  "other",
] as const;
