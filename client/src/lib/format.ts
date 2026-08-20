// App-wide value formatting. These were previously re-declared in a dozen files;
// this is the single source of truth.
//
// NOTE: three near-identical variants were deliberately NOT folded in here because
// they behave differently on unparseable input, and changing that would be a
// behaviour change rather than a refactor:
//   - features/requests/reimbursements/components/reimbursement-form.tsx  `(Number(n) || 0)`
//   - features/requests/reimbursements/pages/reimbursements-page.tsx      `parseFloat(v || "0")`
//   - features/requests/reimbursements/components/reimbursement-approval-detail.tsx
//     `fmtDate` (renders "dd MMM yyyy" and "—" for empty, not "MMM d, yyyy" and "")
// Each is commented at its definition.

import { format } from "date-fns";

/** Rupees, no decimals — the default for amounts across the request screens. */
export const money = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

/** Rupees with exactly two decimals — invoice lines and per-line totals. */
export const moneyPrecise = (n: any) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "MMM d, yyyy", or "" when the date is missing or unparseable. */
export const formatDate = (d?: string | null) => {
  try { return d ? format(new Date(d), "MMM d, yyyy") : ""; } catch { return ""; }
};

/** snake_case -> spaced words, for raw status strings. */
export const formatStatus = (s: string) => s?.replace(/_/g, " ") || "";

/** Two-letter initials from a first/last name pair. */
export const initials = (first?: string, last?: string) =>
  `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";
