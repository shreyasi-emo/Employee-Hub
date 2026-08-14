import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { usePaged, PaginationBar } from "@/components/pagination";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NewRequestDialog, OfficePurchaseDetailDialog } from "@/components/office-purchase";
import { NewTravelDialog, TravelDetailDialog, TRAVEL_CATS } from "@/components/travel";
import { ProcurementDetailDialog } from "@/components/procurement";
import { useToast } from "@/hooks/use-toast";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { DateInput } from "@/components/datetime-field";
import {
  Plus, ShoppingCart, Car, TicketIcon, Send, Receipt, ChevronLeft, ChevronRight, Package,
  MessageSquare, ChevronDown, ChevronUp, Trash2, FileText,
  CheckCircle2, CircleDot, CircleDashed, XCircle, Ban, History, AlertTriangle,
  Search, LayoutGrid, Table2, ArrowDownUp, MoreVertical, Eye, CalendarClock, Copy,
  Save, Pencil, FileEdit,
} from "lucide-react";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ReimbursementFormDialog, reimbDraftComplete } from "@/components/reimbursement-form";
import { StatusBadge } from "./reimbursements";
import { statusClass, statusLabel } from "@/lib/status";

function formatStatus(s: string) { return s?.replace(/_/g, " ") || ""; }
function formatDate(d: string) { try { return format(new Date(d), "MMM d, yyyy"); } catch { return ""; } }
const money = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

// Status filter buckets for the My Requests dropdown.
const APPROVED_STATES = ["approved", "fulfilled", "completed", "booked", "confirmed", "done", "resolved", "delivered"];
const REJECTED_STATES = ["rejected", "cancelled", "closed"];
function matchesFilter(status: string, filter: string) {
  if (filter === "all") return true;
  if (filter === "approved") return APPROVED_STATES.includes(status);
  if (filter === "rejected") return REJECTED_STATES.includes(status);
  // pending = anything still in flight (not approved, not rejected/closed)
  return !APPROVED_STATES.includes(status) && !REJECTED_STATES.includes(status);
}

const money2 = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const REVOCABLE_BLOCK = ["approved", "rejected", "cancelled", "fulfilled", "completed", "ordered", "booked", "resolved", "done", "closed"];

// Coral validation styling shared by the inline request forms (mirrors the reimbursement form).
const ERR_BORDER = "border-[#FF6F62] focus-visible:ring-[#FF6F62]";
const FieldError = ({ show, msg }: { show: any; msg: string }) => (show ? <p className="text-[11px] text-[#FF6F62] mt-0.5">{msg}</p> : null);

// Submission slot: a re-submitted claim relabels "Submitted on" → "Re-submitted On" and keeps the
// original creation date for the hover tooltip. Only reimbursements carry a resubmit marker (in notes).
const submittedInfo = (type: string, it: any): { label: string; date: any; resubmitted: boolean; originalDate?: any } => {
  if (type === "reimbursement") {
    try {
      const p = JSON.parse(it.notes || "{}");
      if (p && p.kind === "resubmitted_diff") return { label: "Re-submitted On", date: p.at || it.updatedAt || it.createdAt, resubmitted: true, originalDate: it.createdAt };
    } catch { /* not JSON */ }
  }
  return { label: "Submitted on", date: it.createdAt, resubmitted: false };
};

// Renders the "Submitted on"/"Re-submitted On" label; when re-submitted, the label gets a dotted
// underline and a hover tooltip with the original creation date (portal-rendered, so layout is safe).
function SubmittedLabel({ info, className = "" }: { info: ReturnType<typeof submittedInfo>; className?: string }) {
  if (!info.resubmitted) return <span className={className}>{info.label}</span>;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`underline decoration-dotted underline-offset-2 cursor-help ${className}`}>{info.label}</span>
        </TooltipTrigger>
        <TooltipContent>Originally created {formatDate(info.originalDate)}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ---- accessors shared by table view, search & sort ----
const amountOf = (type: string, it: any): number =>
  type === "purchase" ? Number(it.estimatedCost) || 0
  : type === "travel" ? Number(it.estimatedBudget) || 0
  : type === "reimbursement" ? Number(it.totalAmount) || 0
  : 0;
const titleOf = (type: string, it: any): string =>
  type === "purchase" ? `${formatStatus(it.category) || "Purchase"} Request`
  : type === "travel" ? `${it.fromCity || "?"} → ${it.toCity || "?"}`
  : type === "ticket" ? (it.subject || "Ticket")
  : (it.reference || "Reimbursement");
const subOf = (type: string, it: any): string =>
  type === "purchase" ? (it.notes || "")
  : type === "travel" ? (it.purpose || "")
  : type === "ticket" ? formatStatus(it.category)
  : (it.businessPurpose || it.category || "");
const searchText = (type: string, it: any): string =>
  [titleOf(type, it), subOf(type, it), it.status, it.reference].filter(Boolean).join(" ").toLowerCase();

// Clean table view of requests for the current tab.
function RequestTable({ type, items, onOpen }: { type: string; items: any[]; onOpen: (it: any) => void }) {
  return (
    <div className="card-surface rounded-[16px]">
      <DataTable
        columns={[
          { key: "request", header: "Request", cellClassName: "font-medium text-foreground", render: (it: any) => titleOf(type, it) },
          { key: "details", header: "Details", cellClassName: "text-muted-foreground max-w-[18rem] truncate", render: (it: any) => subOf(type, it) || "—" },
          { key: "status", header: "Status", render: (it: any) => type === "reimbursement" ? <StatusBadge status={it.status} /> : <Badge className={`text-xs ${statusClass(it.status)}`}>{statusLabel(it.status)}</Badge> },
          { key: "amount", header: "Amount", align: "right", cellClassName: "font-semibold text-foreground", render: (it: any) => amountOf(type, it) ? money(amountOf(type, it)) : "—" },
          { key: "submitted", header: "Submitted on", cellClassName: "text-muted-foreground", render: (it: any) => { const sub = submittedInfo(type, it); return <div className="flex flex-col"><SubmittedLabel info={sub} className="text-[10px] uppercase tracking-wide text-muted-foreground" /><span>{formatDate(sub.date)}</span></div>; } },
          { key: "updated", header: "Last Updated", cellClassName: "text-muted-foreground", render: (it: any) => it.updatedAt ? formatDate(it.updatedAt) : "—" },
        ]}
        rows={items}
        getRowKey={(it: any) => it.id}
        onRowClick={(it: any) => onOpen(it)}
        rowClassName={(it: any) => it.status === "changes_requested" ? "bg-[#FF6F62]/[0.06]" : ""}
        testIdPrefix={`row-${type}`}
      />
    </div>
  );
}

// Clean label/value row inside a fixed-layout table so values always wrap (no horizontal scroll).
function Row({ label, value }: { label: string; value: any }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <tr className="border-b border-border/50 last:border-0 align-top">
      <td className="py-2 pr-4 text-xs text-muted-foreground w-[38%]">{label}</td>
      <td className="py-2 text-sm text-foreground break-words">{value}</td>
    </tr>
  );
}

// Vertical approval timeline tailored per request type.
function buildTimeline(type: string, item: any) {
  const s = item.status;
  const d = (x: any) => (x ? formatDate(x) : null);
  let steps: { label: string; date: any }[];
  let active: number;
  if (type === "reimbursement") {
    steps = [
      { label: "Submitted", date: d(item.createdAt) },
      { label: "Finance Review", date: d(item.financeDecisionAt) },
      { label: "Final Approval (CEO)", date: s === "approved" ? d(item.updatedAt) : null },
      { label: "Completed", date: s === "approved" ? d(item.updatedAt) : null },
    ];
    active = s === "approved" ? 4 : s === "finance_approved" ? 2 : s === "rejected" ? (item.approvedById ? 2 : 1) : 1;
  } else if (type === "ticket") {
    steps = [
      { label: "Opened", date: d(item.createdAt) },
      { label: "In Progress", date: null },
      { label: "Resolved", date: ["resolved", "done", "closed"].includes(s) ? d(item.updatedAt) : null },
    ];
    active = ["resolved", "done", "closed"].includes(s) ? 3 : ["in_progress", "need_info"].includes(s) ? 1 : 0;
  } else {
    const finalDone = ["ordered", "fulfilled", "booked", "completed"].includes(s);
    steps = [
      { label: "Submitted", date: d(item.createdAt) },
      { label: "CEO Approval", date: ["approved", ...["ordered", "fulfilled", "booked", "completed"]].includes(s) ? d(item.updatedAt) : null },
      { label: "Completed", date: finalDone ? d(item.updatedAt) : null },
    ];
    active = finalDone ? 3 : s === "approved" ? 2 : s === "rejected" ? 1 : ["submitted", "pending_ceo", "changes_requested"].includes(s) ? 1 : 0;
  }
  const cancelled = s === "cancelled";
  return steps.map((st, i) => {
    let state: "done" | "current" | "upcoming" | "rejected" = i < active ? "done" : i === active ? "current" : "upcoming";
    if (s === "rejected" && i === active) state = "rejected";
    if (cancelled) state = i === 0 ? "done" : "upcoming";
    return { ...st, state };
  });
}

