import { ShoppingCart, Car, TicketIcon, Receipt } from "lucide-react";
import { format } from "date-fns";
import { money, formatDate as fmtDate } from "@/lib/format";
export { money, fmtDate };

// Formatting and derivation for the approval surfaces: resubmission detection,
// priority banding, category tinting, date-range filtering, and the service catalog list.
// ---- helpers ----
export const cap = (s?: string) => (s ? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "");



// A re-submitted claim relabels "Submitted on" → "Re-submitted On"; the original creation date shows on hover.
// An office/procurement item is "resubmitted" when the latest query/resubmit marker in its thread is a resubmit (HR answered the CEO's query).
export const isResubmittedThread = (comments: any) => { const m = ((comments || []) as any[]).filter((c: any) => c.kind === "query" || c.kind === "resubmitted"); return m.length > 0 && m[m.length - 1].kind === "resubmitted"; };

export const reimbSubmittedInfo = (r: any): { label: string; date: any; resubmitted: boolean; originalDate?: any } => {
  try { const p = JSON.parse(r?.notes || "{}"); if (p && p.kind === "resubmitted_diff") return { label: "Re-submitted On", date: p.at || r.updatedAt || r.createdAt, resubmitted: true, originalDate: r.createdAt }; } catch { /* not JSON */ }
  return { label: "Submitted on", date: r?.createdAt, resubmitted: false };
};

// Shared day-range filter used across approver lists. A blank range passes everything.
export const dayInRange = (d: any, range: { from?: Date; to?: Date }) => {
  if (!range.from && !range.to) return true;
  if (!d) return false;
  const day = format(new Date(d), "yyyy-MM-dd");
  if (range.from && day < format(range.from, "yyyy-MM-dd")) return false;
  if (range.to && day > format(range.to, "yyyy-MM-dd")) return false;
  return true;
};

export const rangeSuffix = (range: { from?: Date; to?: Date }) =>
  range.from || range.to ? ` (${range.from ? format(range.from, "MMM d") : "…"} to ${range.to ? format(range.to, "MMM d, yyyy") : "…"})` : "";

// ===================== Office Purchase approvals (HR triage + CEO approval) =====================
export const OP_PRIORITY: Record<string, { label: string; cls: string }> = {
  high: { label: "High", cls: "bg-[#FF6F62]/15 text-[#FF6F62]" },
  medium: { label: "Medium", cls: "bg-[#206295]/15 text-[#206295]" },
  low: { label: "Low", cls: "bg-[#64748B]/15 text-[#64748B]" },
};

// Read-only history of decided items across the categories this user approves.
export const reimbPriority = (amt: number) =>
  amt >= 50000 ? { label: "High", cls: "bg-[#FF6F62]/15 text-[#FF6F62]" }
  : amt >= 10000 ? { label: "Medium", cls: "bg-[#206295]/15 text-[#206295]" }
  : { label: "Low", cls: "bg-[#64748B]/15 text-[#64748B]" };

// Category badge colors drawn from the brand palette (deterministic per category).
export const CAT_PALETTE = ["#206295", "#0E7C7B", "#425B8D", "#64748B"];

export const catStyle = (cat: string) => { const c = CAT_PALETTE[Math.abs([...(cat || "?")].reduce((a, ch) => a + ch.charCodeAt(0), 0)) % CAT_PALETTE.length]; return { color: c, backgroundColor: `${c}1f` }; };

export const LIST_PAGE_SIZE = 15;

export const REIMB_PAGE_SIZE = 15;

export const SERVICES = [
  { key: "purchase", title: "Purchase Request", desc: "Request equipment, supplies, or any business purchase", icon: ShoppingCart, color: "bg-[#4BDCD9]/25 text-[#206295]" },
  { key: "travel", title: "Travel Request", desc: "Plan business travel — flights, stays, transport", icon: Car, color: "bg-[#206295]/15 text-[#206295]" },
  { key: "ticket", title: "Support Ticket", desc: "Get help with IT, repairs, stationery, access & more", icon: TicketIcon, color: "bg-[#4BDCD9]/25 text-[#206295]" },
  { key: "reimbursement", title: "Reimbursement", desc: "Claim expenses with invoice details and track approval", icon: Receipt, color: "bg-[#FF6F62]/20 text-[#FF6F62]" },
] as const;
