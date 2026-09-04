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

/** Compact Indian rupees (₹31.2K / ₹1.2L / ₹1.2Cr) — headline stats on narrow / mobile cards
 *  where the full amount would clip. Falls back to the full number below ₹1,000. */
export const moneyShort = (n: any) => {
  const v = Number(n || 0);
  const a = Math.abs(v);
  const trim = (x: number) => (x % 1 === 0 ? x.toFixed(0) : x.toFixed(1));
  if (a >= 1e7) return `₹${trim(v / 1e7)}Cr`;
  if (a >= 1e5) return `₹${trim(v / 1e5)}L`;
  if (a >= 1e3) return `₹${trim(v / 1e3)}K`;
  return `₹${v.toLocaleString("en-IN")}`;
};

/** "MMM d, yyyy", or "" when the date is missing or unparseable. */
export const formatDate = (d?: string | null) => {
  try { return d ? format(new Date(d), "MMM d, yyyy") : ""; } catch { return ""; }
};

/** snake_case -> spaced words, for raw status strings. */
export const formatStatus = (s: string) => s?.replace(/_/g, " ") || "";

/** Two-letter initials from a first/last name pair. */
export const initials = (first?: string, last?: string) =>
  `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";
