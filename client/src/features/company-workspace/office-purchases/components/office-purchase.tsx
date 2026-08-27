import { canHrTriage, canCeoApprove } from "../../shared/permissions";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { statusClass, statusLabel } from "@/lib/status";
import { money } from "@/lib/format";
import { format } from "date-fns";
import {
  ShoppingCart, Plus, X, Link2, ChevronRight, ChevronLeft, Check, Truck,
  CircleCheck, AlertTriangle, ExternalLink, IndianRupee, Copy, MoreVertical,
  User, CalendarClock, Clock, Building2, FileText, MessageSquare,
} from "lucide-react";
import { RequestDialog } from "@/components/shared/request-dialog";
import { DateInput } from "@/components/shared/datetime-field";
import { CommentThread } from "@/components/shared/comment-thread";
import { FileUpload, type UploadedFile } from "@/components/shared/file-upload";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

const invalidate = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ predicate: (query) => typeof query.queryKey[0] === "string" && (query.queryKey[0] as string).startsWith("/api/office-purchases") });

type Item = { description: string; quantity: number; suggestedLinks: string[]; finalLink?: string; unitPrice?: number };
const emptyItem = (): Item => ({ description: "", quantity: 1, suggestedLinks: [], finalLink: "", unitPrice: undefined });

// Stylised duotone illustrations for the chooser cards (fill + stroke share currentColor).
function CartIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M6.2 8.5H20l-1.4 6.6a1.6 1.6 0 0 1-1.56 1.26H9.1a1.6 1.6 0 0 1-1.57-1.28L6.2 8.5z" fill="currentColor" fillOpacity="0.18" />
      <path d="M2.5 4H4.7L5.75 8.5L7.65 16.6a1.6 1.6 0 0 0 1.56 1.24H16.1a1.6 1.6 0 0 0 1.56-1.2L20 8.5H5.75" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="20.4" r="1.5" fill="currentColor" />
      <circle cx="16.5" cy="20.4" r="1.5" fill="currentColor" />
    </svg>
  );
}
function BoxIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M12 2.6 20.5 7v10L12 21.4 3.5 17V7z" fill="currentColor" fillOpacity="0.16" />
      <path d="M12 2.6 20.5 7v10L12 21.4 3.5 17V7L12 2.6z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M3.5 7 12 11.6 20.5 7M12 11.6V21.4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M7.6 4.8 16.2 9.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

