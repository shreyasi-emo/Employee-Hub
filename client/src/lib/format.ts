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

// Title-case a label (category, type, etc.) but keep common acronyms upper-cased — so "hr" → "HR"
// and "it" → "IT" instead of the wrong "Hr"/"It". Handles multi-word / underscored / hyphenated input.
const LABEL_ACRONYMS = new Set(["hr", "it", "ceo", "cto", "hod", "pf", "esi", "uan", "pan", "ifsc", "id", "qa", "ui", "ux", "hrms", "hris"]);
export const prettyLabel = (s?: string | null): string =>
  (s ?? "").split(/[\s_/-]+/).filter(Boolean)
    .map((w) => (LABEL_ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");

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

/** Relative, scan-friendly date for approval lists: "just now" / "12m ago" / "3h ago" /
 *  "Yesterday" / "4d ago" / "12 Sep". Feed it updatedAt so a just-touched item reads "just now". */
export const relDate = (d?: string | number | Date | null) => {
  if (!d) return "—";
  const t = new Date(d).getTime();
  if (isNaN(t)) return "—";
  const min = (Date.now() - t) / 60000;
  if (min < 0) return "just now";
  if (min < 2) return "just now";
  if (min < 60) return `${Math.floor(min)}m ago`;
  const dayStart = (x: number) => { const dt = new Date(x); dt.setHours(0, 0, 0, 0); return dt.getTime(); };
  const days = Math.round((dayStart(Date.now()) - dayStart(t)) / 86400000);
  if (days <= 0) return `${Math.floor(min / 60)}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return format(new Date(t), "d MMM");
};

/** True when the date falls on the local calendar's today — for a "Today" quick filter. */
export const isToday = (d?: string | number | Date | null) => {
  if (!d) return false;
  const t = new Date(d); if (isNaN(t.getTime())) return false;
  const n = new Date();
  return t.getFullYear() === n.getFullYear() && t.getMonth() === n.getMonth() && t.getDate() === n.getDate();
};

/** True for the first few minutes after a change — drives the "just updated" highlight. */
export const isJustUpdated = (d?: string | number | Date | null) => {
  if (!d) return false;
  const t = new Date(d).getTime();
  return !isNaN(t) && Date.now() - t < 3 * 60000;
};

/** snake_case -> spaced words, for raw status strings. */
export const formatStatus = (s: string) => s?.replace(/_/g, " ") || "";

/** Two-letter initials from a first/last name pair. */
export const initials = (first?: string, last?: string) =>
  `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";
