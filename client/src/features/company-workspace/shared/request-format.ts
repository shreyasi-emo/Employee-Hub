import { format } from "date-fns";
import { money, moneyPrecise as money2, formatDate, formatStatus } from "@/lib/format";
export { money, money2, formatDate, formatStatus };

// Per-request-type accessors and the status vocabulary shared across the request
// screens: what a row's title/subtitle/amount/reference is, and which states count
// as approved, rejected, done or still revocable.




// Status filter buckets for the My Requests dropdown.
export const APPROVED_STATES = ["approved", "fulfilled", "completed", "booked", "confirmed", "done", "resolved", "delivered"];

export const REJECTED_STATES = ["rejected", "cancelled", "closed"];

export function matchesFilter(status: string, filter: string) {
  if (filter === "all") return true;
  if (filter === "approved") return APPROVED_STATES.includes(status);
  if (filter === "rejected") return REJECTED_STATES.includes(status);
  // pending = anything still in flight (not approved, not rejected/closed)
  return !APPROVED_STATES.includes(status) && !REJECTED_STATES.includes(status);
}

export const REVOCABLE_BLOCK = ["approved", "rejected", "cancelled", "fulfilled", "completed", "ordered", "booked", "resolved", "done", "closed"];

// ---- accessors shared by table view, search & sort ----
export const amountOf = (type: string, it: any): number =>
  type === "purchase" ? Number(it.estimatedCost) || 0
  : type === "travel" ? Number(it.estimatedBudget) || 0
  : type === "reimbursement" ? Number(it.totalAmount) || 0
  : 0;

export const titleOf = (type: string, it: any): string =>
  type === "purchase" ? `${formatStatus(it.category) || "Purchase"} Request`
  : type === "travel" ? `${it.fromCity || "?"} → ${it.toCity || "?"}`
  : type === "ticket" ? (it.subject || "Ticket")
  : (it.reference || "Reimbursement");

export const subOf = (type: string, it: any): string =>
  type === "purchase" ? (it.notes || "")
  : type === "travel" ? (it.purpose || "")
  : type === "ticket" ? formatStatus(it.category)
  : (it.businessPurpose || it.category || "");

export const searchText = (type: string, it: any): string =>
  [titleOf(type, it), subOf(type, it), it.status, it.reference].filter(Boolean).join(" ").toLowerCase();

// First item's description as a compact headline, e.g. "Mouse +1 more" (mirrors the office/procurement card title).
export const itemsHeadline = (items: any[]): string => {
  const l = Array.isArray(items) ? items : [];
  return l.length ? `${l[0]?.description || "Item"}${l.length > 1 ? ` +${l.length - 1} more` : ""}` : "—";
};

export const purposeOf = (type: string, it: any): string =>
  type === "purchase" ? (it.notes || "")
  : type === "travel" ? (it.purpose || "")
  : type === "ticket" ? (it.description || "")
  : (it.businessPurpose || "");

export const REF_PREFIX: Record<string, string> = { purchase: "PRC", travel: "TRV", ticket: "TKT", reimbursement: "RMB" };

// Display reference — uses the stored reference (reimbursements) or a stable code derived from the id.
export const refOf = (type: string, it: any): string =>
  it.reference || `${REF_PREFIX[type] || "REQ"}-${String(it.id || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase()}`;

export const DONE_STATUS: Record<string, string[]> = {
  office: ["delivered", "rejected", "cancelled"],
  procurement: ["approved", "rejected", "cancelled"],
  trip: ["booked", "rejected", "cancelled"],
};

export const CR_PAGE_SIZE = 15;
