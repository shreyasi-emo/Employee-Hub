import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { RequestDialog } from "@/components/shared/request-dialog";
import { DateInput } from "@/components/shared/datetime-field";
import { Plus, Trash2, Upload, FileText, X, Save } from "lucide-react";

const NATURE_OPTIONS = [
  "Travel & Conveyance",
  "Office Supplies & Stationery",
  "Admin & Maintenance",
  "Production / R&D / Lab Expenses",
  "Logistics & Transportation",
  "Other",
];

const ACCEPT = "image/jpeg,image/png,application/pdf";
const money = (n: number) => `₹${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const toISO = (d?: Date) => (d ? d.toISOString().split("T")[0] : null);

type Item = { invoiceNo: string; invoiceDate: string; description: string; nature: string; amount: string; fileName?: string; fileType?: string; fileData?: string };
const blankItem = (): Item => ({ invoiceNo: "", invoiceDate: "", description: "", nature: "", amount: "", fileName: undefined, fileType: undefined, fileData: undefined });

// Attendance-style date picker: single "From" date, with an "End date" toggle for a range
// All item fields are mandatory, including the uploaded invoice
export function itemComplete(it: any) {
  return !!(it.invoiceNo?.trim() && it.invoiceDate && it.description?.trim() && it.nature && Number(it.amount) > 0 && it.fileData);
}

// Mandatory-field check for a reimbursement draft (mirrors the form's own submit gate).
export function reimbDraftComplete(data: any) {
  const items: any[] = Array.isArray(data?.items) ? data.items : [];
  return !!(data?.businessPurpose?.trim() && data?.periodFrom && items.length > 0 && items.every(itemComplete));
}

export function ReimbursementFormDialog({ open, onClose, onSuccess, initialData, onSaveDraft, reimbursementId, decisionNote, editable, autoValidate }: { open: boolean; onClose: () => void; onSuccess?: () => void; initialData?: any; onSaveDraft?: (data: any) => void; reimbursementId?: string; decisionNote?: string; editable?: { fields: string[]; lines: number[] }; autoValidate?: boolean }) {
  const isResubmit = !!reimbursementId;
  // Field- and line-editability are scoped INDEPENDENTLY: scoping specific line items must NOT lock the header fields (and vice-versa).
  const hasFieldScope = isResubmit && !!editable && (editable.fields?.length || 0) > 0;
  const hasLineScope = isResubmit && !!editable && (editable.lines?.length || 0) > 0;
  const hasScope = hasFieldScope || hasLineScope;
  const canEditField = (k: string) => !hasFieldScope || editable!.fields.includes(k);
  const canEditLine = (i: number) => !hasLineScope || editable!.lines.includes(i);
  const { toast } = useToast();
  const qc = useQueryClient();

  const [businessPurpose, setBusinessPurpose] = useState("");
  const [period, setPeriod] = useState<{ from?: Date; to?: Date }>({});
  const [items, setItems] = useState<Item[]>([blankItem()]);
  const [cashAdvance, setCashAdvance] = useState("");
  const [tried, setTried] = useState(false); // once true, incomplete required fields get a red border

  // Prefill once per open (from a draft); reset on open when there's no draft.
  const prefilled = useRef(false);
  useEffect(() => {
    if (!open) { prefilled.current = false; return; }
    if (prefilled.current) return;
    prefilled.current = true;
    if (initialData) {
      setBusinessPurpose(initialData.businessPurpose || "");
      const from = initialData.periodFrom ? new Date(initialData.periodFrom) : undefined;
      const to = initialData.periodTo ? new Date(initialData.periodTo) : from;
      setPeriod({ from, to });
      setItems(Array.isArray(initialData.items) && initialData.items.length ? initialData.items : [blankItem()]);
      setCashAdvance(initialData.cashAdvance != null ? String(initialData.cashAdvance) : "");
    }
  }, [open, initialData]);

  // Opened from an incomplete draft "Submit": surface the validation state immediately (coral borders + messages).
  useEffect(() => { if (open && autoValidate) setTried(true); }, [open, autoValidate]);

  const serialize = () => ({
    businessPurpose,
    periodFrom: toISO(period.from),
    periodTo: period.to && period.from && +period.to !== +period.from ? toISO(period.to) : null,
    items,
    cashAdvance,
  });

  const subTotal = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const advance = Number(cashAdvance) || 0;
  const net = subTotal - advance;
  const errCls = (bad: boolean) => (tried && bad ? "border-[#FF6F62] focus-visible:ring-[#FF6F62]" : "");
  const fieldErr = (bad: boolean, msg: string) => (tried && bad ? <p className="text-[11px] text-[#FF6F62] mt-0.5">{msg}</p> : null);

  const reset = () => { setBusinessPurpose(""); setPeriod({}); setItems([blankItem()]); setCashAdvance(""); setTried(false); };
  const handleClose = () => { reset(); onClose(); };

  const setItem = (idx: number, patch: Partial<Item>) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  // Items can be added freely; completeness is only enforced on submit.
  function addItem() {
    setItems((p) => [...p, blankItem()]);
  }

  async function onFile(idx: number, file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "application/pdf"].includes(file.type)) {
      toast({ title: "Unsupported file", description: "Only JPG, PNG or PDF are allowed.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum size is 5 MB.", variant: "destructive" });
      return;
    }
    const dataUrl: string = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
    setItem(idx, { fileName: file.name, fileType: file.type, fileData: dataUrl });
  }

  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/reimbursements", {
      businessPurpose,
      periodFrom: toISO(period.from),
      periodTo: period.to && period.from && +period.to !== +period.from ? toISO(period.to) : null,
      category: items.length === 1 && items[0].nature ? items[0].nature : "Mixed",
      totalAmount: String(subTotal),
      cashAdvance: String(advance),
      currency: "INR",
      description: businessPurpose,
      lines: items.map((it) => ({
        invoiceNo: it.invoiceNo || null, invoiceDate: it.invoiceDate || null, description: it.description,
        nature: it.nature, amount: Number(it.amount) || 0, fileName: it.fileName || null, fileType: it.fileType || null, fileData: it.fileData || null,
      })),
    }),
    onSuccess: () => {
      // Refresh every reimbursement query (My Requests, approver list, recent activities, etc.)
      qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/reimbursements") });
      qc.invalidateQueries({ queryKey: ["/api/my-requests/summary"] });
      toast({ title: "Reimbursement submitted" });
      reset(); onSuccess?.(); onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resubmitMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/reimbursements/${reimbursementId}/resubmit`, {
      businessPurpose,
      periodFrom: toISO(period.from),
      periodTo: period.to && period.from && +period.to !== +period.from ? toISO(period.to) : null,
      category: items.length === 1 && items[0].nature ? items[0].nature : "Mixed",
      totalAmount: String(subTotal),
      cashAdvance: String(advance),
      lines: items.map((it) => ({ invoiceNo: it.invoiceNo || null, invoiceDate: it.invoiceDate || null, description: it.description, nature: it.nature, amount: Number(it.amount) || 0, fileName: it.fileName || null, fileType: it.fileType || null, fileData: it.fileData || null })),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/reimbursements") });
      qc.invalidateQueries({ queryKey: ["/api/my-requests/summary"] });
      toast({ title: "Reimbursement resubmitted for review" });
      reset(); onSuccess?.(); onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const ok = businessPurpose.trim() && period.from && items.every(itemComplete);
    if (!ok) { setTried(true); return; }
    setTried(false);
    if (isResubmit) resubmitMutation.mutate(); else mutation.mutate();
  }

  return (
    <RequestDialog
      open={open}
      onClose={handleClose}
      title={isResubmit ? "Edit & Resubmit Claim" : "New Reimbursement Claim"}
      size="xl"
      footer={<>
        <Button type="button" variant="outline" onClick={handleClose} data-testid="button-cancel-reimbursement">Cancel</Button>
        {onSaveDraft && !isResubmit && (
          <Button type="button" variant="secondary" className="btn-glass text-[#206295]" onClick={() => { onSaveDraft(serialize()); handleClose(); }} data-testid="button-draft-reimbursement">
            <Save className="h-4 w-4 mr-1.5" /> Save as Draft
          </Button>
        )}
        {isResubmit
          ? <Button type="submit" form="reimbursement-claim-form" disabled={resubmitMutation.isPending} data-testid="button-resubmit-reimbursement">{resubmitMutation.isPending ? "Resubmitting…" : "Resubmit Claim"}</Button>
          : <Button type="submit" form="reimbursement-claim-form" disabled={mutation.isPending} data-testid="button-submit-reimbursement">{mutation.isPending ? "Submitting…" : "Submit Claim"}</Button>}
      </>}
    >
      <form id="reimbursement-claim-form" onSubmit={submit} className="space-y-6 px-6 pb-6">
        {/* Decision note banner (resubmit) */}
        {isResubmit && decisionNote && (
          <div className="rounded-[16px] border border-[#FF6F62]/40 bg-[#FF6F62]/[0.06] p-3.5">
            <p className="text-xs font-semibold text-[#FF6F62] uppercase tracking-wide mb-1">Changes requested</p>
            <p className="text-sm text-foreground">{decisionNote}</p>
            {hasScope && <p className="text-[11px] text-muted-foreground mt-1.5">The items to update are highlighted below.</p>}
          </div>
        )}
        {/* Business purpose + period */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Business Purpose</Label>
            <Input value={businessPurpose} onChange={(e) => setBusinessPurpose(e.target.value)} disabled={!canEditField("businessPurpose")} placeholder="e.g. Client visit — Mumbai" className={errCls(!businessPurpose.trim())} data-testid="input-business-purpose" />
            {fieldErr(!businessPurpose.trim(), "This field is mandatory")}
          </div>
          <div className="space-y-1.5">
            <Label>Expense Period</Label>
            <div className={`rounded-[16px] ${!canEditField("period") ? "opacity-60 pointer-events-none" : ""} ${tried && !period.from ? "ring-1 ring-[#FF6F62]" : ""}`}><DateRangePicker value={period} onChange={setPeriod} triggerClassName="w-full justify-start" testId="button-expense-period" /></div>
            {fieldErr(!period.from, "Please select the From date")}
          </div>
        </div>

        {/* Items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Expense Items</Label>
            <span className="text-xs text-muted-foreground">{items.length} item{items.length !== 1 ? "s" : ""}</span>
          </div>
          {items.map((it, i) => (
            <div key={i} className={`rounded-[16px] border p-3 space-y-3 bg-muted/30 ${isResubmit && !canEditLine(i) ? "opacity-60 pointer-events-none border-border" : hasLineScope && canEditLine(i) ? "border-[#206295]/50 ring-1 ring-[#206295]/30" : "border-border"}`} data-testid={`reimb-item-${i}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Item {i + 1}</span>
                {!isResubmit && (
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => items.length > 1 && setItems((p) => p.filter((_, idx) => idx !== i))} aria-label="Remove item">
                    <Trash2 className="h-3.5 w-3.5 text-[#FF6F62]" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><p className="text-xs text-muted-foreground">Invoice No.</p><Input value={it.invoiceNo} onChange={(e) => setItem(i, { invoiceNo: e.target.value })} placeholder="INV-1234" className={`h-9 ${errCls(!it.invoiceNo.trim())}`} />{fieldErr(!it.invoiceNo.trim(), "Invoice No. is required")}</div>
                <div className="space-y-1"><p className="text-xs text-muted-foreground">Invoice Date</p><DateInput value={it.invoiceDate} onChange={(v) => setItem(i, { invoiceDate: v })} className={`h-9 ${errCls(!it.invoiceDate)}`} />{fieldErr(!it.invoiceDate, "Invoice date is required")}</div>
              </div>
              <div className="space-y-1"><p className="text-xs text-muted-foreground">Description</p><Input value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} placeholder="What was this expense for?" className={`h-9 ${errCls(!it.description.trim())}`} />{fieldErr(!it.description.trim(), "Description is required")}</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Nature of Expense</p>
                  <Select value={it.nature} onValueChange={(v) => setItem(i, { nature: v })}>
                    <SelectTrigger className={`h-9 ${errCls(!it.nature)}`} data-testid={`select-nature-${i}`}><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{NATURE_OPTIONS.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                  </Select>
                  {fieldErr(!it.nature, "Please select a nature")}
                </div>
                <div className="space-y-1"><p className="text-xs text-muted-foreground">Amount (₹)</p><Input type="number" min="0" step="0.01" value={it.amount} onChange={(e) => setItem(i, { amount: e.target.value })} placeholder="0.00" className={`h-9 ${errCls(!(Number(it.amount) > 0))}`} data-testid={`input-amount-${i}`} />{fieldErr(!(Number(it.amount) > 0), "Enter a valid amount")}</div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Upload Invoice <span className="opacity-70">(JPG, PNG, PDF · max 5 MB)</span></p>
                {it.fileData ? (
                  <div className="flex items-center gap-2 h-10 rounded-[16px] border border-border bg-background px-3">
                    <FileText className="h-4 w-4 text-[#206295] flex-shrink-0" />
                    <a href={it.fileData} target="_blank" rel="noreferrer" className="text-sm text-foreground truncate flex-1 hover:underline">{it.fileName}</a>
                    <button type="button" onClick={() => setItem(i, { fileName: undefined, fileType: undefined, fileData: undefined })} aria-label="Remove file"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                  </div>
                ) : (
                  <label className={`flex items-center gap-2 h-10 rounded-[16px] border bg-background px-3 cursor-pointer hover-elevate ${tried && !it.fileData ? "border-[#FF6F62]" : "border-border"}`}>
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Choose file…</span>
                    <input type="file" accept={ACCEPT} className="hidden" onChange={(e) => onFile(i, e.target.files?.[0])} data-testid={`upload-invoice-${i}`} />
                  </label>
                )}
                {fieldErr(!it.fileData, "Please upload the invoice")}
              </div>
            </div>
          ))}
          {!isResubmit && (
            <Button type="button" variant="secondaryB" size="sm" className="w-full" style={{ borderRadius: "16px" }} onClick={addItem} data-testid="button-add-item">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Item
            </Button>
          )}
        </div>

        {/* Bill summary */}
        <div className="rounded-[16px] border border-border p-4 bg-muted/30 space-y-2 ml-auto sm:w-72">
          <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Sub Total</span><span className="font-semibold text-foreground">{money(subTotal)}</span></div>
          <div className="flex items-center justify-between text-sm gap-3">
            <span className="text-muted-foreground whitespace-nowrap">Less: Cash Advance</span>
            <Input type="number" min="0" step="0.01" value={cashAdvance} onChange={(e) => setCashAdvance(e.target.value)} disabled={!canEditField("cashAdvance")} placeholder="0.00" className="h-8 w-28 text-right" data-testid="input-cash-advance" />
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-sm font-medium text-foreground">{net >= 0 ? "Payable to Employee" : "Receivable from Employee"}</span>
            <span className={`text-base font-bold ${net >= 0 ? "text-[#206295]" : "text-[#FF6F62]"}`}>{money(Math.abs(net))}</span>
          </div>
        </div>

      </form>
    </RequestDialog>
  );
}
