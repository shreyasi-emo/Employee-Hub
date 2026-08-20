import { formatStatus } from "./request-format";
import { ShoppingCart, Car, TicketIcon, Receipt, Package, Save } from "lucide-react";

// "Save to drafts" is localStorage-only — there is no drafts API.
// ---- Local drafts store (per-browser; not submitted to the server until "Submit") ----
export const DRAFTS_KEY = "emo:my-requests:drafts";

export type Draft = { id: string; type: string; data: any; savedAt: number };

export function readDrafts(): Draft[] { try { return JSON.parse(localStorage.getItem(DRAFTS_KEY) || "[]"); } catch { return []; } }

export function writeDrafts(d: Draft[]): boolean { try { localStorage.setItem(DRAFTS_KEY, JSON.stringify(d)); return true; } catch { return false; } }

export const newDraftId = () => `dft_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;

/** Add one new draft to the front of the store. Returns false if localStorage is full.
 *  For screens that only ever create drafts (Company Workspace); My Requests has its own
 *  version that can also overwrite the draft currently being edited. */
export function appendDraft(type: string, data: any): boolean {
  return writeDrafts([{ id: newDraftId(), type, data, savedAt: Date.now() }, ...readDrafts()]);
}

export const DRAFT_META: Record<string, { label: string; icon: any }> = {
  office: { label: "Office Purchase", icon: ShoppingCart },
  procurement: { label: "Procurement", icon: Package },
  trip: { label: "Travel", icon: Car },
  purchase: { label: "Purchase", icon: ShoppingCart },
  travel: { label: "Travel", icon: Car },
  ticket: { label: "Ticket", icon: TicketIcon },
  reimbursement: { label: "Reimbursement", icon: Receipt },
};

export const draftTitle = (d: Draft): string => {
  const x = d.data || {};
  if (d.type === "trip") return x.purpose || `${(x.category || "Travel")[0].toUpperCase()}${(x.category || "ravel").slice(1)} request`;
  if (d.type === "office" || d.type === "procurement") { const it = (x.items || [])[0]; return it?.description ? `${it.description}${x.items.length > 1 ? ` +${x.items.length - 1}` : ""}` : (d.type === "procurement" ? "Procurement" : "Office Purchase"); }
  if (d.type === "purchase") return `${formatStatus(x.category) || "Purchase"} Request`;
  if (d.type === "travel") return x.purpose || `${x.fromCity || "?"} → ${x.toCity || "?"}`;
  if (d.type === "ticket") return x.subject || "Support Ticket";
  return x.businessPurpose || "Reimbursement";
};

export const draftAmount = (d: Draft): number => {
  const x = d.data || {};
  if (d.type === "office" || d.type === "procurement") return (x.items || []).reduce((s: number, i: any) => s + (Number(i.unitPrice) || 0) * (Number(i.quantity) || 0), 0);
  if (d.type === "purchase") return (x.items || []).reduce((s: number, i: any) => s + (Number(i.estimatedCost) || 0), 0);
  if (d.type === "travel") return Number(x.estimatedBudget) || 0;
  if (d.type === "reimbursement") return (x.items || []).reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
  return 0;
};
