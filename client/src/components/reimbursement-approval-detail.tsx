import { Fragment, useMemo, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { exportXlsx } from "@/lib/export-xlsx";
import { statusClass, statusLabel } from "@/lib/status";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogClose, DialogTitle } from "@/components/ui/dialog";
import {
  IndianRupee, CheckCircle2, Clock, FileText, Building2, MapPin, Hash, CalendarDays,
  ListChecks, CircleDot, XCircle, Maximize2, Check, X, MessageSquareWarning, CircleDashed, Download,
} from "lucide-react";

const money = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const money2 = (n: any) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d?: string | null) => { if (!d) return "—"; try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); } catch { return "—"; } };


const AVATAR_PALETTE = ["#206295", "#4BDCD9", "#FF6F62", "#425B8D"];
const avatarColor = (seed: string) => AVATAR_PALETTE[Math.abs([...(seed || "?")].reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_PALETTE.length];
const initials = (name: string) => (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const isImage = (d?: string) => !!d && (/^data:image\//i.test(d) || /\.(png|jpe?g|gif|webp|bmp)$/i.test(d));

// Simplified 4-step approval timeline.
function timelineSteps(reimb: any) {
  const st = reimb.status;
  const order = [
    { label: "Submitted", date: reimb.createdAt },
    { label: "Finance Review", date: reimb.financeDecisionAt },
    { label: "Final Approval", date: st === "approved" ? reimb.updatedAt : null },
    { label: "Completed", date: st === "approved" ? reimb.updatedAt : null },
  ];
  const active = st === "approved" ? 4 : st === "finance_approved" ? 2 : st === "rejected" ? (reimb.approvedById ? 2 : 1) : 1;
  return order.map((s, i) => {
    let state: "done" | "current" | "upcoming" | "rejected" = i < active ? "done" : i === active ? "current" : "upcoming";
    if (st === "approved") state = "done";
    if (st === "rejected" && i === active) state = "rejected";
    return { ...s, state };
  });
}

// Clean itemized Excel bill of the whole expense breakdown.
export function exportReimbursement(reimb: any) {
  const lines: any[] = Array.isArray(reimb.lines) ? reimb.lines : [];
  const rows: (string | number | null)[][] = [
    ...lines.map((l) => [l.description || l.category || "Item", l.category || "", Number(l.amount || 0)]),
    ["", "", ""],
    ["Total", "", Number(reimb.totalAmount || 0)],
  ];
  const title = `Reimbursement ${reimb.reference || ""}  ·  ${reimb.employeeName || ""} (${reimb.employeeCode || "—"})  ·  ${reimb.department || "—"}  ·  ${statusLabel(reimb.status)}  ·  ${fmtDate(reimb.createdAt)}`;
  return exportXlsx({ filename: `${reimb.reference || "reimbursement"}.xlsx`, sheet: "Expense Bill", title, headers: ["Description", "Category", "Amount (INR)"], rows });
}

function Field({ label, value, cap }: { label: string; value: any; cap?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium text-foreground mt-0.5 break-words ${cap ? "capitalize" : ""}`}>{value || "—"}</p>
    </div>
  );
}

// Inline before/after diff — new value in red, original below in grey strikethrough.
function DiffStack({ now, was, alignRight }: { now: any; was: any; alignRight?: boolean }) {
  return (
    <span className={`inline-flex flex-col ${alignRight ? "items-end" : "items-start"}`}>
      <span className="text-[#FF6F62] font-semibold">{now}</span>
      <span className="text-xs text-muted-foreground line-through">{was}</span>
    </span>
  );
}

// Heading sits ABOVE the card (outside the container); card is solid in the modal, glass on the full page.
// `bare` skips the card wrapper entirely (used when the content already is its own container, e.g. a table).
function Section({ title, icon: Icon, children, glass, bodyClass = "p-5", bare }: { title: string; icon: any; children: any; glass?: boolean; bodyClass?: string; bare?: boolean }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 px-1">
        <div className="h-7 w-7 rounded-lg bg-[#206295]/10 text-[#206295] flex items-center justify-center"><Icon className="h-4 w-4" /></div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {bare ? children : (
        <div className={glass ? `card-surface ${bodyClass}` : `rounded-2xl border border-border/70 bg-card ${bodyClass}`}>
          {children}
        </div>
      )}
    </div>
  );
}

// Invoice thumbnail — click opens full preview; download icon reveals on hover.
function InvoiceThumb({ fileData, label, sizeClass = "h-20 w-20" }: { fileData?: string; label: string; sizeClass?: string }) {
  if (!fileData) {
    return <div className={`${sizeClass} rounded-lg border border-border/60 bg-muted/40 flex items-center justify-center flex-shrink-0`}><FileText className="h-5 w-5 text-muted-foreground/50" /></div>;
  }
  return (
    <div className={`relative group/thumb ${sizeClass} rounded-lg overflow-hidden border border-border/60 bg-muted/40 flex-shrink-0`}>
      <a href={fileData} target="_blank" rel="noreferrer" title="Open large preview" className="block h-full w-full">
        {isImage(fileData)
          ? <img src={fileData} alt={label} className="h-full w-full object-cover" />
          : <span className="h-full w-full flex items-center justify-center"><FileText className="h-5 w-5 text-[#206295]" /></span>}
      </a>
      <a href={fileData} download={label} title="Download" className="absolute inset-x-0 bottom-0 h-5 bg-black/55 hidden group-hover/thumb:flex items-center justify-center">
        <Download className="h-3 w-3 text-white" />
      </a>
    </div>
  );
}

// ---- Core single-column detail view (used by modal + full-page route) ----
export function ReimbursementDetailView({
  reimb, canAct, onApprove, onReject, onRequestChanges, busy, showTimeline, headerSlot, variant = "modal",
}: {
  reimb: any;
  canAct: boolean;
  onApprove: () => void;
  onReject: (note: string) => void;
  onRequestChanges: (note: string, sel: { fields: string[]; lines: number[] }) => void;
  busy?: boolean;
  showTimeline?: boolean;
  headerSlot?: any;
  variant?: "modal" | "page";
}) {
  const glass = variant === "page";
  // Modal = solid bands; full page = the exact card-surface treatment used on /company-workspace.
  const heroCls = glass
    ? "card-surface mx-6 mt-6 px-6 pt-6 pb-5 relative flex-shrink-0"
    : "bg-background border-b border-border/60 px-6 pt-6 pb-5 relative flex-shrink-0";
  const bodyCls = glass
    ? "flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4"
    : "flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4 bg-background";
  const barBg = glass ? "card-surface mx-6 mb-6" : "border-t border-border bg-background";
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const emp = (employees as any[]).find((e) => e.employeeCode === reimb.employeeCode);
  const location = emp?.workLocation || "—";
  const empName = reimb.employeeName || "Employee";

  const lines: any[] = Array.isArray(reimb.lines) ? reimb.lines : [];
  const steps = timelineSteps(reimb);
  const subTotal = lines.length ? lines.reduce((s, l) => s + (Number(l.amount) || 0), 0) : Number(reimb.totalAmount || 0);
  const advance = Number(reimb.cashAdvance) || 0;
  const payable = subTotal - advance;

  // CEO (final) stage: items are already verified by Finance — no re-verification or change requests.
  const isFinalStage = reimb.status === "finance_approved";
  // The claim passed Finance verification once it reached the CEO (approved, or CEO-rejected after Finance verified).
  const verifiedByFinance = reimb.status === "finance_approved" || reimb.status === "approved" || (reimb.status === "rejected" && !!reimb.approvedById);
  // Manual verification — Approve stays disabled until every item is verified (Finance stage only).
  const [verified, setVerified] = useState<Set<number>>(new Set());
  const allVerified = isFinalStage || lines.length === 0 || lines.every((_, i) => verified.has(i));
  const toggleVerify = (i: number) => setVerified((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });

  // ---- Action bar state (lifted so the Expense table can show per-item "editable" checkboxes) ----
  const [crMode, setCrMode] = useState<null | "reject" | "changes">(null);
  const [crNote, setCrNote] = useState("");
  const [crAllowAll, setCrAllowAll] = useState(false);
  const [crLines, setCrLines] = useState<Set<number>>(new Set());
  const [hint, setHint] = useState(false);
  const [crGlow, setCrGlow] = useState(false);
  const [crTip, setCrTip] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const enterMode = (m: "reject" | "changes") => {
    setCrNote(""); setCrAllowAll(false); setCrLines(new Set()); setCrMode(m);
    if (m === "changes") {
      // Guide the approver to the per-item selection: scroll, glow, and a fading tip.
      window.setTimeout(() => {
        tableRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        setCrGlow(true); setCrTip(true);
        window.setTimeout(() => setCrGlow(false), 1500);
        window.setTimeout(() => setCrTip(false), 3500);
      }, 60);
    }
  };
  const resetCr = () => { setCrMode(null); setCrNote(""); setCrAllowAll(false); setCrLines(new Set()); };
  const toggleCrLine = (i: number) => setCrLines((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const selectingItems = crMode === "changes" && !crAllowAll;
  const handleApprove = () => { if (!allVerified) { setHint(true); window.setTimeout(() => setHint(false), 3500); return; } onApprove(); };
  const sendChanges = () => { onRequestChanges(crNote.trim(), { fields: [], lines: crAllowAll ? [] : [...crLines] }); resetCr(); };

  // Before/after diff surfaced after a resubmit (data stored in `notes` as JSON).
  const diff = useMemo(() => { try { const p = JSON.parse(reimb.notes || "{}"); return p && p.kind === "resubmitted_diff" ? p : null; } catch { return null; } }, [reimb.notes]);
  const diffAll = !!diff && (!diff.lines || diff.lines.length === 0);
  const origLines: any[] = diff?.original?.lines || [];
  const lineInDiff = (i: number) => !!diff && (diffAll || (diff.lines || []).includes(i));

  const details = useMemo(() => {
    const o = diff?.original;
    const newPeriod = reimb.periodFrom ? `${fmtDate(reimb.periodFrom)} – ${fmtDate(reimb.periodTo)}` : null;
    const oldPeriod = o?.periodFrom ? `${fmtDate(o.periodFrom)} – ${fmtDate(o.periodTo)}` : "—";
    const bpChanged = diffAll && o && String(o.businessPurpose ?? "") !== String(reimb.businessPurpose ?? "");
    const periodChanged = diffAll && o && (String(o.periodFrom ?? "") !== String(reimb.periodFrom ?? "") || String(o.periodTo ?? "") !== String(reimb.periodTo ?? ""));
    const caChanged = diffAll && o && Number(o.cashAdvance || 0) !== Number(reimb.cashAdvance || 0);
    return ([
      ["Business Purpose", bpChanged ? <DiffStack now={reimb.businessPurpose} was={o.businessPurpose || "—"} /> : reimb.businessPurpose, false],
      ["HOD / Manager", reimb.hodName, false],
      ["Period", newPeriod ? (periodChanged ? <DiffStack now={newPeriod} was={oldPeriod} /> : newPeriod) : null, false],
      ["Invoice No.", reimb.invoiceNumber, false],
      ["Invoice Date", reimb.invoiceDate ? fmtDate(reimb.invoiceDate) : null, false],
      ["Cash Advance", reimb.cashAdvance && Number(reimb.cashAdvance) > 0 ? (caChanged ? <DiffStack now={money(reimb.cashAdvance)} was={money(o.cashAdvance)} /> : money(reimb.cashAdvance)) : null, false],
      ["Currency", reimb.currency && reimb.currency !== "INR" ? reimb.currency : null, false],
      ["Finance Remark", reimb.financeNote, false],
      ["Decision Note", reimb.decisionNote, false],
      ["Zoho Expense ID", reimb.zohoExpenseId, false],
    ] as [string, any, boolean][]).filter(([, v]) => v);
  }, [reimb, diff, diffAll]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ===== Hero — requester first ===== */}
      <div className={heroCls}>
        {headerSlot}
        <div className="flex items-start gap-4">
          <Avatar className="h-14 w-14 flex-shrink-0">
            <AvatarFallback className="text-base font-semibold" style={{ backgroundColor: `${avatarColor(empName)}26`, color: avatarColor(empName) }}>{initials(empName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-foreground leading-tight">{empName}</h2>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Hash className="h-3.5 w-3.5" /> {reimb.employeeCode || "—"}</span>
              <span className="text-border">|</span>
              <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {reimb.department || "—"}</span>
              <span className="text-border">|</span>
              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {location}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3 mt-5">
          <div>
            <div className="flex items-end gap-1.5">
              <IndianRupee className="h-7 w-7 text-[#206295] mb-1" />
              <span className="text-4xl font-bold text-foreground tracking-tight">{Number(reimb.totalAmount || 0).toLocaleString("en-IN")}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{reimb.reference}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`text-xs ${statusClass(reimb.status)}`}>{statusLabel(reimb.status)}</Badge>
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {fmtDate(reimb.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* ===== Scrollable single-column body ===== */}
      <div className={bodyCls}>
        {/* Request Details — single band with vertical separators */}
        {(details.length > 0 || reimb.invoiceUrl) && (
          <Section title="Request Details" icon={FileText} glass={glass}>
            <div className="flex items-stretch">
              {details.map(([k, v, cap], i) => (
                <Fragment key={k}>
                  {i > 0 && <Separator orientation="vertical" className="h-auto self-stretch mx-4" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</p>
                    <p className={`text-sm font-medium text-foreground mt-0.5 break-words ${cap ? "capitalize" : ""}`}>{v}</p>
                  </div>
                </Fragment>
              ))}
            </div>
            {reimb.invoiceUrl && (
              <a href={reimb.invoiceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm text-[#206295] hover:underline">
                <FileText className="h-4 w-4" /> View claim invoice document
              </a>
            )}
          </Section>
        )}

        {/* Expense Breakdown — mirrors the Reimbursement Form item hierarchy, read-only + verification */}
        <Section title="Expense Breakdown" icon={ListChecks} glass={glass} bare>
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No line items recorded.</p>
          ) : (
            <div className="space-y-3 relative">
              {/* fading guidance tip */}
              {crTip && (
                <div className="absolute -top-9 right-0 z-20 rounded-lg bg-[#206295] text-white text-xs px-3 py-1.5 shadow-lg transition-opacity duration-500" role="status">
                  Select the items you want the requester to change
                </div>
              )}
              <div ref={tableRef} className={`overflow-x-auto transition-all duration-500 ${glass ? "card-surface" : "rounded-xl border border-border"} ${crGlow ? "ring-2 ring-[#206295] ring-offset-2" : ""}`}>
                <table className="w-full text-[13px] border-collapse">
                  <thead>
                    <tr className="bg-muted text-[10px] uppercase tracking-wide text-muted-foreground text-left">
                      {selectingItems && <th className="px-2.5 py-2 font-medium w-8"></th>}
                      <th className="px-2.5 py-2 font-medium w-8">#</th>
                      <th className="px-2.5 py-2 font-medium">Invoice No.</th>
                      <th className="px-2.5 py-2 font-medium whitespace-nowrap">Invoice Date</th>
                      <th className="px-2.5 py-2 font-medium">Description</th>
                      <th className="px-2.5 py-2 font-medium">Nature of Expense</th>
                      <th className="px-2.5 py-2 font-medium text-right">Amount</th>
                      <th className="px-2.5 py-2 font-medium text-center">Invoice</th>
                      {((canAct && crMode !== "changes") || (!canAct && verifiedByFinance)) && <th className="px-2.5 py-2 font-medium text-center">Verify</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {lines.map((l, i) => {
                      const isV = verified.has(i);
                      const nature = l.nature || l.category;
                      return (
                        <tr key={i} className="align-top" data-testid={`appr-item-${i}`}>
                          {selectingItems && (
                            <td className="px-2.5 py-2">
                              <Checkbox checked={crLines.has(i)} onCheckedChange={() => toggleCrLine(i)} data-testid={`cr-line-${i}`} />
                            </td>
                          )}
                          <td className="px-2.5 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                          <td className="px-2.5 py-2 text-foreground break-words">{l.invoiceNo || "—"}</td>
                          <td className="px-2.5 py-2 text-foreground whitespace-nowrap">{l.invoiceDate ? fmtDate(l.invoiceDate) : "—"}</td>
                          <td className="px-2.5 py-2 text-foreground break-words min-w-[140px]">{lineInDiff(i) && origLines[i] && String(origLines[i].description ?? "") !== String(l.description ?? "") ? <DiffStack now={l.description || "—"} was={origLines[i].description || "—"} /> : (l.description || "—")}</td>
                          <td className="px-2.5 py-2 text-foreground capitalize break-words min-w-[120px]">{nature || "—"}</td>
                          <td className="px-2.5 py-2 text-right font-semibold text-foreground whitespace-nowrap">{lineInDiff(i) && origLines[i] && Number(origLines[i].amount || 0) !== Number(l.amount || 0) ? <DiffStack now={money2(l.amount)} was={money2(origLines[i].amount)} alignRight /> : money2(l.amount)}</td>
                          <td className="px-2.5 py-2">
                            <div className="flex justify-center">
                              {l.fileData
                                ? <InvoiceThumb fileData={l.fileData} label={`${reimb.reference}-invoice-${i + 1}`} sizeClass="h-[52px] w-[52px]" />
                                : <span className="text-[11px] text-[#FF6F62]">None</span>}
                            </div>
                          </td>
                          {((canAct && crMode !== "changes") || (!canAct && verifiedByFinance)) && (
                            <td className="px-2.5 py-2">
                              <div className="flex justify-center">
                                {(!canAct || isFinalStage) ? (
                                  <span className="inline-flex items-center gap-1 text-[13px] font-medium text-[#0E7C7B]" data-testid={`verified-line-${i}`}><Check className="h-3.5 w-3.5" /> Verified</span>
                                ) : (
                                  <button
                                    onClick={() => toggleVerify(i)}
                                    data-testid={`verify-line-${i}`}
                                    className={isV
                                      ? "inline-flex items-center gap-1 rounded-[20px] px-2.5 h-8 text-[13px] font-medium bg-[#0E7C7B] text-white border border-transparent hover:bg-[#0E7C7B]/90"
                                      : "inline-flex items-center gap-1 rounded-[20px] px-3 h-8 text-[13px] font-medium border-[1.5px] border-[#0E7C7B] bg-[#4BDCD9]/10 text-[#0E7C7B] backdrop-blur-[10px] hover:bg-[#4BDCD9]/20"}>
                                    {isV ? <><Check className="h-3.5 w-3.5" /> Verified</> : "Verify"}
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bill summary — Sub Total → Less Cash Advance → Total to be Paid */}
              <div className={`p-4 space-y-2 ml-auto sm:w-80 ${glass ? "card-surface" : "rounded-[16px] border border-border bg-muted/30"}`}>
                <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Sub Total</span><span className="font-semibold text-foreground">{money2(subTotal)}</span></div>
                {advance > 0 && (
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Less: Cash Advance</span><span className="font-semibold text-[#FF6F62]">− {money2(advance)}</span></div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-sm font-semibold text-foreground">Total to be Paid</span>
                  <span className="text-base font-bold text-[#206295]">{money2(payable)}</span>
                </div>
              </div>
            </div>
          )}
        </Section>

        {/* Approval Timeline — full-page view only */}
        {showTimeline && (
          <Section title="Approval Timeline" icon={Clock} glass={glass}>
            <ol className="flex items-start">
              {steps.map((s, i) => (
                <li key={i} className="flex-1 flex flex-col items-center text-center min-w-0">
                  {/* node + connecting lines */}
                  <div className="flex items-center w-full">
                    <span className={`h-px flex-1 ${i === 0 ? "opacity-0" : s.state === "done" || s.state === "current" || s.state === "rejected" ? "bg-[#0E7C7B]/40" : "bg-border"}`} />
                    {s.state === "done" ? <CheckCircle2 className="h-5 w-5 text-[#0E7C7B] flex-shrink-0" />
                      : s.state === "current" ? <CircleDot className="h-5 w-5 text-[#206295] flex-shrink-0" />
                      : s.state === "rejected" ? <XCircle className="h-5 w-5 text-[#FF6F62] flex-shrink-0" />
                      : <CircleDashed className="h-5 w-5 text-muted-foreground/40 flex-shrink-0" />}
                    <span className={`h-px flex-1 ${i === steps.length - 1 ? "opacity-0" : steps[i + 1].state === "done" || steps[i + 1].state === "current" || steps[i + 1].state === "rejected" ? "bg-[#0E7C7B]/40" : "bg-border"}`} />
                  </div>
                  <div className="mt-2 px-1">
                    <p className={`text-sm font-medium ${s.state === "upcoming" ? "text-muted-foreground" : "text-foreground"}`}>{s.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{s.state === "current" ? "In progress" : s.state === "rejected" ? "Rejected" : fmtDate(s.date)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        )}
      </div>

      {/* ===== Sticky action bar — always visible ===== */}
      {canAct && (
        crMode ? (
          <div className={`flex-shrink-0 ${barBg} px-6 py-4 space-y-3`}>
            <Textarea autoFocus value={crNote} onChange={(e) => setCrNote(e.target.value)} rows={2} placeholder={crMode === "reject" ? "Reason for rejection (required)…" : "What needs to change? (required)…"} className="text-sm" data-testid="input-action-note" />
            {crMode === "changes" && (
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <Checkbox checked={crAllowAll} onCheckedChange={() => setCrAllowAll((v) => !v)} data-testid="cr-allow-all" />
                Allow Requester to edit all fields.
              </label>
            )}
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={resetCr}>Cancel</Button>
              <Button size="sm" disabled={!crNote.trim() || busy || (selectingItems && crLines.size === 0)}
                className={crMode === "reject" ? "bg-[#FF6F62] hover:bg-[#FF6F62]/90 text-white" : ""}
                onClick={crMode === "reject" ? () => { onReject(crNote.trim()); resetCr(); } : sendChanges}
                data-testid="button-confirm-action">
                {crMode === "reject" ? "Confirm Rejection" : "Send Request"}
              </Button>
            </div>
          </div>
        ) : (
          <div className={`flex-shrink-0 ${barBg} px-6 py-4 relative`}>
            {hint && (
              <div className="absolute bottom-full right-6 mb-2 z-20 flex items-start gap-2 rounded-xl border border-[#206295]/30 bg-background shadow-lg px-3 py-2.5 max-w-xs" role="status">
                <CircleDot className="h-4 w-4 text-[#206295] mt-0.5 flex-shrink-0" />
                <p className="text-xs text-foreground leading-snug">Verify all expense items before approving this reimbursement.</p>
              </div>
            )}
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" className="text-[#FF6F62] border-[#FF6F62]/40 hover:bg-[#FF6F62]/10" disabled={busy} onClick={() => enterMode("reject")} data-testid="button-reject">
                <X className="h-4 w-4 mr-1.5" /> Reject
              </Button>
              {!isFinalStage && (
                <Button variant="ghost" className="btn-glass text-[#206295] hover:text-[#206295]" disabled={busy} onClick={() => enterMode("changes")} data-testid="button-request-changes">
                  <MessageSquareWarning className="h-4 w-4 mr-1.5" /> Request Changes
                </Button>
              )}
              <Button className={`btn-primary-gradient ${!allVerified ? "opacity-60" : ""}`} disabled={busy} onClick={handleApprove} data-testid="button-approve">
                <Check className="h-4 w-4 mr-1.5" /> Approve
              </Button>
            </div>
          </div>
        )
      )}
    </div>
  );
}


// ---- Modal wrapper (80% of screen, 85% bg opacity) with export + expand controls ----
export function ReimbursementApprovalModal({ reimb, canAct, open, onClose, onExpand }: {
  reimb: any; canAct: boolean; open: boolean; onClose: () => void; onExpand: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/reimbursements") });

  const act = useMutation({
    mutationFn: ({ kind, note, sel }: { kind: string; note?: string; sel?: { fields: string[]; lines: number[] } }) => apiRequest("POST", `/api/reimbursements/${reimb.id}/${kind}`, { ...(note ? { note } : {}), ...(sel || {}) }),
    onSuccess: (_d, v) => { invalidate(); onClose(); toast({ title: v.kind === "approve" ? "Reimbursement approved" : v.kind === "reject" ? "Reimbursement rejected" : "Changes requested" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const doExport = async () => { try { await exportReimbursement(reimb); } catch (e: any) { toast({ title: "Export failed", description: e.message, variant: "destructive" }); } };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[68vw] max-w-[68vw] h-[85vh] p-0 overflow-hidden gap-0 rounded-2xl bg-background/85 backdrop-blur-xl !flex flex-col [&>button]:hidden">
        <DialogTitle className="sr-only">Reimbursement Details</DialogTitle>
        {/* top-right controls: export · expand · close */}
        <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
          <button onClick={doExport} aria-label="Export details" data-testid="button-export-detail"
            className="btn-glass h-9 w-9 rounded-lg flex items-center justify-center text-[#206295] hover:opacity-90">
            <Download className="h-4 w-4" />
          </button>
          <button onClick={onExpand} aria-label="Expand to full page" data-testid="button-expand-detail"
            className="btn-glass h-9 w-9 rounded-lg flex items-center justify-center text-[#206295] hover:opacity-90">
            <Maximize2 className="h-4 w-4" />
          </button>
          <DialogClose data-testid="button-close-detail"
            className="btn-glass h-9 w-9 rounded-lg flex items-center justify-center text-[#206295] hover:opacity-90">
            <X className="h-4 w-4" />
          </DialogClose>
        </div>
        <ReimbursementDetailView
          reimb={reimb}
          canAct={canAct}
          busy={act.isPending}
          showTimeline={false}
          onApprove={() => act.mutate({ kind: "approve" })}
          onReject={(note) => act.mutate({ kind: "reject", note })}
          onRequestChanges={(note, sel) => act.mutate({ kind: "request-changes", note, sel })}
        />
      </DialogContent>
    </Dialog>
  );
}