function Timeline({ steps, cancelled }: { steps: any[]; cancelled?: boolean }) {
  return (
    <ol className="flex items-start">
      {steps.map((s, i) => (
        <li key={i} className="flex-1 flex flex-col items-center text-center min-w-0">
          <div className="flex items-center w-full">
            <span className={`h-px flex-1 ${i === 0 ? "opacity-0" : s.state === "upcoming" ? "bg-border" : "bg-[#0E7C7B]/40"}`} />
            {s.state === "done" ? <CheckCircle2 className="h-[18px] w-[18px] text-[#0E7C7B] flex-shrink-0" />
              : s.state === "current" ? <CircleDot className="h-[18px] w-[18px] text-[#206295] flex-shrink-0" />
              : s.state === "rejected" ? <XCircle className="h-[18px] w-[18px] text-[#FF6F62] flex-shrink-0" />
              : <CircleDashed className="h-[18px] w-[18px] text-muted-foreground/40 flex-shrink-0" />}
            <span className={`h-px flex-1 ${i === steps.length - 1 ? "opacity-0" : steps[i + 1].state === "upcoming" ? "bg-border" : "bg-[#0E7C7B]/40"}`} />
          </div>
          <div className="mt-2 px-1">
            <p className={`text-[13px] font-medium leading-tight ${s.state === "upcoming" ? "text-muted-foreground" : "text-foreground"}`}>{s.label}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{s.state === "current" ? (cancelled ? "—" : "In progress") : s.state === "rejected" ? "Rejected" : (s.date || "—")}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

// Read-only detail popup for any request type. No navigation — opens in place.
function RequestDetailModal({ detail, onClose }: { detail: { type: string; item: any } | null; onClose: () => void }) {
  const { toast } = useToast();
  const revoke = useMutation({
    mutationFn: () => {
      const d = detail!;
      const url = d.type === "reimbursement"
        ? `/api/reimbursements/${d.item.id}/revoke`
        : `/api/my-requests/${d.type === "purchase" ? "purchases" : d.type === "travel" ? "travels" : "tickets"}/${d.item.id}/revoke`;
      return apiRequest("POST", url, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/") });
      toast({ title: "Request revoked" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Could not revoke", description: e.message, variant: "destructive" }),
  });
  if (!detail) return null;
  const { type, item } = detail;
  const titleMap: Record<string, string> = { purchase: "Purchase Request", travel: "Travel Request", ticket: "Support Ticket", reimbursement: "Reimbursement Claim" };
  const isReimb = type === "reimbursement";
  const canRevoke = !REVOCABLE_BLOCK.includes(item.status);
  const lines: any[] = Array.isArray(item.lines) ? item.lines : [];
  const subTotal = lines.length ? lines.reduce((s, l) => s + (Number(l.amount) || 0), 0) : Number(item.totalAmount || 0);
  const advance = Number(item.cashAdvance) || 0;
  const steps = buildTimeline(type, item);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto overflow-x-hidden rounded-[16px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {titleMap[type] || "Request"}
            {isReimb ? <StatusBadge status={item.status} /> : <Badge className={`text-xs ${statusClass(item.status)}`}>{statusLabel(item.status)}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {/* ---- Details table ---- */}
        <table className="w-full table-fixed">
          <tbody>
            {type === "purchase" && <>
              <Row label="Category" value={formatStatus(item.category)} />
              <Row label="Estimated Cost" value={item.estimatedCost ? money(item.estimatedCost) : null} />
              <Row label="Needed By" value={item.neededByDate ? formatDate(item.neededByDate) : null} />
              <Row label="Department" value={item.department} />
              <Row label="Notes" value={item.notes} />
            </>}
            {type === "travel" && <>
              <Row label="Route" value={`${item.fromCity || "?"} → ${item.toCity || "?"}`} />
              <Row label="Purpose" value={item.purpose} />
              <Row label="Travel Date" value={item.travelDate ? formatDate(item.travelDate) : null} />
              <Row label="Return Date" value={item.returnDate ? formatDate(item.returnDate) : null} />
              <Row label="Preferences" value={item.preferences} />
              <Row label="Estimated Budget" value={item.estimatedBudget ? money(item.estimatedBudget) : null} />
            </>}
            {type === "ticket" && <>
              <Row label="Subject" value={item.subject} />
              <Row label="Category" value={formatStatus(item.category)} />
              <Row label="Priority" value={formatStatus(item.priority)} />
              <Row label="Description" value={item.description} />
            </>}
            {isReimb && <>
              <Row label="Reference" value={item.reference} />
              <Row label="Category" value={item.category} />
              <Row label="Business Purpose" value={item.businessPurpose} />
              <Row label="Period" value={item.periodFrom ? `${formatDate(item.periodFrom)} – ${formatDate(item.periodTo || item.periodFrom)}` : null} />
              <Row label="Invoice No." value={item.invoiceNumber} />
              <Row label="Invoice Date" value={item.invoiceDate ? formatDate(item.invoiceDate) : null} />
              <Row label="Finance Remark" value={item.financeNote} />
              <Row label="Decision Note" value={item.decisionNote} />
            </>}
            <Row label="Created" value={item.createdAt ? formatDate(item.createdAt) : null} />
          </tbody>
        </table>

        {/* ---- Purchase line items ---- */}
        {type === "purchase" && Array.isArray(item.items) && item.items.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">Items</p>
            <div className="space-y-1.5">
              {item.items.map((it: any, i: number) => (
                <div key={i} className="bg-muted/40 rounded-[16px] p-2.5 text-xs break-words">
                  <span className="font-medium text-foreground">{it.description}</span> · Qty {it.qty || 1}{it.estimatedCost ? ` · ${money(it.estimatedCost)}` : ""}
                  {it.link && <a href={it.link} target="_blank" rel="noreferrer" className="block text-[#206295] hover:underline mt-0.5 break-all">{it.link}</a>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---- Reimbursement line items + bill (with cash advance) ---- */}
        {isReimb && lines.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Expense Items</p>
            <div className="rounded-[16px] border border-border overflow-hidden">
              <table className="w-full table-fixed text-xs">
                <thead>
                  <tr className="bg-muted/50 text-[10px] uppercase tracking-wide text-muted-foreground text-left">
                    <th className="py-2 px-3 font-medium">Item</th>
                    <th className="py-2 px-2 font-medium w-16 text-center">Invoice</th>
                    <th className="py-2 px-3 font-medium w-24 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {lines.map((l: any, i: number) => (
                    <tr key={i} className="align-top">
                      <td className="py-2.5 px-3">
                        <p className="font-medium text-foreground break-words">{l.description || `Item ${i + 1}`}</p>
                        <p className="text-[11px] text-muted-foreground break-words mt-0.5">
                          {[l.nature || l.category, l.invoiceNo ? `Inv ${l.invoiceNo}` : null, l.invoiceDate ? formatDate(l.invoiceDate) : null].filter(Boolean).join("  |  ")}
                        </p>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        {l.fileData ? <a href={l.fileData} target="_blank" rel="noreferrer" className="text-[#206295] inline-flex items-center gap-1 hover:underline"><FileText className="h-3 w-3" /> View</a> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-foreground whitespace-nowrap">{money2(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 rounded-[16px] border border-border p-3 bg-muted/30 space-y-1.5 ml-auto sm:w-64">
              <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Sub Total</span><span className="font-semibold text-foreground">{money2(subTotal)}</span></div>
              {advance > 0 && <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Less: Cash Advance</span><span className="font-semibold text-[#FF6F62]">− {money2(advance)}</span></div>}
              <div className="flex items-center justify-between pt-1.5 border-t border-border"><span className="text-sm font-semibold text-foreground">Total to be Paid</span><span className="text-base font-bold text-[#206295]">{money2(subTotal - advance)}</span></div>
            </div>
          </div>
        )}

        {/* ---- Approval timeline ---- */}
        <Separator className="my-1" />
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Approval Timeline</p>
          <Timeline steps={steps} cancelled={item.status === "cancelled"} />
        </div>

        {/* ---- Revoke ---- */}
        {canRevoke && (
          <DialogFooter>
            <Button variant="ghost" className="btn-glass border-[1.5px] border-[#FF6F62] text-[#FF6F62] hover:text-[#FF6F62]" disabled={revoke.isPending}
              onClick={() => { if (window.confirm("Revoke this request? This cannot be undone.")) revoke.mutate(); }} data-testid="button-revoke-request">
              <Ban className="h-4 w-4 mr-1.5" /> {revoke.isPending ? "Revoking…" : "Revoke Request"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

const purposeOf = (type: string, it: any): string =>
  type === "purchase" ? (it.notes || "")
  : type === "travel" ? (it.purpose || "")
  : type === "ticket" ? (it.description || "")
  : (it.businessPurpose || "");

const colDivider = <div className="w-px self-stretch bg-foreground/15 flex-shrink-0" />;
const REF_PREFIX: Record<string, string> = { purchase: "PRC", travel: "TRV", ticket: "TKT", reimbursement: "RMB" };
// Display reference — uses the stored reference (reimbursements) or a stable code derived from the id.
const refOf = (type: string, it: any): string =>
  it.reference || `${REF_PREFIX[type] || "REQ"}-${String(it.id || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase()}`;

// Unified enterprise request card — Identity (ref · title · date) | Approval Status | Payable.
function RequestCard({ item, type, onOpen }: { item: any; type: "purchase" | "travel" | "ticket" | "reimbursement"; onOpen: (item: any) => void }) {
  const { toast } = useToast();
  const Icon = type === "purchase" ? ShoppingCart : type === "travel" ? Car : type === "ticket" ? TicketIcon : Receipt;
  const reference = refOf(type, item);
  const title = purposeOf(type, item) || titleOf(type, item);
  const amt = amountOf(type, item);
  const category = type === "travel" ? null : (item.category || null);
  const advance = type === "reimbursement" ? Number(item.cashAdvance) || 0 : 0;
  const payable = amt - advance;
  const canRevoke = !REVOCABLE_BLOCK.includes(item.status);
  const sub = submittedInfo(type, item);
  const dateLine = type === "reimbursement"
    ? (item.periodFrom ? `Expense Period · ${formatDate(item.periodFrom)} – ${formatDate(item.periodTo || item.periodFrom)}` : "Expense Period · —")
    : `Created · ${formatDate(item.createdAt)}`;

  const revoke = useMutation({
    mutationFn: () => {
      const url = type === "reimbursement"
        ? `/api/reimbursements/${item.id}/revoke`
        : `/api/my-requests/${type === "purchase" ? "purchases" : type === "travel" ? "travels" : "tickets"}/${item.id}/revoke`;
      return apiRequest("POST", url, {});
    },
    onSuccess: () => { queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/") }); toast({ title: "Request revoked" }); },
    onError: (e: any) => toast({ title: "Could not revoke", description: e.message, variant: "destructive" }),
  });

  return (
    <Card data-testid={`card-request-${item.id}`} className={`border-0 hover-elevate active-elevate-2 cursor-pointer ${item.status === "changes_requested" ? "ring-1 ring-[#FF6F62]/50 bg-[#FF6F62]/[0.04]" : ""}`} onClick={() => onOpen(item)}>
      <CardContent className="p-[17px]">
        <div className="flex items-stretch gap-0">
          {/* Identity */}
          <div className="flex-1 min-w-0 flex items-start gap-3 pr-5">
            <div className="h-8 w-8 rounded-lg bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0 mt-1">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground tracking-wide">{reference}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(reference); toast({ title: "Reference copied" }); }}
                  aria-label="Copy reference" data-testid={`copy-ref-${item.id}`}
                  className="h-5 w-5 rounded inline-flex items-center justify-center text-muted-foreground hover:text-[#206295] hover:bg-muted">
                  <Copy className="h-3 w-3" />
                </button>
                {category && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">{formatStatus(category)}</Badge>}
              </div>
              <h3 className="text-[18px] leading-tight font-semibold text-foreground tracking-tight truncate mt-0.5">{title}</h3>
              <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5 flex-shrink-0" /> {dateLine}</p>
            </div>
          </div>

          {/* Submitted on / Re-submitted On — reimbursements only */}
          {type === "reimbursement" && <>
            {colDivider}
            <div className="w-[150px] flex-shrink-0 px-5 flex flex-col justify-end">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1.5 whitespace-nowrap"><SubmittedLabel info={sub} /></div>
              <p className="text-sm font-semibold text-foreground mt-1.5 whitespace-nowrap">{formatDate(sub.date)}</p>
            </div>
          </>}

          {colDivider}
          {/* Last Updated — all tabs */}
          <div className="w-[150px] flex-shrink-0 px-5 flex flex-col justify-end">
            <History className="h-4 w-4 text-muted-foreground" />
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1.5 whitespace-nowrap">Last Updated</p>
            <p className="text-sm font-semibold text-foreground mt-1.5 whitespace-nowrap">{item.updatedAt ? formatDate(item.updatedAt) : "—"}</p>
          </div>

          {colDivider}
          {/* Approval Status — sized to fit "APPROVAL STATUS" + widest status chip ("Changes Requested") with even margins */}
          <div className="w-[188px] flex-shrink-0 px-5 flex flex-col justify-end">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1.5 whitespace-nowrap">Approval Status</p>
            <div className="mt-1.5">
              {type === "reimbursement"
                ? <StatusBadge status={item.status} />
                : <Badge className={`text-xs ${statusClass(item.status)}`}>{statusLabel(item.status)}</Badge>}
            </div>
          </div>

          {colDivider}
          {/* Payable — sized to fit ₹10,00,000 + "net of … advance" subtext */}
          <div className="w-[188px] flex-shrink-0 px-5 flex flex-col justify-end items-end text-right">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">Payable</p>
            {amt > 0 ? (
              <>
                <p className="text-2xl font-bold text-[#206295] tracking-tight tabular-nums mt-1.5">
                  <span className="font-semibold mr-0.5">₹</span>{payable.toLocaleString("en-IN")}
                </p>
                {advance > 0 && <p className="text-[11px] text-muted-foreground mt-0.5">net of {money(advance)} advance</p>}
              </>
            ) : (
              <p className="text-2xl font-bold text-muted-foreground/50 mt-1.5">—</p>
            )}
          </div>

          {/* Overflow */}
          <div className="flex-shrink-0 flex items-center pl-2" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" data-testid={`more-${type}-${item.id}`}><MoreVertical className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => onOpen(item)}><Eye className="h-4 w-4 mr-2" /> View details</DropdownMenuItem>
                {canRevoke && (
                  <DropdownMenuItem className="text-[#FF6F62] focus:text-[#FF6F62]" disabled={revoke.isPending}
                    onClick={() => { if (window.confirm("Revoke this request? This cannot be undone.")) revoke.mutate(); }}>
                    <Ban className="h-4 w-4 mr-2" /> Revoke
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Office Purchase card — same columnar layout as RequestCard, wired to the office-purchase lifecycle.
function OfficePurchaseCard({ item, onOpen }: { item: any; onOpen: (id: string) => void }) {
  const { toast } = useToast();
  const reference = item.reference || `OP-${String(item.id || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase()}`;
  const lines = Array.isArray(item.items) ? item.items : [];
  const title = lines.length ? `${lines[0]?.description || "Item"}${lines.length > 1 ? ` +${lines.length - 1} more` : ""}` : "Office Purchase";
  const amt = Number(item.totalAmount) || 0;
  const canCancel = ["pending_hr", "pending_approval"].includes(item.status);
  const cancel = useMutation({
    mutationFn: () => apiRequest("POST", `/api/office-purchases/${item.id}/cancel`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/office-purchases") }); toast({ title: "Request cancelled" }); },
    onError: (e: any) => toast({ title: "Could not cancel", description: e.message, variant: "destructive" }),
  });
  return (
    <Card data-testid={`card-op-${item.id}`} className="border-0 hover-elevate active-elevate-2 cursor-pointer" onClick={() => onOpen(item.id)}>
      <CardContent className="p-[17px]">
        <div className="flex items-stretch gap-0">
          <div className="flex-1 min-w-0 flex items-start gap-3 pr-5">
            <div className="h-8 w-8 rounded-lg bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0 mt-1"><ShoppingCart className="h-4 w-4" /></div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground tracking-wide">{reference}</span>
                <button onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(reference); toast({ title: "Reference copied" }); }} aria-label="Copy reference" className="h-5 w-5 rounded inline-flex items-center justify-center text-muted-foreground hover:text-[#206295] hover:bg-muted"><Copy className="h-3 w-3" /></button>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">{item.priority || "medium"}</Badge>
              </div>
              <h3 className="text-[18px] leading-tight font-semibold text-foreground tracking-tight truncate mt-0.5">{title}</h3>
              <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5 flex-shrink-0" /> Created · {formatDate(item.createdAt)}</p>
            </div>
          </div>

          {colDivider}
          <div className="w-[150px] flex-shrink-0 px-5 flex flex-col justify-end">
            <History className="h-4 w-4 text-muted-foreground" />
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1.5 whitespace-nowrap">Last Updated</p>
            <p className="text-sm font-semibold text-foreground mt-1.5 whitespace-nowrap">{item.updatedAt ? formatDate(item.updatedAt) : "—"}</p>
          </div>

          {colDivider}
          <div className="w-[188px] flex-shrink-0 px-5 flex flex-col justify-end">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1.5 whitespace-nowrap">Approval Status</p>
            <div className="mt-1.5"><Badge className={`text-xs ${statusClass(item.status)}`}>{statusLabel(item.status)}</Badge></div>
          </div>

          {colDivider}
          <div className="w-[188px] flex-shrink-0 px-5 flex flex-col justify-end items-end text-right">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">Amount</p>
            {amt > 0
              ? <p className="text-2xl font-bold text-[#206295] tracking-tight tabular-nums mt-1.5"><span className="font-semibold mr-0.5">₹</span>{amt.toLocaleString("en-IN")}</p>
              : <p className="text-sm text-muted-foreground mt-1.5">Not priced yet</p>}
          </div>

          <div className="flex-shrink-0 flex items-center pl-2" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" data-testid={`more-op-${item.id}`}><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => onOpen(item.id)}><Eye className="h-4 w-4 mr-2" /> View details</DropdownMenuItem>
                {canCancel && <DropdownMenuItem className="text-[#FF6F62] focus:text-[#FF6F62]" disabled={cancel.isPending} onClick={() => { if (window.confirm("Cancel this request? This cannot be undone.")) cancel.mutate(); }}><Ban className="h-4 w-4 mr-2" /> Cancel</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Local drafts store (per-browser; not submitted to the server until "Submit") ----
const DRAFTS_KEY = "emo:my-requests:drafts";
type Draft = { id: string; type: string; data: any; savedAt: number };
function readDrafts(): Draft[] { try { return JSON.parse(localStorage.getItem(DRAFTS_KEY) || "[]"); } catch { return []; } }
function writeDrafts(d: Draft[]): boolean { try { localStorage.setItem(DRAFTS_KEY, JSON.stringify(d)); return true; } catch { return false; } }
const newDraftId = () => `dft_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
const DRAFT_META: Record<string, { label: string; icon: any }> = {
  office: { label: "Office Purchase", icon: ShoppingCart },
  procurement: { label: "Procurement", icon: Package },
  trip: { label: "Travel", icon: Car },
  purchase: { label: "Purchase", icon: ShoppingCart },
  travel: { label: "Travel", icon: Car },
  ticket: { label: "Ticket", icon: TicketIcon },
  reimbursement: { label: "Reimbursement", icon: Receipt },
};
const draftTitle = (d: Draft): string => {
  const x = d.data || {};
  if (d.type === "trip") return x.purpose || `${(x.category || "Travel")[0].toUpperCase()}${(x.category || "ravel").slice(1)} request`;
  if (d.type === "office" || d.type === "procurement") { const it = (x.items || [])[0]; return it?.description ? `${it.description}${x.items.length > 1 ? ` +${x.items.length - 1}` : ""}` : (d.type === "procurement" ? "Procurement" : "Office Purchase"); }
  if (d.type === "purchase") return `${formatStatus(x.category) || "Purchase"} Request`;
  if (d.type === "travel") return x.purpose || `${x.fromCity || "?"} → ${x.toCity || "?"}`;
  if (d.type === "ticket") return x.subject || "Support Ticket";
  return x.businessPurpose || "Reimbursement";
};
const draftAmount = (d: Draft): number => {
  const x = d.data || {};
  if (d.type === "office" || d.type === "procurement") return (x.items || []).reduce((s: number, i: any) => s + (Number(i.unitPrice) || 0) * (Number(i.quantity) || 0), 0);
  if (d.type === "purchase") return (x.items || []).reduce((s: number, i: any) => s + (Number(i.estimatedCost) || 0), 0);
  if (d.type === "travel") return Number(x.estimatedBudget) || 0;
  if (d.type === "reimbursement") return (x.items || []).reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
  return 0;
};

function DraftCard({ draft, onEdit, onDelete, onSubmit, submitting }: { draft: Draft; onEdit: (d: Draft) => void; onDelete: (d: Draft) => void; onSubmit: (d: Draft) => void; submitting: boolean }) {
  const meta = DRAFT_META[draft.type] || { label: draft.type, icon: FileText };
  const Icon = meta.icon;
  const amt = draftAmount(draft);
  return (
    <Card className="border-0 hover-elevate" data-testid={`draft-${draft.id}`}>
      <CardContent className="p-[17px]">
        <div className="flex items-stretch gap-0">
          {/* Identity */}
          <div className="flex-1 min-w-0 flex items-start gap-3 pr-5">
            <div className="h-8 w-8 rounded-lg bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0 mt-1">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">DRAFT</Badge>
              <h3 className="text-[22px] leading-tight font-semibold text-foreground tracking-tight truncate mt-1">{draftTitle(draft)}</h3>
            </div>
          </div>

          {colDivider}
          {/* Category */}
          <div className="w-[176px] flex-shrink-0 px-5 flex flex-col justify-end">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1.5 whitespace-nowrap">Category</p>
            <p className="text-sm font-semibold text-foreground mt-1.5">{meta.label}</p>
          </div>

          {colDivider}
          {/* Saved on */}
          <div className="w-[176px] flex-shrink-0 px-5 flex flex-col justify-end">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1.5 whitespace-nowrap">Saved On</p>
            <p className="text-sm font-semibold text-foreground mt-1.5">{formatDate(new Date(draft.savedAt).toISOString())}</p>
          </div>

          {colDivider}
          {/* Amount */}
          <div className="w-[188px] flex-shrink-0 px-5 flex flex-col justify-end items-end text-right">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">Amount</p>
            {amt > 0
              ? <p className="text-2xl font-bold text-[#206295] tracking-tight tabular-nums mt-1.5"><span className="font-semibold mr-0.5">₹</span>{amt.toLocaleString("en-IN")}</p>
              : <p className="text-2xl font-bold text-muted-foreground/50 mt-1.5">—</p>}
          </div>

          {colDivider}
          {/* Actions */}
          <div className="flex items-center gap-2 pl-5 flex-shrink-0">
            <Button size="sm" variant="ghost" className="btn-glass text-[#206295] hover:text-[#206295]" onClick={() => onEdit(draft)} data-testid={`draft-edit-${draft.id}`}><Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit</Button>
            <Button size="sm" className="btn-primary-gradient" disabled={submitting} onClick={() => onSubmit(draft)} data-testid={`draft-submit-${draft.id}`}><Send className="h-3.5 w-3.5 mr-1.5" /> Submit</Button>
            <Button size="sm" variant="ghost" className="text-[#FF6F62] hover:text-[#FF6F62]" onClick={() => onDelete(draft)} data-testid={`draft-delete-${draft.id}`}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const CR_PAGE_SIZE = 15;
// Reimbursement card view: "Changes Requested" claims are lifted into their own urgency section at the
// top (grey caps heading, count + pagination when > 2), separated from the rest of the list.
function ReimbCardView({ items, onOpen }: { items: any[]; onOpen: (it: any) => void }) {
  const [crPage, setCrPage] = useState(1);
  const cr = items.filter((r) => r.status === "changes_requested");
  const rest = items.filter((r) => r.status !== "changes_requested");
  const showPager = cr.length > 2;
  const crTotalPages = Math.max(1, Math.ceil(cr.length / CR_PAGE_SIZE));
  const curCrPage = Math.min(crPage, crTotalPages);
  const crPageItems = showPager ? cr.slice((curCrPage - 1) * CR_PAGE_SIZE, curCrPage * CR_PAGE_SIZE) : cr;
  return (
    <div className="space-y-3">
      {cr.length > 0 && <>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5" data-testid="cr-section-title">
            <AlertTriangle className="h-3.5 w-3.5" /> Action Required — Changes Requested
          </h2>
          {showPager && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="tabular-nums whitespace-nowrap">{cr.length} item{cr.length !== 1 ? "s" : ""} need action</span>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={curCrPage <= 1} onClick={() => setCrPage(curCrPage - 1)} data-testid="cr-page-prev"><ChevronLeft className="h-4 w-4" /></Button>
              <span className="px-1 tabular-nums">{curCrPage} / {crTotalPages}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={curCrPage >= crTotalPages} onClick={() => setCrPage(curCrPage + 1)} data-testid="cr-page-next"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </div>
        <div className="space-y-3">
          {crPageItems.map((r) => <RequestCard key={r.id} item={r} type="reimbursement" onOpen={onOpen} />)}
        </div>
        {rest.length > 0 && <Separator className="my-1" />}
      </>}
      {rest.map((r) => <RequestCard key={r.id} item={r} type="reimbursement" onOpen={onOpen} />)}
    </div>
  );
}

// Section header to break a request list into "In progress" / "Completed" (renders only if it has items).
function ReqSection({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5 bg-muted text-muted-foreground">{count}</span>
      </div>
      {children}
    </div>
  );
}
const DONE_STATUS: Record<string, string[]> = {
  office: ["delivered", "rejected", "cancelled"],
  procurement: ["approved", "rejected", "cancelled"],
  trip: ["booked", "rejected", "cancelled"],
};

export default function MyRequestsPage() {
  const { data: auth } = useAuth();
  const { toast } = useToast();
  const [location] = useLocation();
  const [, navigate] = useLocation();

  // Tab comes from the clean path (/my-requests/<tab>); query is only used for the auto-open flag.
  const params = new URLSearchParams(location.split("?")[1] || "");
  const pathTab = location.replace(/\?.*$/, "").replace(/^\/my-requests\/?/, "");
  // "Purchases" (legacy) is retired in favour of "Office Purchases"; redirect old links/default.
  const rawTab = pathTab || params.get("tab") || "office-purchases";
  const initTab = rawTab === "purchases" ? "office-purchases" : rawTab;
  const autoNew = params.get("new") === "true";

  const [tab, setTab] = useState(initTab);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("status_change");
  const [view, setView] = useState<"card" | "table">("card");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ type: string; item: any } | null>(null);
  const [showPRForm, setShowPRForm] = useState(false);
  const [showTRForm, setShowTRForm] = useState(false);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [showReimbForm, setShowReimbForm] = useState(false);

  // ---- Drafts ----
  const [drafts, setDrafts] = useState<Draft[]>(() => readDrafts());
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [reimbInitial, setReimbInitial] = useState<any>(null);
  const [reimbResubmit, setReimbResubmit] = useState<{ id: string; decisionNote?: string; editable?: { fields: string[]; lines: number[] } } | null>(null);
  const [reimbForceValidate, setReimbForceValidate] = useState(false);
  const [submittingDraftId, setSubmittingDraftId] = useState<string | null>(null);
  const persistDrafts = (next: Draft[]) => { setDrafts(next); if (!writeDrafts(next)) toast({ title: "Could not save draft", description: "Local storage is full.", variant: "destructive" }); };
  const removeDraft = (id: string) => persistDrafts(readDrafts().filter((d) => d.id !== id));

  // Auto-open form if navigated from service catalog
  useEffect(() => {
    if (autoNew) {
      if (initTab === "purchases") setShowPRForm(true);
      else if (initTab === "travels") { setEditingDraftId(null); setTripInitial(null); setShowNewTravel(true); }
      else if (initTab === "tickets") setShowTicketForm(true);
    }
  }, [autoNew, initTab]);

  const { data: purchases = [], isLoading: loadPR } = useQuery<any[]>({ queryKey: ["/api/my-requests/purchases"] });
  const { data: travels = [], isLoading: loadTR } = useQuery<any[]>({ queryKey: ["/api/my-requests/travels"] });
  const { data: myTrips = [], isLoading: loadTrips } = useQuery<any[]>({ queryKey: ["/api/travel?mine=true"] });
  const [showNewTravel, setShowNewTravel] = useState(false);
  const [travelDetailId, setTravelDetailId] = useState<string | null>(null);
  const [tripInitial, setTripInitial] = useState<any>(null);
  const { data: tickets = [], isLoading: loadTickets } = useQuery<any[]>({ queryKey: ["/api/my-requests/tickets"] });
  const { data: reimbursements = [], isLoading: loadReimb } = useQuery<any[]>({ queryKey: ["/api/reimbursements?mine=true"] });
  const { data: officePurchases = [], isLoading: loadOP } = useQuery<any[]>({ queryKey: ["/api/office-purchases?mine=true"] });
  const [opDetailId, setOpDetailId] = useState<string | null>(null);
  const [opNewOpen, setOpNewOpen] = useState(false);
  const [newKind, setNewKind] = useState<"office" | "procurement" | undefined>(undefined);
  const [newInitialData, setNewInitialData] = useState<any>(null);
  const { data: procurement = [], isLoading: loadProc } = useQuery<any[]>({ queryKey: ["/api/procurement?mine=true"] });
  const [procDetailId, setProcDetailId] = useState<string | null>(null);

  // PR form with items
  const prForm = useForm({
    defaultValues: {
      category: "office_supplies",
      items: [{ description: "", qty: 1, estimatedCost: "", link: "" }],
      notes: "",
      neededByDate: "",
    },
  });
  const { fields, append, remove } = useFieldArray({ control: prForm.control, name: "items" });

  // Travel form
  const trForm = useForm({
    defaultValues: { purpose: "", fromCity: "", toCity: "", travelDate: "", returnDate: "", preferences: "", estimatedBudget: "" }
  });

  // Ticket form
  const ticketForm = useForm({
    defaultValues: { category: "hr_query", subject: "", description: "", priority: "medium" }
  });

  // Subscribe to each form's validation errors so required-field styling re-renders.
  const prErrors = prForm.formState.errors as any;
  const trErrors = trForm.formState.errors as any;
  const tkErrors = ticketForm.formState.errors as any;

  // Closing a form without saving (Cancel / X / click-away) discards all input — a fresh form opens next time.
  // (Submitting or "Save as Draft" already persist + reset separately.)
  const closePR = () => { setShowPRForm(false); setEditingDraftId(null); prForm.reset(); };
  const closeTR = () => { setShowTRForm(false); setEditingDraftId(null); trForm.reset(); };
  const closeTicket = () => { setShowTicketForm(false); setEditingDraftId(null); ticketForm.reset(); };

  // Open a "changes requested" reimbursement in the form to edit & resubmit; everything else opens the read-only detail.
  const openReimb = (it: any) => {
    if (it.status !== "changes_requested") { setDetail({ type: "reimbursement", item: it }); return; }
    let editable: { fields: string[]; lines: number[] } | undefined;
    try { const p = JSON.parse(it.notes || "{}"); if (p && p.kind === "change_request") editable = { fields: p.fields || [], lines: p.lines || [] }; } catch {}
    setEditingDraftId(null);
    setReimbInitial({ businessPurpose: it.businessPurpose, periodFrom: it.periodFrom, periodTo: it.periodTo, items: Array.isArray(it.lines) ? it.lines : [], cashAdvance: it.cashAdvance });
    setReimbResubmit({ id: it.id, decisionNote: it.decisionNote, editable });
    setShowReimbForm(true);
  };

  // ---- Draft actions ----
  const saveDraft = (type: string, data: any) => {
    const base = readDrafts().filter((d) => d.id !== editingDraftId);
    const id = editingDraftId || newDraftId();
    persistDrafts([{ id, type, data, savedAt: Date.now() }, ...base]);
    setEditingDraftId(null);
    setShowPRForm(false); setShowTRForm(false); setShowTicketForm(false); setShowReimbForm(false); setReimbInitial(null);
    prForm.reset(); trForm.reset(); ticketForm.reset();
    toast({ title: "Saved to Drafts" });
  };
  const editDraft = (d: Draft) => {
    setEditingDraftId(d.id);
    setReimbForceValidate(false);
    if (d.type === "trip") { setTripInitial(d.data); setShowNewTravel(true); }
    else if (d.type === "office" || d.type === "procurement") { setNewKind(d.type); setNewInitialData(d.data); setOpNewOpen(true); }
    else if (d.type === "purchase") { prForm.reset({ category: "office_supplies", items: [{ description: "", qty: 1, estimatedCost: "", link: "" }], notes: "", neededByDate: "", ...d.data }); setShowPRForm(true); }
    else if (d.type === "travel") { setTripInitial(null); setShowNewTravel(true); } // legacy travel drafts → new travel dialog
    else if (d.type === "ticket") { ticketForm.reset({ category: "hr_query", subject: "", description: "", priority: "medium", ...d.data }); setShowTicketForm(true); }
    else { setReimbInitial(d.data); setShowReimbForm(true); }
  };
  // Mandatory-field check per draft type — mirrors each form's own required fields.
  const draftComplete = (d: Draft): boolean => {
    const x = d.data || {};
    if (d.type === "trip") return false; // always open the travel dialog to finish + submit
    if (d.type === "office" || d.type === "procurement") {
      const items = Array.isArray(x.items) ? x.items : [];
      if (!items.length) return false;
      return d.type === "procurement"
        ? items.every((i: any) => (i.description || "").trim() && Number(i.quantity) > 0 && Number(i.unitPrice) > 0 && (i.finalLink || "").trim())
        : items.every((i: any) => (i.description || "").trim() && Number(i.quantity) > 0);
    }
    if (d.type === "purchase") { const items = Array.isArray(x.items) ? x.items : []; return items.length > 0 && items.every((i: any) => (i.description || "").trim()); }
    if (d.type === "travel") return !!((x.purpose || "").trim() && (x.fromCity || "").trim() && (x.toCity || "").trim() && x.travelDate);
    if (d.type === "ticket") return !!((x.subject || "").trim());
    return reimbDraftComplete(x);
  };

  const submitDraft = async (d: Draft) => {
    // Missing mandatory fields → don't submit; open the pre-filled form with validation shown.
    if (!draftComplete(d)) {
      editDraft(d);
      if (d.type === "purchase") setTimeout(() => prForm.trigger(), 0);
      else if (d.type === "travel") setTimeout(() => trForm.trigger(), 0);
      else if (d.type === "ticket") setTimeout(() => ticketForm.trigger(), 0);
      else if (!["office", "procurement", "trip"].includes(d.type)) setReimbForceValidate(true); // office/procurement/trip: the dialog's own Submit stays disabled until valid
      toast({ title: "Please complete the required fields", variant: "destructive" });
      return;
    }
    setSubmittingDraftId(d.id);
    try {
      const x = d.data || {};
      if (d.type === "purchase") {
        const total = (x.items || []).reduce((s: number, i: any) => s + (Number(i.estimatedCost) || 0), 0);
        const pr = await apiRequest("POST", "/api/my-requests/purchases", { category: x.category, items: (x.items || []).filter((i: any) => i.description), estimatedCost: total || null, neededByDate: x.neededByDate || null, notes: x.notes || null });
        await apiRequest("POST", `/api/my-requests/purchases/${pr.id}/submit`, {});
      } else if (d.type === "travel") {
        const tr = await apiRequest("POST", "/api/my-requests/travels", { ...x, travelDate: x.travelDate || null, returnDate: x.returnDate || null, estimatedBudget: x.estimatedBudget ? Number(x.estimatedBudget) : null });
        await apiRequest("POST", `/api/my-requests/travels/${tr.id}/submit`, {});
      } else if (d.type === "ticket") {
        await apiRequest("POST", "/api/my-requests/tickets", x);
      } else if (d.type === "office") {
        const items = (x.items || []).filter((it: any) => (it.description || "").trim());
        await apiRequest("POST", "/api/office-purchases", { justification: x.justification || null, items: items.map((it: any) => ({ description: (it.description || "").trim(), quantity: Number(it.quantity) || 1, suggestedLinks: (it.suggestedLinks || []).filter(Boolean) })) });
      } else if (d.type === "procurement") {
        const items = (x.items || []).filter((it: any) => (it.description || "").trim());
        await apiRequest("POST", "/api/procurement", { category: "amazon", justification: x.justification || null, items: items.map((it: any) => ({ description: (it.description || "").trim(), quantity: Number(it.quantity) || 1, link: (it.finalLink || "").trim(), unitPrice: Number(it.unitPrice) || 0 })) });
      } else {
        const items = x.items || [];
        const subTotal = items.reduce((s: number, it: any) => s + (Number(it.amount) || 0), 0);
        await apiRequest("POST", "/api/reimbursements", { businessPurpose: x.businessPurpose, periodFrom: x.periodFrom || null, periodTo: x.periodTo || null, category: items.length === 1 && items[0].nature ? items[0].nature : "Mixed", totalAmount: String(subTotal), cashAdvance: String(Number(x.cashAdvance) || 0), currency: "INR", description: x.businessPurpose, lines: items.map((it: any) => ({ invoiceNo: it.invoiceNo || null, invoiceDate: it.invoiceDate || null, description: it.description, nature: it.nature, amount: Number(it.amount) || 0, fileName: it.fileName || null, fileType: it.fileType || null, fileData: it.fileData || null })) });
      }
      removeDraft(d.id);
      queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/") });
      toast({ title: "Draft submitted" });
    } catch (e: any) {
      toast({ title: "Submit failed", description: e.message, variant: "destructive" });
    } finally {
      setSubmittingDraftId(null);
    }
  };

  const createPRMutation = useMutation({
    mutationFn: async (data: any) => {
      const totalEstimated = data.items.reduce((sum: number, i: any) => sum + (Number(i.estimatedCost) || 0), 0);
      const pr = await apiRequest("POST", "/api/my-requests/purchases", {
        category: data.category,
        items: data.items.filter((i: any) => i.description),
        estimatedCost: totalEstimated || null,
        neededByDate: data.neededByDate || null,
        notes: data.notes || null,
      });
      await apiRequest("POST", `/api/my-requests/purchases/${pr.id}/submit`, {});
      return pr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-requests/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-requests/summary"] });
      setShowPRForm(false); prForm.reset();
      if (editingDraftId) { removeDraft(editingDraftId); setEditingDraftId(null); }
      toast({ title: "Purchase request submitted for approval" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createTRMutation = useMutation({
    mutationFn: async (data: any) => {
      const tr = await apiRequest("POST", "/api/my-requests/travels", {
        ...data,
        travelDate: data.travelDate || null,
        returnDate: data.returnDate || null,
        estimatedBudget: data.estimatedBudget ? Number(data.estimatedBudget) : null,
      });
      await apiRequest("POST", `/api/my-requests/travels/${tr.id}/submit`, {});
      return tr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-requests/travels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-requests/summary"] });
      setShowTRForm(false); trForm.reset();
      if (editingDraftId) { removeDraft(editingDraftId); setEditingDraftId(null); }
      toast({ title: "Travel request submitted for approval" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createTicketMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/my-requests/tickets", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-requests/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-requests/summary"] });
      setShowTicketForm(false); ticketForm.reset();
      if (editingDraftId) { removeDraft(editingDraftId); setEditingDraftId(null); }
      toast({ title: "Ticket submitted successfully" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const submitPRMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/my-requests/purchases/${id}/submit`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-requests/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-requests/summary"] });
      toast({ title: "Submitted for CEO approval" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const submitTRMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/my-requests/travels/${id}/submit`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-requests/travels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-requests/summary"] });
      toast({ title: "Submitted for CEO approval" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = (id: string, type: "purchase" | "travel" | "ticket") => {
    if (type === "purchase") submitPRMutation.mutate(id);
    else if (type === "travel") submitTRMutation.mutate(id);
  };

  const renderEmpty = (msg: string) => (
    <Card className="py-12"><CardContent className="text-center text-sm text-muted-foreground">{msg}</CardContent></Card>
  );

  // status filter -> search -> sort, applied per tab.
  const refine = (list: any[], type: string) => {
    const q = search.trim().toLowerCase();
    let r = list.filter((x) => matchesFilter(x.status, statusFilter));
    if (q) r = r.filter((x) => searchText(type, x).includes(q));
    const changedAt = (x: any) => +new Date(x.updatedAt || x.createdAt || 0);
    r = [...r].sort((a, b) => {
      if (sortBy === "amount_desc") return amountOf(type, b) - amountOf(type, a);
      if (sortBy === "amount_asc") return amountOf(type, a) - amountOf(type, b);
      if (sortBy === "status_change") {
        // "Changes Requested" pinned to the very top, then most-recently-updated first.
        const cr = (x: any) => (x.status === "changes_requested" ? 1 : 0);
        if (cr(a) !== cr(b)) return cr(b) - cr(a);
        return changedAt(b) - changedAt(a);
      }
      const da = +new Date(a.createdAt || 0), db = +new Date(b.createdAt || 0);
      return sortBy === "date_asc" ? da - db : db - da;
    });
    return r;
  };

  // Shared header controls (search · status filter · sort · view toggle · primary button)
  const controls = (newBtn: React.ReactNode) => (
    <div className="flex items-center gap-3">
      {/* View toggle — left-most, icon only */}
      <div className="segmented-toggle inline-flex p-0.5 h-10 flex-shrink-0">
        <button onClick={() => setView("card")} aria-label="Card view" data-testid="view-card" className={`px-3 h-full rounded-[10px] inline-flex items-center justify-center ${view === "card" ? "btn-primary-gradient text-white" : "text-muted-foreground"}`}><LayoutGrid className="h-4 w-4" /></button>
        <button onClick={() => setView("table")} aria-label="Table view" data-testid="view-table" className={`px-3 h-full rounded-[10px] inline-flex items-center justify-center ${view === "table" ? "btn-primary-gradient text-white" : "text-muted-foreground"}`}><Table2 className="h-4 w-4" /></button>
      </div>
      <div className="h-10 w-px flex-shrink-0 bg-foreground/30" />
      {/* Search — fills available width */}
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search requests…" className="pl-8 h-10 w-full" data-testid="input-search-requests" />
      </div>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="h-10 w-[130px] flex-shrink-0" data-testid="select-status-filter"><SelectValue placeholder="Filter" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
        </SelectContent>
      </Select>
      <Select value={sortBy} onValueChange={setSortBy}>
        <SelectTrigger className="h-10 w-[230px] gap-1 flex-shrink-0" data-testid="select-sort"><ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" /><span className="text-muted-foreground">Sort:</span><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="status_change">Latest Status Change</SelectItem>
          <SelectItem value="date_desc">Newest</SelectItem>
          <SelectItem value="date_asc">Oldest</SelectItem>
          <SelectItem value="amount_desc">Amount: High → Low</SelectItem>
          <SelectItem value="amount_asc">Amount: Low → High</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex-shrink-0">{newBtn}</div>
    </div>
  );

  const fPurchases = refine(purchases as any[], "purchase");
  const fTravels = refine(travels as any[], "travel");
  const fTickets = refine(tickets as any[], "ticket");
  const fReimb = refine(reimbursements as any[], "reimbursement");
  const opQuery = search.trim().toLowerCase();
  const fOP = (officePurchases as any[]).filter((o) =>
    matchesFilter(o.status, statusFilter) &&
    (opQuery === "" || `${o.reference || ""} ${(o.items || []).map((i: any) => i.description).join(" ")}`.toLowerCase().includes(opQuery))
  );
  const fProc = (procurement as any[]).filter((o) =>
    matchesFilter(o.status, statusFilter) &&
    (opQuery === "" || `${o.reference || ""} ${(o.items || []).map((i: any) => i.description).join(" ")}`.toLowerCase().includes(opQuery))
  );
  // 15-per-page pagination for the card views (table views paginate via DataTable).
  const tvPaged = usePaged(fTravels);
  const tkPaged = usePaged(fTickets);
  const rbPaged = usePaged(fReimb);
  const opPaged = usePaged(fOP);
  const prPaged = usePaged(fProc);

  return (
    <div className="p-6 space-y-5 max-w-[92rem] mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="icon" className="h-10 w-10 flex-shrink-0" onClick={() => navigate("/company-workspace")} aria-label="Back" data-testid="button-back">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Requests</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track all your purchase, travel, support and reimbursement requests</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); navigate(`/my-requests/${v}`); }} data-testid="tabs-my-requests">
        <TabsList>
          <TabsTrigger value="office-purchases">
            <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
            Purchases {(officePurchases as any[]).length > 0 && `(${(officePurchases as any[]).length})`}
          </TabsTrigger>
          <TabsTrigger value="procurement">
            <Package className="h-3.5 w-3.5 mr-1.5" />
            Procurement {(procurement as any[]).length > 0 && `(${(procurement as any[]).length})`}
          </TabsTrigger>
          <TabsTrigger value="travels">
            <Car className="h-3.5 w-3.5 mr-1.5" />
            Travel {(myTrips as any[]).length > 0 && `(${(myTrips as any[]).length})`}
          </TabsTrigger>
          <TabsTrigger value="tickets">
            <TicketIcon className="h-3.5 w-3.5 mr-1.5" />
            Tickets {(tickets as any[]).length > 0 && `(${(tickets as any[]).length})`}
          </TabsTrigger>
          <TabsTrigger value="reimbursements">
            <Receipt className="h-3.5 w-3.5 mr-1.5" />
            Reimbursements {(reimbursements as any[]).length > 0 && `(${(reimbursements as any[]).length})`}
          </TabsTrigger>
          <TabsTrigger value="drafts">
            <FileEdit className="h-3.5 w-3.5 mr-1.5" />
            Drafts {drafts.length > 0 && `(${drafts.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="travels" className="mt-4 space-y-5">
          {controls(
            <Button size="sm" onClick={() => { setEditingDraftId(null); setTripInitial(null); setShowNewTravel(true); }} data-testid="button-new-travel">
              <Plus className="h-4 w-4 mr-1.5" /> New Travel Request
            </Button>
          )}
          {loadTrips ? <Skeleton className="h-24 w-full" /> :
            (myTrips as any[]).length === 0 ? renderEmpty("No travel requests yet.") :
            (() => {
              const tripCard = (t: any) => {
                const c = TRAVEL_CATS[t.category] || TRAVEL_CATS.flight;
                const route = t.category === "flight" ? `${t.details?.fromCity || "?"} → ${t.details?.toCity || "?"}` : t.category === "stay" ? (t.details?.city || "") : `${t.details?.from || "?"} → ${t.details?.to || "?"}`;
                return (
                  <div key={t.id} className="card-surface card-hover p-4 flex items-center gap-4 cursor-pointer" onClick={() => setTravelDetailId(t.id)} data-testid={`trip-${t.id}`}>
                    <span className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${c.tint}1a`, color: c.tint }}><c.icon className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap"><span className="text-[13px] font-semibold text-foreground truncate">{t.reference}</span><Badge className={`text-[10px] ${statusClass(t.status)}`}>{statusLabel(t.status)}</Badge></div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{c.label} | {route}{t.startDate ? ` | ${format(new Date(t.startDate), "MMM d, yyyy")}` : ""}</p>
                    </div>
                    {Number(t.amount) > 0 && <span className="text-sm font-bold text-[#206295] tabular-nums flex-shrink-0">₹{Number(t.amount).toLocaleString("en-IN")}</span>}
                  </div>
                );
              };
              const done = (myTrips as any[]).filter((t) => DONE_STATUS.trip.includes(t.status));
              const active = (myTrips as any[]).filter((t) => !DONE_STATUS.trip.includes(t.status));
              return (
                <div className="space-y-6">
                  <ReqSection label="In progress" count={active.length}><div className="space-y-3">{active.map(tripCard)}</div></ReqSection>
                  <ReqSection label="Completed" count={done.length}><div className="space-y-3">{done.map(tripCard)}</div></ReqSection>
                </div>
              );
            })()
          }
        </TabsContent>

        <TabsContent value="tickets" className="mt-4 space-y-5">
          {controls(
            <Button size="sm" onClick={() => { setEditingDraftId(null); ticketForm.reset(); setShowTicketForm(true); }} data-testid="button-new-ticket">
              <Plus className="h-4 w-4 mr-1.5" /> Raise Ticket
            </Button>
          )}
          {loadTickets ? <Skeleton className="h-24 w-full" /> :
            fTickets.length === 0 ? renderEmpty((tickets as any[]).length === 0 ? "No tickets yet." : "No tickets match this filter.") :
            view === "table" ? <RequestTable type="ticket" items={fTickets} onOpen={(it) => setDetail({ type: "ticket", item: it })} /> :
            <div className="space-y-3">
              {tkPaged.pageItems.map(t => (
                <RequestCard key={t.id} item={t} type="ticket" onOpen={(it) => setDetail({ type: "ticket", item: it })} />
              ))}
              <PaginationBar page={tkPaged.page} totalPages={tkPaged.totalPages} count={tkPaged.count} size={tkPaged.size} onPage={tkPaged.setPage} />
            </div>
          }
        </TabsContent>

        <TabsContent value="reimbursements" className="mt-4 space-y-5">
          {controls(
            <Button size="sm" onClick={() => { setEditingDraftId(null); setReimbInitial(null); setReimbResubmit(null); setReimbForceValidate(false); setShowReimbForm(true); }} data-testid="button-new-reimbursement">
              <Plus className="h-4 w-4 mr-1.5" /> New Reimbursement
            </Button>
          )}
          {loadReimb ? <Skeleton className="h-24 w-full" /> :
            fReimb.length === 0 ? renderEmpty((reimbursements as any[]).length === 0 ? "No reimbursements yet." : "No reimbursements match this filter.") :
            view === "table" ? <RequestTable type="reimbursement" items={fReimb} onOpen={openReimb} /> :
            <div className="space-y-5">
              <ReimbCardView items={rbPaged.pageItems} onOpen={openReimb} />
              <PaginationBar page={rbPaged.page} totalPages={rbPaged.totalPages} count={rbPaged.count} size={rbPaged.size} onPage={rbPaged.setPage} />
            </div>
          }
        </TabsContent>

        <TabsContent value="office-purchases" className="mt-4 space-y-5">
          {controls(
            <Button size="sm" onClick={() => { setEditingDraftId(null); setNewInitialData(null); setNewKind("office"); setOpNewOpen(true); }} data-testid="button-new-office-purchase">
              <Plus className="h-4 w-4 mr-1.5" /> New Office Purchase
            </Button>
          )}
          {loadOP ? <Skeleton className="h-24 w-full" /> :
            fOP.length === 0 ? renderEmpty((officePurchases as any[]).length === 0 ? "No office purchases yet." : "No office purchases match this filter.") :
            view === "table" ? (
              <Card className="border-0"><CardContent className="p-0">
                <DataTable
                  columns={[
                    { key: "reference", header: "Reference", cellClassName: "font-medium text-foreground", render: (o: any) => o.reference },
                    { key: "items", header: "Items", cellClassName: "text-muted-foreground", render: (o: any) => `${(o.items || []).length} item${(o.items || []).length !== 1 ? "s" : ""}` },
                    { key: "priority", header: "Priority", cellClassName: "capitalize text-muted-foreground", render: (o: any) => o.priority || "medium" },
                    { key: "amount", header: "Amount", align: "right", cellClassName: "font-semibold text-foreground", render: (o: any) => Number(o.totalAmount) > 0 ? money(o.totalAmount) : "—" },
                    { key: "status", header: "Status", render: (o: any) => <Badge className={`text-xs ${statusClass(o.status)}`}>{statusLabel(o.status)}</Badge> },
                    { key: "created", header: "Created", cellClassName: "text-muted-foreground", render: (o: any) => o.createdAt ? formatDate(o.createdAt) : "—" },
                  ]}
                  rows={fOP}
                  getRowKey={(o: any) => o.id}
                  onRowClick={(o: any) => setOpDetailId(o.id)}
                  testIdPrefix="op-row"
                />
              </CardContent></Card>
            ) : (() => {
              const done = fOP.filter((o: any) => DONE_STATUS.office.includes(o.status));
              const active = fOP.filter((o: any) => !DONE_STATUS.office.includes(o.status));
              return (
                <div className="space-y-6">
                  <ReqSection label="In progress" count={active.length}><div className="space-y-3">{active.map((o: any) => <OfficePurchaseCard key={o.id} item={o} onOpen={setOpDetailId} />)}</div></ReqSection>
                  <ReqSection label="Completed" count={done.length}><div className="space-y-3">{done.map((o: any) => <OfficePurchaseCard key={o.id} item={o} onOpen={setOpDetailId} />)}</div></ReqSection>
                </div>
              );
            })()
          }
        </TabsContent>

        <TabsContent value="procurement" className="mt-4 space-y-5">
          {controls(
            <Button size="sm" onClick={() => { setEditingDraftId(null); setNewInitialData(null); setNewKind("procurement"); setOpNewOpen(true); }} data-testid="button-new-procurement">
              <Plus className="h-4 w-4 mr-1.5" /> New Procurement
            </Button>
          )}
          {loadProc ? <Skeleton className="h-24 w-full" /> :
            fProc.length === 0 ? renderEmpty((procurement as any[]).length === 0 ? "No procurement requests yet." : "No procurement requests match this filter.") :
            view === "table" ? (
              <Card className="border-0"><CardContent className="p-0">
                <DataTable
                  columns={[
                    { key: "reference", header: "Reference", cellClassName: "font-medium text-foreground", render: (o: any) => o.reference },
                    { key: "items", header: "Items", cellClassName: "text-muted-foreground", render: (o: any) => `${(o.items || []).length} item${(o.items || []).length !== 1 ? "s" : ""}` },
                    { key: "amount", header: "Amount", align: "right", cellClassName: "font-semibold text-foreground", render: (o: any) => Number(o.totalAmount) > 0 ? money(o.totalAmount) : "—" },
                    { key: "status", header: "Status", render: (o: any) => <Badge className={`text-xs ${statusClass(o.status)}`}>{statusLabel(o.status)}</Badge> },
                    { key: "created", header: "Created", cellClassName: "text-muted-foreground", render: (o: any) => o.createdAt ? formatDate(o.createdAt) : "—" },
                  ]}
                  rows={fProc}
                  getRowKey={(o: any) => o.id}
                  onRowClick={(o: any) => setProcDetailId(o.id)}
                  testIdPrefix="proc-row"
                />
              </CardContent></Card>
            ) : (() => {
              const procCard = (o: any) => (
                <button key={o.id} onClick={() => setProcDetailId(o.id)} className="w-full text-left card-surface rounded-[16px] p-4 hover-elevate flex items-center gap-3" data-testid={`proc-card-${o.id}`}>
                  <span className="h-10 w-10 rounded-xl bg-[#0E7C7B]/10 text-[#0E7C7B] flex items-center justify-center flex-shrink-0"><Package className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{o.reference} | {(o.items || []).length} item{(o.items || []).length !== 1 ? "s" : ""}</p>
                    <p className="text-xs text-muted-foreground truncate">{(o.items || []).map((it: any) => it.description).filter(Boolean).join(", ") || "—"}</p>
                  </div>
                  {Number(o.totalAmount) > 0 && <span className="text-sm font-bold text-[#206295] flex-shrink-0 tabular-nums">{money(o.totalAmount)}</span>}
                  <Badge className={`text-xs ${statusClass(o.status)} flex-shrink-0`}>{statusLabel(o.status)}</Badge>
                </button>
              );
              const done = fProc.filter((o: any) => DONE_STATUS.procurement.includes(o.status));
              const active = fProc.filter((o: any) => !DONE_STATUS.procurement.includes(o.status));
              return (
                <div className="space-y-6">
                  <ReqSection label="In progress" count={active.length}><div className="space-y-3">{active.map(procCard)}</div></ReqSection>
                  <ReqSection label="Completed" count={done.length}><div className="space-y-3">{done.map(procCard)}</div></ReqSection>
                </div>
              );
            })()
          }
        </TabsContent>

        <TabsContent value="drafts" className="mt-4 space-y-5">
          {drafts.length === 0
            ? renderEmpty("No saved drafts. Use “Save as Draft” in any request form.")
            : (
              <div className="space-y-3">
                {drafts.slice().sort((a, b) => b.savedAt - a.savedAt).map((d) => (
                  <DraftCard key={d.id} draft={d} onEdit={editDraft}
                    onDelete={(dd) => { if (window.confirm("Delete this draft permanently?")) removeDraft(dd.id); }}
                    onSubmit={submitDraft} submitting={submittingDraftId === d.id} />
                ))}
              </div>
            )}
        </TabsContent>
      </Tabs>

      {/* Office Purchase — new-request chooser + detail (cancel / flag) */}
      <NewRequestDialog open={opNewOpen} onClose={() => { setOpNewOpen(false); setNewKind(undefined); setNewInitialData(null); }} initialKind={newKind} initialData={newInitialData}
        onSaveDraft={(data) => saveDraft(data.kind === "procurement" ? "procurement" : "office", data)}
        onSubmitted={() => { if (editingDraftId) { removeDraft(editingDraftId); setEditingDraftId(null); } }} />
      <OfficePurchaseDetailDialog id={opDetailId} open={!!opDetailId} onClose={() => setOpDetailId(null)} context="owner" />
      <ProcurementDetailDialog id={procDetailId} open={!!procDetailId} onClose={() => setProcDetailId(null)} context="owner" />
      <NewTravelDialog open={showNewTravel} onClose={() => { setShowNewTravel(false); setTripInitial(null); }} initialData={tripInitial}
        onSaveDraft={(data) => saveDraft("trip", data)}
        onSubmitted={() => { if (editingDraftId) { removeDraft(editingDraftId); setEditingDraftId(null); } }} />
      <TravelDetailDialog id={travelDetailId} open={!!travelDetailId} onClose={() => setTravelDetailId(null)} context="owner" />

      {/* Purchase Request Form */}
      <Dialog open={showPRForm} onOpenChange={(v) => { if (!v) closePR(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Purchase Request</DialogTitle></DialogHeader>
          <form onSubmit={prForm.handleSubmit(data => createPRMutation.mutate(data))} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select value={prForm.watch("category")} onValueChange={v => prForm.setValue("category", v)}>
                <SelectTrigger data-testid="select-pr-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="office_supplies">Office Supplies</SelectItem>
                  <SelectItem value="equipment">Equipment / Hardware</SelectItem>
                  <SelectItem value="software">Software / Subscription</SelectItem>
                  <SelectItem value="furniture">Furniture</SelectItem>
                  <SelectItem value="marketing">Marketing Materials</SelectItem>
                  <SelectItem value="training">Training / Books</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Items *</Label>
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-12 gap-1.5 items-start bg-muted/40 rounded-lg p-2.5">
                  <div className="col-span-5 space-y-1">
                    <p className="text-xs text-muted-foreground">Description</p>
                    <Input {...prForm.register(`items.${index}.description`, { required: true })} placeholder="Item name..." className={`h-8 text-xs ${prErrors.items?.[index]?.description ? ERR_BORDER : ""}`} data-testid={`input-item-desc-${index}`} />
                    <FieldError show={prErrors.items?.[index]?.description} msg="Required" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <p className="text-xs text-muted-foreground">Qty</p>
                    <Input type="number" min="1" {...prForm.register(`items.${index}.qty`)} className="h-8 text-xs" data-testid={`input-item-qty-${index}`} />
                  </div>
                  <div className="col-span-3 space-y-1">
                    <p className="text-xs text-muted-foreground">Est. Cost (₹)</p>
                    <Input type="number" min="0" {...prForm.register(`items.${index}.estimatedCost`)} placeholder="0" className="h-8 text-xs" data-testid={`input-item-cost-${index}`} />
                  </div>
                  <div className="col-span-2 flex items-end justify-center pb-0.5">
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => fields.length > 1 && remove(index)} data-testid={`button-remove-item-${index}`}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  <div className="col-span-12">
                    <Input {...prForm.register(`items.${index}.link`)} placeholder="Product link (optional)" className="h-8 text-xs" data-testid={`input-item-link-${index}`} />
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => append({ description: "", qty: 1, estimatedCost: "", link: "" })} data-testid="button-add-item">
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Item
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label>Needed By Date</Label>
              <Controller control={prForm.control} name="neededByDate" render={({ field }) => <DateInput value={field.value || ""} onChange={field.onChange} testId="input-pr-needed-by" />} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes / Justification</Label>
              <Textarea rows={2} {...prForm.register("notes")} placeholder="Why is this needed?" data-testid="textarea-pr-notes" />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closePR}>Cancel</Button>
              <Button type="button" variant="secondary" className="btn-glass text-[#206295]" onClick={() => saveDraft("purchase", prForm.getValues())} data-testid="button-draft-pr">
                <Save className="h-4 w-4 mr-1.5" /> Save as Draft
              </Button>
              <Button type="submit" disabled={createPRMutation.isPending} data-testid="button-save-pr">
                {createPRMutation.isPending ? "Submitting..." : "Submit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Legacy travel form removed — travel now uses NewTravelDialog (chooser: Flights / Stays / Transport). */}

      {/* Ticket Form */}
      <Dialog open={showTicketForm} onOpenChange={(v) => { if (!v) closeTicket(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Raise Support Ticket</DialogTitle></DialogHeader>
          <form onSubmit={ticketForm.handleSubmit(data => createTicketMutation.mutate(data))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={ticketForm.watch("category")} onValueChange={v => ticketForm.setValue("category", v)}>
                  <SelectTrigger data-testid="select-ticket-cat"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hr_query">HR Query</SelectItem>
                    <SelectItem value="stationery">Stationery</SelectItem>
                    <SelectItem value="office_repairs">Office Repairs</SelectItem>
                    <SelectItem value="guest_access">Guest Access</SelectItem>
                    <SelectItem value="it_support">IT Support</SelectItem>
                    <SelectItem value="payroll">Payroll</SelectItem>
                    <SelectItem value="leave">Leave</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={ticketForm.watch("priority")} onValueChange={v => ticketForm.setValue("priority", v)}>
                  <SelectTrigger data-testid="select-ticket-pri"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Subject *</Label>
              <Input {...ticketForm.register("subject", { required: true })} placeholder="Brief subject..." className={tkErrors.subject ? ERR_BORDER : ""} data-testid="input-ticket-subject" />
              <FieldError show={tkErrors.subject} msg="Subject is required" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={3} {...ticketForm.register("description")} placeholder="Describe your issue in detail..." data-testid="textarea-ticket-desc" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeTicket}>Cancel</Button>
              <Button type="button" variant="secondary" className="btn-glass text-[#206295]" onClick={() => saveDraft("ticket", ticketForm.getValues())} data-testid="button-draft-ticket">
                <Save className="h-4 w-4 mr-1.5" /> Save as Draft
              </Button>
              <Button type="submit" disabled={createTicketMutation.isPending} data-testid="button-submit-ticket">
                {createTicketMutation.isPending ? "Submitting..." : "Submit Ticket"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ReimbursementFormDialog
        open={showReimbForm}
        onClose={() => { setShowReimbForm(false); setReimbInitial(null); setEditingDraftId(null); setReimbResubmit(null); setReimbForceValidate(false); }}
        onSuccess={() => { if (editingDraftId) { removeDraft(editingDraftId); setEditingDraftId(null); } }}
        initialData={reimbInitial}
        onSaveDraft={(data) => saveDraft("reimbursement", data)}
        reimbursementId={reimbResubmit?.id}
        decisionNote={reimbResubmit?.decisionNote}
        editable={reimbResubmit?.editable}
        autoValidate={reimbForceValidate}
      />

      <RequestDetailModal detail={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
