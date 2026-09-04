import { useState } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ClipboardCheck, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useApprovalsFeed } from "../api/attendance.api";

// Approvals feed for the Employee-Attendance screen: Leave + WFH requests as one list per request
// (pending on top, then decisions), manager-scoped server-side. Filter Pending/All; expand -> /leave.
export function ApprovalsFeedCard() {
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<"all" | "pending">("all");
  const { data: feed = [] } = useApprovalsFeed();

  const parseYmd = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const periodLabel = (it: any) => {
    const s = parseYmd(it.startDate), e = parseYmd(it.endDate);
    const base = it.startDate === it.endDate ? format(s, "EEE, d MMM") : `${format(s, "d MMM")} – ${format(e, "d MMM")}`;
    return it.isHalfDay ? `${base} · Half day` : base;
  };
  const stamp = (iso: string | null) => iso ? format(new Date(iso), "d MMM, h:mm a") : "";

  const pending = (feed as any[]).filter((f) => f.status === "pending").sort((a, b) => (a.requestedAt || "") < (b.requestedAt || "") ? -1 : 1);
  const decided = (feed as any[]).filter((f) => f.status !== "pending").sort((a, b) => (a.decidedAt || "") < (b.decidedAt || "") ? 1 : -1);
  const rows = filter === "pending" ? pending : [...pending, ...decided];

  const STATUS: Record<string, { label: string; bg: string; color: string }> = {
    pending: { label: "Pending", bg: "rgba(245,158,11,0.15)", color: "#B5611A" },
    approved: { label: "Approved", bg: "rgba(14,124,123,0.15)", color: "#0E7C7B" },
    rejected: { label: "Rejected", bg: "rgba(255,111,98,0.15)", color: "#C24A3E" },
  };

  return (
    <Card className="border-0 h-[24rem] lg:h-full min-h-[20rem] flex flex-col">
      <CardHeader className="pt-4 pb-2 px-4">
        <div className="flex flex-row items-center justify-between gap-2 h-9">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" /> Approvals
            {pending.length > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(245,158,11,0.15)", color: "#B5611A" }}>{pending.length} pending</span>}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
              <SelectTrigger className="h-8 w-[88px] text-[11px] rounded-[10px] opacity-100 border no-default-hover-elevate" style={{ background: "transparent", borderColor: "rgba(29, 31, 32, 0.75)", boxShadow: "none" }} data-testid="select-approvals-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All</SelectItem>
                <SelectItem value="pending" className="text-xs">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="secondary" size="icon" className="h-8 w-8 rounded-[10px] flex-shrink-0" title="Open leave approvals" onClick={() => navigate("/leave")} data-testid="approvals-expand"><ArrowUpRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 flex-1 min-h-0">
        {rows.length === 0 ? (
          <div className="h-full flex items-center justify-center"><p className="text-sm text-muted-foreground">{filter === "pending" ? "No pending requests" : "No requests yet"}</p></div>
        ) : (
          <ScrollArea className="h-full">
            <div className="list-divider pr-2">
              {rows.map((it) => {
                const st = STATUS[it.status] || STATUS.pending;
                return (
                  <div key={it.id} className="py-2.5" data-testid={`approval-${it.id}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate flex-1">{it.employeeName}</span>
                      <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex-shrink-0">{it.kind === "wfh" ? "WFH" : "Leave"}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{periodLabel(it)}{it.reason ? ` · ${it.reason}` : ""}</p>
                    <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                      {it.status === "pending"
                        ? `Requested ${stamp(it.requestedAt)}`
                        : `${st.label}${it.decidedByName ? ` by ${it.decidedByName}` : ""}${it.decidedAt ? ` · ${stamp(it.decidedAt)}` : ""}`}
                    </p>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
