import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShoppingCart, Plane, Receipt, Package, ChevronLeft, Check, Eye } from "lucide-react";
import { TravelApprovals } from "@/features/company-workspace/travel/components/travel";
import { money } from "../shared/approval-format";
import { ReimbApprovals } from "../components/reimb-approvals";
import { CompletedApprovals } from "../components/completed-approvals";
import { CeoReviewModal } from "../components/ceo-review-modal";
import { OfficePurchaseApprovals } from "../office-purchases/components/office-purchase-approvals";
import { useWorkspaceData } from "../api/workspace.api";

// /my-approvals — what is awaiting YOUR decision. Also /workspace/approvals, the same screen
// in CEO Inbox mode where a super_admin acts for the CEO. The CEO sees bulk category cards;
// every other approver gets a tab strip ordered by pending count.
export default function MyApprovalsPage() {
  const [, navigate] = useLocation();
  const {
    reimb, opAll, procAll, travelAll, nameByUser, reqName,
    canReimbApprove, canCeoReimb, canOpTriage, canOfficePurchase, canProc, canTravelApprove,
    actingCeo, isCeo, financeReimbQueue, ceoReimbQueue,
    officeTriageCount, travelPending,
  } = useWorkspaceData("approvals");

  const [apprView, setApprView] = useState<"pending" | "completed">("pending");
  const [apprTab, setApprTab] = useState<string>("");
  const [travelModal, setTravelModal] = useState(false);
  const [reimbModal, setReimbModal] = useState(false);
  const [batchCat, setBatchCat] = useState<any>(null);

  // In-place bulk-approval inbox — one card per pure approve/reject category, actioned in a modal (no screen jump).
  // Reimbursement card = CEO-stage only (finance_approved); finance-stage (submitted) is first-layer, NOT the CEO's —
  // so the CEO Inbox (super_admin acting as CEO) shows exactly what the CEO sees, never leaks finance-stage claims.
  const opPend = (opAll as any[]).filter((o) => o.status === "pending_approval");
  const procPend = (procAll as any[]).filter((o) => o.status === "pending_approval");
  const opUR = (opAll as any[]).filter((o) => o.status === "under_review");
  const procUR = (procAll as any[]).filter((o) => o.status === "under_review");
  const travelPend = (travelAll as any[]).filter((t) => ["pending_approval", "under_review"].includes(t.status));
  const amtSum = (arr: any[], k = "totalAmount") => arr.reduce((s, x) => s + (Number(x[k]) || 0), 0);
  // Main inbox = ONE card per category (total ₹ + count, irrespective of HR grouping); the drill modal shows groups/items.
  const catCards = ([
    ceoReimbQueue.length ? { key: "reimbursements", label: "Reimbursements", icon: Receipt, count: ceoReimbQueue.length, total: amtSum(ceoReimbQueue), cfg: { kind: "reimb" } } : null,
    opPend.length ? { key: "office_purchases", label: "Office Purchases", icon: ShoppingCart, count: opPend.length, total: amtSum(opPend),
      cfg: { title: "Office Purchases", kind: "office", grouped: true, basePath: "/api/office-purchases", invalidateKey: "/api/office-purchases" } } : null,
    procPend.length ? { key: "procurement", label: "Procurement", icon: Package, count: procPend.length, total: amtSum(procPend),
      cfg: { title: "Procurement", kind: "procurement", basePath: "/api/procurement", invalidateKey: "/api/procurement" } } : null,
    travelPend.length ? { key: "travel", label: "Travel", icon: Plane, count: travelPend.length, total: amtSum(travelPend, "amount"), cfg: { kind: "travel" } } : null,
  ].filter(Boolean) as { key: string; label: string; icon: any; count: number; total: number; cfg: any }[]);
  // "Under review" (queries you raised, on hold) — a separate section below the main cards.
  const underReviewCards = ([
    opUR.length ? { key: "op_ur", label: "Office Purchases", icon: ShoppingCart, count: opUR.length, total: amtSum(opUR),
      cfg: { title: "Office Purchases", lane: "Under Review", statuses: ["under_review"], kind: "office", grouped: true, basePath: "/api/office-purchases", invalidateKey: "/api/office-purchases" } } : null,
    procUR.length ? { key: "proc_ur", label: "Procurement", icon: Package, count: procUR.length, total: amtSum(procUR),
      cfg: { title: "Procurement", lane: "Under Review", statuses: ["under_review"], kind: "procurement", basePath: "/api/procurement", invalidateKey: "/api/procurement" } } : null,
  ].filter(Boolean) as { key: string; label: string; icon: any; count: number; total: number; cfg: any }[]);
  // Non-CEO approvers get a category tab strip (auto-sorted by pending count = priority); the CEO keeps the bulk-cards inbox.
  const apprTabs = ([
    canReimbApprove ? { key: "reimbursements", label: "Reimbursements", icon: Receipt, count: financeReimbQueue.length } : null,
    canOpTriage ? { key: "office_purchases", label: "Office Purchases", icon: ShoppingCart, count: officeTriageCount } : null,
    canTravelApprove ? { key: "travel", label: "Travel", icon: Plane, count: travelPending } : null,
  ].filter(Boolean) as { key: string; label: string; icon: any; count: number }[]).sort((a, b) => b.count - a.count);
  const effectiveTab = apprTabs.some((t) => t.key === apprTab) ? apprTab : apprTabs[0]?.key;
  const headerTotal = isCeo
    ? catCards.reduce((s, c) => s + c.count, 0) + underReviewCards.reduce((s, c) => s + c.count, 0)
    : apprTabs.reduce((s, t) => s + t.count, 0);
  // Completed / decided history across the categories this user approves.
  const done = (arr: any[], statuses: string[]) => (arr as any[]).filter((x) => statuses.includes(x.status));
  const completedRows: { key: string; icon: any; cat: string; title: string; sub: string; amount: number; date: any; status: string }[] = [];
  if (isCeo) done(reimb, ["approved", "rejected"]).forEach((r) => completedRows.push({ key: `rmb-${r.id}`, icon: Receipt, cat: "Reimbursements", title: r.reference || "Reimbursement", sub: r.employeeName || reqName(r.requesterId), amount: Number(r.totalAmount) || 0, date: r.updatedAt || r.createdAt, status: r.status }));
  if (canOfficePurchase) done(opAll, ["approved", "rejected", "ordered", "delivered", "completed"]).forEach((o) => completedRows.push({ key: `op-${o.id}`, icon: ShoppingCart, cat: "Office Purchases", title: o.reference, sub: o.employeeName || "Employee", amount: Number(o.totalAmount) || 0, date: o.updatedAt || o.createdAt, status: o.status }));
  if (isCeo) done(procAll, ["approved", "rejected"]).forEach((o) => completedRows.push({ key: `pr-${o.id}`, icon: Package, cat: "Procurement", title: o.reference, sub: o.employeeName || "Employee", amount: Number(o.totalAmount) || 0, date: o.decidedAt || o.updatedAt || o.createdAt, status: o.status }));
  if (canTravelApprove) done(travelAll, ["booked", "rejected", "cancelled"]).forEach((t) => completedRows.push({ key: `tv-${t.id}`, icon: Plane, cat: "Travel", title: t.reference, sub: t.employeeName || "Employee", amount: Number(t.amount) || 0, date: t.bookedAt || t.decidedAt || t.updatedAt || t.createdAt, status: t.status }));
  completedRows.sort((a, b) => +new Date(b.date || 0) - +new Date(a.date || 0));
  return (
    <div className="p-6 space-y-6 max-w-[92rem] mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="icon" className="h-10 w-10 flex-shrink-0" onClick={() => navigate("/company-workspace")} aria-label="Back" data-testid="button-back-workspace"><ChevronLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{actingCeo ? "CEO Inbox" : "My Approvals"}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{actingCeo ? "Super-access — acting on the CEO's behalf | " : ""}{headerTotal} item{headerTotal !== 1 ? "s" : ""} awaiting action</p>
        </div>
      </div>

      {isCeo ? (
        <>
          <div className="flex gap-2">
            {(["pending", "completed"] as const).map((v) => (
              <Button key={v} size="sm" variant={apprView === v ? "default" : "secondary"} onClick={() => setApprView(v)} data-testid={`appr-view-${v}`}>
                {v === "pending" ? "Pending" : "Completed"}
                {v === "pending" && headerTotal > 0 && <span className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${apprView === "pending" ? "bg-white/25 text-white" : "bg-[#FF6F62] text-white"}`}>{headerTotal}</span>}
              </Button>
            ))}
          </div>
          {apprView === "pending" ? (
            (catCards.length === 0 && underReviewCards.length === 0)
              ? <div className="card-surface rounded-2xl py-16 text-center"><Check className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-sm text-muted-foreground">Nothing awaiting your approval.</p></div>
              : <div className="space-y-8">
                  {catCards.length > 0 && (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {catCards.map((c) => (
                        <div key={c.key} className="card-surface card-hover p-5 flex flex-col" data-testid={`inbox-cat-${c.key}`}>
                          <div className="flex items-center gap-2.5">
                            <span className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#206295]/10 text-[#206295]"><c.icon className="h-4 w-4" /></span>
                            <div className="min-w-0"><p className="text-sm font-semibold text-foreground truncate">{c.label}</p><p className="text-xs text-muted-foreground">{c.count} pending</p></div>
                          </div>
                          <p className="mt-4 text-[26px] font-bold tabular-nums leading-none text-[#206295]">{c.total > 0 ? money(c.total) : `${c.count} to review`}</p>
                          <Button variant="secondary" className="mt-4 w-full" onClick={() => c.cfg.kind === "travel" ? setTravelModal(true) : c.cfg.kind === "reimb" ? setReimbModal(true) : setBatchCat(c.cfg)} data-testid={`inbox-view-${c.key}`}><Eye className="h-4 w-4 mr-1.5" /> Review</Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {underReviewCards.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-[#FF6F62] flex-shrink-0" />
                        <h2 className="text-sm font-semibold text-foreground">Under review</h2>
                        <span className="text-xs text-muted-foreground">queries you raised — awaiting a reply</span>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {underReviewCards.map((c) => (
                          <div key={c.key} className="card-surface card-hover p-5 flex flex-col ring-1 ring-[#FF6F62]/25" data-testid={`inbox-ur-${c.key}`}>
                            <div className="flex items-center gap-2.5">
                              <span className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#FF6F62]/15 text-[#C4402F]"><c.icon className="h-4 w-4" /></span>
                              <div className="min-w-0"><p className="text-sm font-semibold text-foreground truncate">{c.label}</p><p className="text-xs text-[#C4402F]">{c.count} under review</p></div>
                            </div>
                            <p className="mt-4 text-[26px] font-bold tabular-nums leading-none text-[#C4402F]">{c.total > 0 ? money(c.total) : `${c.count}`}</p>
                            <Button variant="secondary" className="mt-4 w-full" onClick={() => setBatchCat(c.cfg)} data-testid={`inbox-ur-view-${c.key}`}><Eye className="h-4 w-4 mr-1.5" /> Review</Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
          ) : (
            <CompletedApprovals rows={completedRows} />
          )}
        </>
      ) : (
        <>
          {/* Non-CEO approvers: category tabs at the top, ordered by pending count, active tab highlighted. */}
          <div className="flex gap-2 flex-wrap">
            {apprTabs.map((t) => (
              <Button key={t.key} size="sm" variant={effectiveTab === t.key ? "default" : "secondary"} onClick={() => setApprTab(t.key)} data-testid={`appr-tab-${t.key}`}>
                <t.icon className="h-4 w-4 mr-1.5" /> {t.label}
                {t.count > 0 && <span className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${effectiveTab === t.key ? "bg-white/25 text-white" : "bg-[#FF6F62] text-white"}`}>{t.count}</span>}
              </Button>
            ))}
          </div>
          {apprTabs.length === 0 ? (
            <div className="card-surface rounded-2xl py-16 text-center"><Check className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-sm text-muted-foreground">Nothing awaiting your approval.</p></div>
          ) : (
            <>
              {effectiveTab === "reimbursements" && <ReimbApprovals items={financeReimbQueue} allItems={reimb} nameByUser={nameByUser} allowBulk={canCeoReimb} />}
              {effectiveTab === "office_purchases" && <OfficePurchaseApprovals allItems={opAll} canTriage={canOpTriage} canCeo={false} />}
              {effectiveTab === "travel" && <TravelApprovals scope="hr" />}
            </>
          )}
        </>
      )}

      {batchCat && <CeoReviewModal key={batchCat.title + (batchCat.lane || "")} cfg={batchCat} onClose={() => setBatchCat(null)} />}
      {travelModal && (
        <Dialog open onOpenChange={(o) => { if (!o) setTravelModal(false); }}>
          <DialogContent className="max-w-2xl max-h-[86vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Plane className="h-5 w-5 text-[#206295]" /> Travel approvals</DialogTitle></DialogHeader>
            <TravelApprovals scope="ceo" />
          </DialogContent>
        </Dialog>
      )}
      {reimbModal && (
        <Dialog open onOpenChange={(o) => { if (!o) setReimbModal(false); }}>
          <DialogContent className="max-w-5xl max-h-[88vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Receipt className="h-5 w-5 text-[#206295]" /> Reimbursement approvals</DialogTitle></DialogHeader>
            <ReimbApprovals items={ceoReimbQueue} allItems={reimb} nameByUser={nameByUser} allowBulk={canCeoReimb} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
