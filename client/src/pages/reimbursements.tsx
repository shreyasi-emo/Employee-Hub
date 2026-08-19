import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Check, X, ExternalLink, ChevronLeft, FileText } from "lucide-react";
import { format } from "date-fns";
import { ReimbursementFormDialog } from "@/features/requests/reimbursements/components/reimbursement-form";
import { statusClass, statusLabel } from "@/lib/status";

const CATEGORIES = ["Travel", "Food & Meals", "Office Supplies", "Software", "Training", "Other"];

export function StatusBadge({ status }: { status: string }) {
  return <Badge className={`text-xs ${statusClass(status)}`}>{statusLabel(status)}</Badge>;
}

function money(v: any) {
  const n = parseFloat(v || "0");
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ReimbursementRow({ r, requesterName, actions }: { r: any; requesterName?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3" data-testid={`reimb-${r.id}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">{r.reference}</span>
          <StatusBadge status={r.status} />
          <Badge variant="secondary" className="text-xs">{r.category}</Badge>
        </div>
        {(r.businessPurpose || r.description) && <p className="text-sm text-foreground/80 mt-1 line-clamp-2">{r.businessPurpose || r.description}</p>}
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
          {requesterName && <span>By {requesterName}{r.employeeCode ? ` (${r.employeeCode})` : ""}</span>}
          {r.department && <span>| {r.department}</span>}
          {r.hodName && <span>| HOD: {r.hodName}</span>}
          {r.periodFrom && <span>| {format(new Date(r.periodFrom), "MMM d")}{r.periodTo && r.periodTo !== r.periodFrom ? ` – ${format(new Date(r.periodTo), "MMM d, yyyy")}` : `, ${format(new Date(r.periodFrom), "yyyy")}`}</span>}
          {r.decisionNote && <span className="italic">Note: {r.decisionNote}</span>}
        </div>
        {/* Itemised expense lines with stored invoices */}
        {Array.isArray(r.lines) && r.lines.length > 0 && (
          <div className="mt-2 border border-border rounded-[10px] px-3 list-divider">
            {r.lines.map((ln: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between gap-3 py-1.5 text-xs">
                <div className="min-w-0 truncate">
                  <span className="text-foreground">{ln.description || "Item"}</span>
                  {ln.nature && <span className="text-muted-foreground"> | {ln.nature}</span>}
                  {ln.invoiceNo && <span className="text-muted-foreground"> | {ln.invoiceNo}</span>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {ln.fileData && <a href={ln.fileData} target="_blank" rel="noreferrer" className="text-[#206295] inline-flex items-center gap-1 hover:underline"><FileText className="h-3 w-3" /> Invoice</a>}
                  <span className="font-medium text-foreground">{money(ln.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {Number(r.cashAdvance) > 0 && <p className="text-xs text-muted-foreground mt-1">Less cash advance: {money(r.cashAdvance)}</p>}
        {r.invoiceUrl && (
          <a href={r.invoiceUrl} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 hover:underline mt-1">
            <ExternalLink className="h-3 w-3" /> View invoice
          </a>
        )}
      </div>
      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        <span className="text-base font-bold text-foreground">{money(r.totalAmount)}</span>
        {actions}
      </div>
    </div>
  );
}

function ApprovalActions({ id }: { id: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const decide = useMutation({
    mutationFn: (action: "approve" | "reject") => apiRequest("POST", `/api/reimbursements/${id}/${action}`, { note: note.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/reimbursements") });
      setNote("");
      toast({ title: "Decision recorded" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  return (
    <div className="flex flex-col items-end gap-2 w-full max-w-xs">
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Remarks (required to reject)" className="h-8 text-xs" data-testid={`reimb-note-${id}`} />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="text-[#FF6F62] border-[#FF6F62]/30" onClick={() => { if (!note.trim()) { toast({ title: "Add a remark to reject", variant: "destructive" }); return; } decide.mutate("reject"); }} disabled={decide.isPending} data-testid={`reimb-reject-${id}`}>
          <X className="h-3.5 w-3.5 mr-1" /> Reject
        </Button>
        <Button size="sm" onClick={() => decide.mutate("approve")} disabled={decide.isPending} data-testid={`reimb-approve-${id}`}>
          <Check className="h-3.5 w-3.5 mr-1" /> Approve
        </Button>
      </div>
    </div>
  );
}

// Finance hub — office-purchase invoices/proformas + record vendor payments (#6).
function PurchaseInvoicesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: ops = [] } = useQuery<any[]>({ queryKey: ["/api/office-purchases/invoices"] });
  const relevant = (ops as any[]).filter((o) => o.paymentStatus || o.invoice?.fileData || o.proformaInvoice?.fileData);
  const due = relevant.filter((o) => o.paymentStatus === "pending");
  const records = relevant.filter((o) => o.paymentStatus !== "pending");
  const [refs, setRefs] = useState<Record<string, string>>({});
  const money = (v: any) => `₹${Number(v || 0).toLocaleString("en-IN")}`;
  const pay = useMutation({
    mutationFn: ({ id, paymentRef }: { id: string; paymentRef: string }) => apiRequest("POST", `/api/office-purchases/${id}/pay`, { paymentRef }),
    onSuccess: () => { qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/office-purchases") }); toast({ title: "Payment recorded" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const doc = (f: any, label: string) => f?.fileData ? <a href={f.fileData} download={f.fileName} className="text-xs text-[#206295] hover:underline inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {label}</a> : null;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Vendor payments due{due.length ? ` (${due.length})` : ""}</CardTitle><p className="text-xs text-muted-foreground">Pay the vendor from the proforma, then record it here.</p></CardHeader>
        <CardContent>
          {due.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">No payments due.</p> : (
            <div className="divide-y divide-border">
              {due.map((o) => (
                <div key={o.id} className="py-3 flex items-center gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{o.reference} <span className="font-normal text-muted-foreground">| {o.vendorName || "Vendor"}</span></p>
                    <p className="text-xs text-muted-foreground">{o.employeeName || "Employee"}</p>
                    <div className="flex gap-3 mt-1">{doc(o.proformaInvoice, "Proforma")}{doc(o.invoice, "Invoice")}</div>
                  </div>
                  <span className="text-base font-bold text-[#206295] tabular-nums">{money(o.totalAmount)}</span>
                  <div className="flex items-center gap-2">
                    <Input value={refs[o.id] || ""} onChange={(e) => setRefs((p) => ({ ...p, [o.id]: e.target.value }))} placeholder="Payment ref (optional)" className="h-9 w-40" />
                    <Button size="sm" className="btn-primary-gradient" disabled={pay.isPending} onClick={() => pay.mutate({ id: o.id, paymentRef: refs[o.id] || "" })}><Check className="h-4 w-4 mr-1.5" /> Mark paid</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Invoices</CardTitle><p className="text-xs text-muted-foreground">All purchase invoices, for records.</p></CardHeader>
        <CardContent>
          {records.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">No invoices yet.</p> : (
            <div className="divide-y divide-border">
              {records.map((o) => (
                <div key={o.id} className="py-3 flex items-center gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{o.reference} <span className="font-normal text-muted-foreground">| {o.purchaseType === "vendor" ? (o.vendorName || "Vendor") : "Online"}</span></p>
                    <p className="text-xs text-muted-foreground">{o.employeeName || "Employee"} | {money(o.totalAmount)}</p>
                    <div className="flex gap-3 mt-1">{doc(o.proformaInvoice, "Proforma")}{doc(o.invoice, "Invoice")}</div>
                  </div>
                  {o.paymentStatus === "paid" && <Badge className="text-[10px] bg-[#4BDCD9]/25 text-[#0E7C7B]">Paid{o.paymentRef ? ` | ${o.paymentRef}` : ""}</Badge>}
                  <Badge className={`text-[10px] ${statusClass(o.status)}`}>{statusLabel(o.status)}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ReimbursementsPage() {
  const { data: auth } = useAuth();
  // Finance reimbursement stage = finance / super_admin only (matches the backend). HR is NOT finance here.
  const finance = ["finance", "super_admin"].includes(auth?.user?.role || "");

  const { data: mine = [], isLoading: mineLoading } = useQuery<any[]>({ queryKey: ["/api/reimbursements"] });
  const { data: pending = [] } = useQuery<any[]>({
    queryKey: ["/api/reimbursements?status=submitted"],
    enabled: finance,
  });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"], enabled: finance });
  const nameByUserId = new Map<string, string>(
    employees.map((e: any) => [e.userId, `${e.firstName} ${e.lastName}`]),
  );
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="p-6 space-y-6 max-w-[92rem] mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="icon" className="h-10 w-10 flex-shrink-0" onClick={() => window.history.back()} aria-label="Back" data-testid="button-back">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reimbursements</h1>
            <p className="text-sm text-muted-foreground">Claim expenses and track their approval status</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)} data-testid="button-new-reimbursement"><Plus className="h-4 w-4 mr-1" /> New Reimbursement</Button>
      </div>

      <ReimbursementFormDialog open={showForm} onClose={() => setShowForm(false)} />

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine" data-testid="tab-my-reimb">My Reimbursements</TabsTrigger>
          {finance && (
            <TabsTrigger value="approvals" data-testid="tab-reimb-approvals">
              Finance Approvals{pending.length > 0 ? ` (${pending.length})` : ""}
            </TabsTrigger>
          )}
          {finance && <TabsTrigger value="purchase-invoices" data-testid="tab-purchase-invoices">Purchase Invoices</TabsTrigger>}
        </TabsList>

        <TabsContent value="mine" className="space-y-6 mt-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">My Requests</CardTitle></CardHeader>
            <CardContent>
              {mineLoading ? (
                <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
              ) : mine.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No reimbursements yet.</p>
              ) : (
                <div className="divide-y divide-border">
                  {mine.map((r) => <ReimbursementRow key={r.id} r={r} />)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {finance && (
          <TabsContent value="approvals" className="mt-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Pending Finance Approval</CardTitle><p className="text-xs text-muted-foreground">Approve to forward to CEO for final approval.</p></CardHeader>
              <CardContent>
                {pending.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Nothing awaiting finance approval.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {pending.map((r) => (
                      <ReimbursementRow
                        key={r.id}
                        r={r}
                        requesterName={nameByUserId.get(r.requesterId) || "Unknown"}
                        actions={<ApprovalActions id={r.id} />}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {finance && (
          <TabsContent value="purchase-invoices" className="mt-4">
            <PurchaseInvoicesTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