// Numbered section header (matches the app's form style).
function FormSection({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3">
        <span className="h-6 w-6 rounded-full bg-[#206295] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">{n}</span>
        <h3 className="text-sm font-semibold text-foreground">{title} {hint && <span className="text-muted-foreground font-normal">{hint}</span>}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

// ============================ Progressive "New Request" dialog ============================
// Page 1: pick the nature — Office Purchase (POSTs /api/office-purchases) or Equipment & Assets
// (POSTs /api/procurement). Both are live; each has its own approval queue and My Requests tab.
// Page 2: the Office Purchase form. A 2-step progress bar runs across the top.
export function NewRequestDialog({ open, onClose, initialKind, onSaveDraft, initialData, onSubmitted }: { open: boolean; onClose: () => void; initialKind?: "office" | "procurement"; onSaveDraft?: (data: any) => void; initialData?: any; onSubmitted?: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<"office" | "procurement">("office");
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [justification, setJustification] = useState("");

  const reset = () => { setStep(0); setKind("office"); setItems([emptyItem()]); setJustification(""); };
  const close = () => { reset(); onClose(); };
  const setItem = (i: number, patch: Partial<Item>) => setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const pickKind = (k: "office" | "procurement") => { setKind(k); setItems([emptyItem()]); setJustification(""); setStep(1); };

  // Open from a "New …" button (initialKind) or a saved draft (initialData) → skip the chooser + prefill.
  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setKind(initialData.kind || initialKind || "office");
      setItems(Array.isArray(initialData.items) && initialData.items.length ? initialData.items : [emptyItem()]);
      setJustification(initialData.justification || "");
      setStep(1);
    } else if (initialKind) {
      setKind(initialKind); setItems([emptyItem()]); setJustification(""); setStep(1);
    }
  }, [open]);

  const invalidateProc = () => qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/procurement") });
  const submit = useMutation({
    mutationFn: (payload: any) => apiRequest("POST", kind === "procurement" ? "/api/procurement" : "/api/office-purchases", payload),
    onSuccess: () => { invalidate(qc); invalidateProc(); toast({ title: "Awaiting approval" }); onSubmitted?.(); close(); },
    onError: (e: any) => toast({ title: "Couldn't submit", description: e.message, variant: "destructive" }),
  });

  const procTotal = items.reduce((s, it) => s + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 0), 0);
  const valid = items.length > 0 && (kind === "procurement"
    ? items.every((it) => it.description.trim() && Number(it.quantity) > 0 && Number(it.unitPrice) > 0 && (it.finalLink || "").trim())
    : items.every((it) => it.description.trim() && Number(it.quantity) > 0));
  // No validity guard here: Submit is disabled while `valid` is false, so this only ever runs on a
  // complete form. A toast naming the missing fields used to sit here and could never fire.
  const doSubmit = () => {
    if (kind === "procurement") {
      submit.mutate({
        category: "amazon", justification: justification.trim() || null,
        items: items.map((it) => ({ description: it.description.trim(), quantity: Number(it.quantity) || 1, link: (it.finalLink || "").trim(), unitPrice: Number(it.unitPrice) || 0 })),
      });
    } else {
      submit.mutate({
        justification: justification.trim() || null,
        items: items.map((it) => ({ description: it.description.trim(), quantity: Number(it.quantity) || 1, suggestedLinks: (it.suggestedLinks || []).filter(Boolean) })),
      });
    }
  };

  return (
    <RequestDialog
      open={open}
      onClose={close}
      title="New Purchase Request"
      steps={["Choose type", "Details"]}
      step={step}
      minHeight="540px"
      back={step === 1 ? <Button variant="ghost" onClick={() => setStep(0)}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button> : undefined}
      footer={<>
        <Button variant="outline" onClick={close}>Cancel</Button>
        {step === 1 && onSaveDraft && <Button variant="secondary" className="btn-glass text-[#206295]" onClick={() => { onSaveDraft({ kind, items, justification }); close(); }} data-testid="op-save-draft">Save as Draft</Button>}
        {step === 1 && <Button className="btn-primary-gradient" disabled={!valid || submit.isPending} onClick={doSubmit} data-testid="op-submit">{submit.isPending ? "Submitting…" : "Submit request"}</Button>}
      </>}
    >
      <div className="px-6 pb-8">
        {step === 0 ? (
          <div className="flex flex-col justify-center h-full min-h-[320px] space-y-5">
            <p className="text-[15px] font-bold text-foreground text-center">Select the type of request you'd like to raise.</p>
            <button type="button" onClick={() => pickKind("office")} className="group w-full text-left card-surface rounded-2xl p-5 hover-elevate flex items-center gap-4" data-testid="choose-office-purchase">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#206295]/15 to-[#4BDCD9]/25 text-[#206295] flex items-center justify-center flex-shrink-0 shadow-sm">
                <CartIllustration className="h-8 w-8 origin-center group-hover:animate-[op-cart-roll_0.7s_ease-in-out]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">Office Purchase</p>
                <p className="text-xs text-muted-foreground mt-1">Everyday items — stationery, peripherals, small online buys.</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button type="button" onClick={() => pickKind("procurement")} className="group w-full text-left card-surface rounded-2xl p-5 hover-elevate flex items-center gap-4" data-testid="choose-procurement">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#0E7C7B]/15 to-[#4BDCD9]/30 text-[#0E7C7B] flex items-center justify-center flex-shrink-0 shadow-sm">
                <BoxIllustration className="h-8 w-8 origin-center group-hover:animate-[op-box-lift_0.7s_ease-in-out]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">Equipment & Assets</p>
                <p className="text-xs text-muted-foreground mt-1">Request equipment, supplies, or any business purchase.</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        ) : kind === "procurement" ? (
          <div className="space-y-5">
            <div className="flex items-center gap-2.5 rounded-xl bg-[#0E7C7B]/[0.06] px-3 py-2.5">
              <span className="h-8 w-8 rounded-lg bg-[#0E7C7B]/10 text-[#0E7C7B] flex items-center justify-center flex-shrink-0"><BoxIllustration className="h-4 w-4" /></span>
              <p className="text-sm font-semibold text-foreground">Equipment &amp; Assets</p>
            </div>

            <div className="space-y-1.5">
              <Label>Purpose</Label>
              <Input value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="e.g. Replacement bearing for the assembly line" data-testid="proc-purpose" />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Items</Label>
                <span className="text-xs text-muted-foreground">{items.length} item{items.length !== 1 ? "s" : ""}</span>
              </div>
              {items.map((it, i) => (
                <div key={i} className="rounded-[16px] border border-border p-3 space-y-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Item {i + 1}</span>
                    {items.length > 1 && <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))} aria-label="Remove item"><X className="h-3.5 w-3.5 text-[#FF6F62]" /></Button>}
                  </div>
                  <div className="space-y-1"><p className="text-xs text-muted-foreground">Item</p><Input value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} placeholder="e.g. SKF 6205 bearing" className="h-9" data-testid={`proc-item-desc-${i}`} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><p className="text-xs text-muted-foreground">Quantity</p><Input type="number" min={1} value={it.quantity} onChange={(e) => setItem(i, { quantity: Number(e.target.value) })} className="h-9" /></div>
                    <div className="space-y-1"><p className="text-xs text-muted-foreground">Unit cost (₹)</p><Input type="number" min={0} value={it.unitPrice ?? ""} onChange={(e) => setItem(i, { unitPrice: Number(e.target.value) })} placeholder="0.00" className="h-9" /></div>
                  </div>
                  <div className="space-y-1"><p className="text-xs text-muted-foreground">Amazon link</p><div className="relative"><Link2 className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" /><Input value={it.finalLink || ""} onChange={(e) => setItem(i, { finalLink: e.target.value })} placeholder="https://amazon.in/…" className="h-9 pl-8" /></div></div>
                </div>
              ))}
              <Button type="button" variant="secondaryB" size="sm" className="w-full" style={{ borderRadius: "16px" }} onClick={() => setItems((a) => [...a, emptyItem()])}><Plus className="h-3.5 w-3.5 mr-1.5" /> Add Item</Button>
            </div>

            <div className="rounded-[16px] border border-border p-4 bg-muted/30 flex items-center justify-between ml-auto sm:w-64">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className={`text-base font-bold tabular-nums ${procTotal > 0 ? "text-[#206295]" : "text-muted-foreground/50"}`}>{money(procTotal)}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-2.5 rounded-xl bg-[#206295]/[0.06] px-3 py-2.5">
              <span className="h-8 w-8 rounded-lg bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0"><ShoppingCart className="h-4 w-4" /></span>
              <div>
                <p className="text-sm font-semibold text-foreground">Office Purchase</p>
                <p className="text-[11px] text-muted-foreground">Stationery, peripherals & everyday supplies.</p>
              </div>
            </div>

            <FormSection n={1} title="What do you need?">
              {items.map((it, i) => (
                <div key={i} className="rounded-xl border border-border/70 p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Item {i + 1}</span>
                    {items.length > 1 && <button type="button" onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-[#FF6F62]" aria-label="Remove item"><X className="h-4 w-4" /></button>}
                  </div>
                  <div className="grid grid-cols-[1fr_6rem] gap-3">
                    <div className="space-y-1.5"><Label className="text-xs">Item</Label><Input value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} placeholder="e.g. Logitech wireless mouse" data-testid={`op-item-desc-${i}`} /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Quantity</Label><Input type="number" min={1} value={it.quantity} onChange={(e) => setItem(i, { quantity: Number(e.target.value) })} data-testid={`op-item-qty-${i}`} /></div>
                  </div>
                  <div className="space-y-1.5 pt-0.5 border-t border-border/50">
                    <Label className="text-[11px] text-muted-foreground font-normal pt-2 block">Suggested links <span className="opacity-70">(optional)</span></Label>
                    {(it.suggestedLinks || []).map((lnk, li) => (
                      <div key={li} className="flex items-center gap-1.5">
                        <div className="relative flex-1"><Link2 className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" /><Input value={lnk} onChange={(e) => setItem(i, { suggestedLinks: it.suggestedLinks.map((v, x) => (x === li ? e.target.value : v)) })} placeholder="https://amazon.in/…" className="pl-8" /></div>
                        <button type="button" onClick={() => setItem(i, { suggestedLinks: it.suggestedLinks.filter((_, x) => x !== li) })} className="text-muted-foreground hover:text-[#FF6F62]" aria-label="Remove link"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                    <Button type="button" variant="secondaryB" size="sm" className="h-8 text-xs" onClick={() => setItem(i, { suggestedLinks: [...(it.suggestedLinks || []), ""] })}><Plus className="h-3.5 w-3.5 mr-1" /> Add a link</Button>
                  </div>
                </div>
              ))}
              <Button type="button" variant="secondaryB" size="sm" className="w-full" onClick={() => setItems((a) => [...a, emptyItem()])}><Plus className="h-4 w-4 mr-1.5" /> Add another item</Button>
            </FormSection>

            <Separator />

            <FormSection n={2} title="Justification" hint="(optional)">
              <Textarea rows={3} value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="e.g. Replacing my faulty keyboard for daily work" />
            </FormSection>
          </div>
        )}
      </div>
    </RequestDialog>
  );
}

// ============================ Status stepper ============================
// Four stages. The two approval steps (HR triage + CEO) are collapsed into ONE node:
// employees see "Approval"; approvers (HR/CEO) see "CEO Approval" (their own triage isn't a milestone).
// `cur` is the stage the request is *waiting on* — nodes before it are done, that node is current.
// doneCount = milestones achieved; currentIdx = node in progress (-1 while it's still with HR or fully done).
const OP_DONE_COUNT: Record<string, number> = { pending_hr: 1, priced: 1, pending_approval: 1, under_review: 1, approved: 2, ordered: 3, delivered: 4 };
function Stepper({ status, approver }: { status: string; approver: boolean }) {
  const stages = ["Submitted", approver ? "CEO Approval" : "Approval", "Ordered", "Delivered"];
  const doneCount = OP_DONE_COUNT[status] ?? 0;
  // No node is "current" while it's still with HR (pending_hr / priced) or once fully delivered.
  const currentIdx = ["pending_hr", "priced", "delivered"].includes(status) ? -1 : doneCount;
  return (
    <div className="flex items-center">
      {stages.map((label, i) => {
        const done = i < doneCount;
        const current = i === currentIdx;
        const finished = status === "delivered" && i === stages.length - 1;
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold ${finished ? "bg-[#0E7C7B] text-white" : done ? "bg-[#206295] text-white" : current ? "bg-[#206295]/15 text-[#206295] ring-2 ring-[#206295]" : "bg-muted text-muted-foreground"}`}>
                {done || finished ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className={`text-[10px] whitespace-nowrap ${done || current ? "text-foreground font-medium" : "text-muted-foreground"}`}>{label}</span>
            </div>
            {i < stages.length - 1 && <div className={`h-0.5 flex-1 mx-1 mb-4 rounded ${i < doneCount ? "bg-[#206295]" : "bg-muted"}`} />}
          </div>
        );
      })}
    </div>
  );
}

// Priority chip colors (mirrors the approvals list).
const PRIORITY_CLS: Record<string, string> = {
  high: "bg-[#FF6F62]/15 text-[#FF6F62]",
  medium: "bg-[#206295]/15 text-[#206295]",
  low: "bg-[#64748B]/15 text-[#64748B]",
};

// Employee-entered links often omit the protocol → normalise so the <a> isn't treated as a same-site relative path.
const normalizeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);
// A short, distinguishing label: host + first path segment (so two links to the same host don't read identically).
function linkLabel(u: string) {
  try {
    const url = new URL(normalizeUrl(u));
    const host = url.hostname.replace(/^www\./, "");
    const seg = url.pathname.split("/").filter(Boolean)[0];
    return seg ? `${host}/${seg.slice(0, 16)}` : host;
  } catch { return u; }
}
// Compact link chip: opens the (normalised) URL in a new tab, with a copy-to-clipboard icon.
function LinkChip({ url, label }: { url: string; label?: string }) {
  const { toast } = useToast();
  const href = normalizeUrl(url);
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 pl-2 pr-1 py-0.5 max-w-full">
      <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-[#206295] hover:underline min-w-0">
        <ExternalLink className="h-3 w-3 flex-shrink-0" />
        <span className="truncate max-w-[190px]">{label || linkLabel(url)}</span>
      </a>
      <button type="button" onClick={() => { navigator.clipboard?.writeText(href); toast({ title: "Link copied" }); }} aria-label="Copy link" className="h-5 w-5 rounded inline-flex items-center justify-center text-muted-foreground hover:text-[#206295] hover:bg-background flex-shrink-0"><Copy className="h-3 w-3" /></button>
    </span>
  );
}

// ============================ Detail + role actions dialog ============================
export function OfficePurchaseDetailDialog({ id, open, onClose, onPriced, context = "owner" }: { id: string | null; open: boolean; onClose: () => void; onPriced?: (id: string) => void; context?: "owner" | "approver" }) {
  const { data: auth } = useAuth();
  const role = auth?.user?.role;
  const meId = auth?.user?.id;
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: order } = useQuery<any>({ queryKey: [`/api/office-purchases/${id}`], enabled: !!id && open });

  const [priced, setPriced] = useState<Item[] | null>(null);
  const [priority, setPriority] = useState("medium");
  const [note, setNote] = useState("");
  const [orderInfo, setOrderInfo] = useState("");
  const [expDate, setExpDate] = useState("");
  const [issue, setIssue] = useState("");
  const [purchaseType, setPurchaseType] = useState("online");
  const [vendorName, setVendorName] = useState("");
  const [proforma, setProforma] = useState<UploadedFile | null>(null);
  const [invoice, setInvoice] = useState<UploadedFile | null>(null);

  const act = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: any }) => apiRequest("POST", `/api/office-purchases/${id}/${path}`, body || {}),
    onSuccess: (_d, vars) => {
      invalidate(qc); qc.invalidateQueries({ queryKey: [`/api/office-purchases/${id}`] });
      const MSG: Record<string, string> = { price: "Saved to group", send: "Sent for approval", approve: "Approved", reject: "Rejected", "place-order": "Order marked placed", deliver: "Marked delivered", cancel: "Request cancelled", flag: "Issue reported — support ticket opened" };
      toast({ title: MSG[vars.path] || "Done" });
      setNote(""); setOrderInfo(""); setExpDate(""); setIssue(""); setPriced(null);
      // Saving a price stages it — hand off to the list's grouping flow with this one pre-selected.
      if (vars.path === "price" && onPriced && id) { onPriced(id); onClose(); }
    },
    onError: (e: any) => toast({ title: "Action failed", description: e.message, variant: "destructive" }),
  });

  // Resend a queried (Under Review) item: save the HR edits, then flip it back to the CEO with a resubmitted marker.
  const resendMut = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/office-purchases/${id}/price`, { items: editItems.map((it) => ({ ...it, unitPrice: Number(it.unitPrice) || 0 })), priority, reviewNote: note, purchaseType, vendorName: purchaseType === "vendor" ? vendorName : null, proformaInvoice: purchaseType === "vendor" ? proforma : null });
      return apiRequest("POST", `/api/office-purchases/${id}/resend`, {});
    },
    onSuccess: () => { invalidate(qc); qc.invalidateQueries({ queryKey: [`/api/office-purchases/${id}`] }); toast({ title: "Resent for approval" }); onClose(); },
    onError: (e: any) => toast({ title: "Action failed", description: e.message, variant: "destructive" }),
  });

  // Seed editable fields from the request when it loads.
  useEffect(() => {
    if (!order) return;
    setPriority(order.priority || "medium");
    setPurchaseType(order.purchaseType || "online");
    setVendorName(order.vendorName || "");
    setProforma(order.proformaInvoice || null);
    setInvoice(order.invoice || null);
  }, [order?.id]);

  if (!order) return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Loading…</DialogTitle></DialogHeader>
        <div className="py-12 flex justify-center"><div className="h-6 w-6 rounded-full border-2 border-[#206295]/30 border-t-[#206295] animate-spin" /></div>
      </DialogContent>
    </Dialog>
  );

  const items: Item[] = Array.isArray(order.items) ? order.items : [];
  const isOwner = order.requesterId === meId;
  const canAct = context === "approver"; // triage/approve actions only on the approvals page, never from My Requests
  const approver = canHrTriage(role) || canCeoApprove(role);
  const isHrPriceEdit = canAct && canHrTriage(role) && ["pending_hr", "priced", "under_review"].includes(order.status);
  const editItems = priced ?? items.map((it) => ({ ...it }));
  const setEdit = (i: number, patch: Partial<Item>) => setPriced((prev) => (prev ?? items.map((it) => ({ ...it }))).map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const rows = isHrPriceEdit ? editItems : items;
  const grandTotal = rows.reduce((s, it) => s + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 0), 0);
  const hasLink = editItems.some((it) => (it.finalLink || "").trim());
  const canSend = editItems.length > 0 && editItems.every((it) => Number(it.unitPrice) > 0) && (hasLink || !!proforma);
  const ownerCanCancel = isOwner && ["pending_hr", "pending_approval"].includes(order.status);
  // Suggested links are the employee's proposals — HR (triage) and the requester see them; the CEO only sees the final link.
  const showSuggested = canHrTriage(role) || isOwner;

  // The CEO approves office purchases in the CEO Inbox (CeoReviewModal), not on this HR triage screen. So when the
  // HR editor is active (incl. answering a query on an under_review item), never also show CEO Approve/Reject —
  // that only happened for super_admin (who is both HR and CEO) and produced a confusing "Resend + Approve" footer.
  const showCeoAct = canAct && canCeoApprove(role) && ["pending_approval", "under_review"].includes(order.status) && !isHrPriceEdit;
  const showOrderAct = canAct && canHrTriage(role) && order.status === "approved";
  const showDeliverAct = canAct && canHrTriage(role) && order.status === "ordered";
  const hasFooter = grandTotal > 0 || isHrPriceEdit || showCeoAct || showOrderAct || showDeliverAct;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl w-[calc(100vw-2rem)] max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 flex-shrink-0 border-b border-border">
          <div className="flex items-start justify-between gap-2 pr-6">
            <DialogTitle className="flex items-center gap-2 min-w-0">
              <span className="h-9 w-9 rounded-xl bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0"><ShoppingCart className="h-5 w-5" /></span>
              <span className="truncate">{order.reference}</span>
            </DialogTitle>
            {ownerCanCancel && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 -mt-1 flex-shrink-0 text-muted-foreground" data-testid="op-more"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem className="text-[#FF6F62] focus:text-[#FF6F62]" disabled={act.isPending} onClick={() => { if (window.confirm("Cancel this request? This cannot be undone.")) act.mutate({ path: "cancel" }); }}>Cancel request</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 pb-4 space-y-4">
          {!["rejected", "cancelled"].includes(order.status) && <div className="py-1"><Stepper status={order.status} approver={approver} /></div>}

          {/* Meta — wrapping grid (no amount; the total lives once in the footer) */}
          {(() => {
            const segs: { icon: any; label: string; value: React.ReactNode }[] = [
              { icon: User, label: "Requester", value: `${order.employeeName || "Employee"}${order.employeeCode ? ` | ${order.employeeCode}` : ""}` },
              ...(order.department ? [{ icon: Building2, label: "Department", value: order.department as React.ReactNode }] : []),
              { icon: CalendarClock, label: "Submitted", value: order.createdAt ? format(new Date(order.createdAt), "MMM d, yyyy") : "—" },
              { icon: Clock, label: "Priority", value: <Badge className={`text-[10px] capitalize ${PRIORITY_CLS[order.priority || "medium"] || PRIORITY_CLS.medium}`}>{order.priority || "medium"}</Badge> },
              { icon: CircleCheck, label: "Status", value: <Badge className={`text-[10px] ${statusClass(order.status)}`}>{statusLabel(order.status)}</Badge> },
            ];
            return (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {segs.map((s) => (
                  <div key={s.label} className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><s.icon className="h-3 w-3 flex-shrink-0" /> {s.label}</p>
                    <div className="text-sm font-semibold text-foreground mt-1 break-words leading-snug">{s.value}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Employee's note */}
          {(canHrTriage(role) || isOwner) && order.justification && (
            <div className="flex items-start gap-2 rounded-xl bg-muted/40 px-3 py-2.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Employee's note</p>
                <p className="text-sm text-foreground/90 mt-0.5 break-words">{order.justification}</p>
              </div>
            </div>
          )}

          {/* HR pricing setup — chosen FIRST; drives whether items show a link field */}
          {isHrPriceEdit && (
            <div className="rounded-xl border border-[#206295]/30 bg-[#206295]/[0.05] p-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-[11px]">Purchase type</Label>
                  <Select value={purchaseType} onValueChange={setPurchaseType}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="online">Online (Amazon)</SelectItem><SelectItem value="vendor">Offline (Vendor)</SelectItem></SelectContent></Select>
                </div>
                <div className="space-y-1"><Label className="text-[11px]">Priority</Label>
                  <Select value={priority} onValueChange={setPriority}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent></Select>
                </div>
              </div>
              {purchaseType === "vendor" && (
                <div className="space-y-2">
                  <div className="space-y-1"><Label className="text-[11px]">Vendor</Label><Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Vendor name" className="h-9" /></div>
                  <div className="space-y-1"><Label className="text-[11px]">Proforma invoice</Label><FileUpload value={proforma} onChange={setProforma} label="Upload proforma" /></div>
                </div>
              )}
              <div className="space-y-1"><Label className="text-[11px]">Note (optional)</Label><Input value={note} onChange={(e) => setNote(e.target.value)} className="h-9" placeholder="Internal note for the CEO" /></div>
              <p className="text-[11px] text-muted-foreground">{purchaseType === "vendor" ? "Upload the vendor's proforma (or add a product link on an item)." : "Add a product link on at least one item."} Enter a unit price for every item.</p>
            </div>
          )}

          <Separator />

          {/* Items — link field only for Online */}
          <div className="space-y-2">
            {rows.map((it, i) => {
              const lineTotal = (Number(it.unitPrice) || 0) * (Number(it.quantity) || 0);
              const suggested = (it.suggestedLinks || []).filter(Boolean);
              return (
                <div key={i} className="rounded-xl border border-border/60 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground min-w-0 truncate">{it.description || `Item ${i + 1}`} <span className="text-muted-foreground font-normal">× {it.quantity}</span></p>
                    {lineTotal > 0 && <span className="text-sm font-semibold text-foreground flex-shrink-0">{money(lineTotal)}</span>}
                  </div>
                  {showSuggested && suggested.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-medium text-muted-foreground flex-shrink-0">Suggested:</span>
                      {suggested.map((l, li) => <LinkChip key={li} url={l} />)}
                    </div>
                  )}
                  {it.finalLink && !isHrPriceEdit && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-medium text-muted-foreground flex-shrink-0">Link:</span>
                      <LinkChip url={it.finalLink} />
                    </div>
                  )}
                  {isHrPriceEdit && (
                    <div className={`grid gap-2 items-end min-w-0 pt-0.5 ${purchaseType === "online" ? "grid-cols-[1fr_7rem]" : "grid-cols-[7rem]"}`}>
                      {purchaseType === "online" && <div className="space-y-1 min-w-0"><Label className="text-[11px]">Product link</Label><Input value={it.finalLink || ""} onChange={(e) => setEdit(i, { finalLink: e.target.value })} placeholder="Amazon link" className="h-9" /></div>}
                      <div className="space-y-1 min-w-0"><Label className="text-[11px]">Unit price (₹)</Label><Input type="number" min={0} value={it.unitPrice ?? ""} onChange={(e) => setEdit(i, { unitPrice: Number(e.target.value) })} className="h-9" placeholder="0" /></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {order.orderInfo && <p className="text-xs text-muted-foreground inline-flex items-center gap-1"><Truck className="h-3.5 w-3.5 flex-shrink-0" /> {order.orderInfo}</p>}
          {order.expectedDeliveryDate && <p className="text-xs text-muted-foreground inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5 flex-shrink-0" /> Expected delivery {format(new Date(order.expectedDeliveryDate), "MMM d, yyyy")}</p>}
          {order.linkedTicketId && <p className="text-xs text-[#FF6F62] inline-flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" /> An issue was flagged (support ticket opened).</p>}

          {/* Type + documents + payment (once priced) */}
          {order.status !== "pending_hr" && (
            <div className="rounded-xl border border-border/60 p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="text-[10px] bg-[#206295]/10 text-[#206295]">{order.purchaseType === "vendor" ? "Offline (Vendor)" : "Online (Amazon)"}</Badge>
                {order.vendorName && <span className="text-xs text-muted-foreground">{order.vendorName}</span>}
                {order.paymentStatus && <Badge className={`text-[10px] ${order.paymentStatus === "paid" ? "bg-[#4BDCD9]/25 text-[#0E7C7B]" : "bg-[#FFA962]/25 text-[#D98324]"}`}>{order.paymentStatus === "paid" ? "Paid" : "Payment pending"}</Badge>}
              </div>
              {order.proformaInvoice?.fileData && <a href={order.proformaInvoice.fileData} download={order.proformaInvoice.fileName} className="text-xs text-[#206295] hover:underline inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Proforma | {order.proformaInvoice.fileName}</a>}
              {order.invoice?.fileData && <a href={order.invoice.fileData} download={order.invoice.fileName} className="text-xs text-[#206295] hover:underline inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Invoice | {order.invoice.fileName}</a>}
            </div>
          )}

          {/* Discussion — only when the CEO has actually started a thread */}
          {(order.comments || []).length > 0 && (
            <div className="rounded-xl border border-border p-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Discussion</p>
              <CommentThread basePath="/api/office-purchases" id={order.id} comments={order.comments || []} invalidateKey="/api/office-purchases" meId={meId} />
            </div>
          )}

          {/* CEO decision note (Approve/Reject buttons in the footer) */}
          {showCeoAct && (
            <div className="space-y-1"><Label className="text-[11px]">Decision note (optional)</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the requester / HR" className="h-9" /></div>
          )}

          {/* HR place-order inputs (button in the footer) */}
          {showOrderAct && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1 min-w-0"><Label className="text-[11px]">Order / tracking info (optional)</Label><Input value={orderInfo} onChange={(e) => setOrderInfo(e.target.value)} className="h-9" /></div>
                <div className="space-y-1 min-w-0"><Label className="text-[11px]">Expected delivery (optional)</Label><DateInput value={expDate} onChange={(v) => setExpDate(v)} className="h-9" /></div>
              </div>
              <div className="space-y-1"><Label className="text-[11px]">Invoice (goes to Finance)</Label><FileUpload value={invoice} onChange={setInvoice} label="Upload invoice" /></div>
            </div>
          )}

          {/* Owner: flag a delivery issue */}
          {isOwner && order.status === "delivered" && !order.linkedTicketId && (
            <div className="rounded-xl border border-border p-3 space-y-2">
              <Label className="text-xs">Something wrong? Report an issue (opens a support ticket)</Label>
              <Textarea rows={2} value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="Describe what's wrong…" />
              <Button variant="outline" className="w-full" disabled={act.isPending || !issue.trim()} onClick={() => act.mutate({ path: "flag", body: { issue } })}><AlertTriangle className="h-4 w-4 mr-1.5" /> Report an issue</Button>
            </div>
          )}
        </div>

        {/* Fixed footer — the total shown ONCE + the primary action(s) */}
        {hasFooter && (
          <div className="flex-shrink-0 border-t border-border px-6 py-3 flex items-center gap-2 justify-end bg-background">
            {grandTotal > 0 && <div className="mr-auto flex items-baseline gap-2"><span className="text-xl font-bold text-[#206295] tabular-nums">{money(grandTotal)}</span><span className="text-xs text-muted-foreground">total</span></div>}
            {isHrPriceEdit && (order.status === "under_review"
              ? <Button className="btn-primary-gradient" disabled={!canSend || resendMut.isPending} data-testid="op-resend" onClick={() => resendMut.mutate()}>Resend to CEO</Button>
              : <Button className="btn-primary-gradient" disabled={!canSend || act.isPending} data-testid="op-save-group" onClick={() => act.mutate({ path: "price", body: { items: editItems.map((it) => ({ ...it, unitPrice: Number(it.unitPrice) || 0 })), priority, reviewNote: note, purchaseType, vendorName: purchaseType === "vendor" ? vendorName : null, proformaInvoice: purchaseType === "vendor" ? proforma : null } })}>Save &amp; add to group</Button>
            )}
            {showCeoAct && <>
              <Button variant="outline" className="text-[#FF6F62] border-[#FF6F62]/40" disabled={act.isPending} onClick={() => act.mutate({ path: "reject", body: { note } })}>Reject</Button>
              <Button className="btn-primary-gradient" disabled={act.isPending} onClick={() => act.mutate({ path: "approve", body: { note } })}><CircleCheck className="h-4 w-4 mr-1.5" /> Approve</Button>
            </>}
            {showOrderAct && <Button className="btn-primary-gradient" disabled={act.isPending} onClick={() => act.mutate({ path: "place-order", body: { orderInfo, expectedDeliveryDate: expDate || null, invoice } })}><Truck className="h-4 w-4 mr-1.5" /> Mark order placed</Button>}
            {showDeliverAct && <Button className="btn-primary-gradient" disabled={act.isPending} onClick={() => act.mutate({ path: "deliver" })}><CircleCheck className="h-4 w-4 mr-1.5" /> Mark delivered</Button>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================ Approvals / queue list (HR + CEO) ============================
// Compact card that lists office purchases needing attention and opens the detail dialog.
