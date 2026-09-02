import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History, Briefcase, Building2, UserRound, MapPin, CircleDot, Plane, Search } from "lucide-react";
import { format } from "date-fns";
import { useEmployeeHistory } from "../api/employees.api";

const FIELD: Record<string, { label: string; icon: any }> = {
  designation: { label: "Designation", icon: Briefcase },
  department: { label: "Department", icon: Building2 },
  managerId: { label: "Manager", icon: UserRound },
  location: { label: "Location", icon: MapPin },
  employmentStatus: { label: "Status", icon: CircleDot },
};

// Leave status → brand tint (no orange).
const LEAVE_TINT: Record<string, string> = { approved: "#0E7C7B", rejected: "#C4402F", cancelled: "#64748B", pending: "#206295" };

type Row = {
  id: string; when: Date; kind: "change" | "leave"; color: string; icon: any;
  title: string; detail: React.ReactNode; search: string;
};

// Shared column widths so the fixed header and the scrolling rows line up exactly.
const COL_DATE = "w-36 flex-shrink-0";
const COL_EVENT = "w-64 flex-shrink-0";
const COL_DETAIL = "flex-1 min-w-0";
const PAGE = 25; // lazy-load window — render this many, then more as you scroll

/** A clean, searchable history: a fixed header + a scrolling, lazy-loaded body of role/status
 *  changes and leave requests. Only the rows scroll; the toolbar and header stay put. */
export function EmploymentHistoryTab({ empId, leaves = [], leaveTypes = [] }: { empId: string; leaves?: any[]; leaveTypes?: any[] }) {
  const { data: history = [], isLoading } = useEmployeeHistory(empId);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const h of history as any[]) {
      const meta = FIELD[h.changedField] || { label: h.changedField, icon: History };
      out.push({
        id: `hist-${h.id}`, when: new Date(h.effectiveDate || h.createdAt), kind: "change", color: "#206295", icon: meta.icon,
        title: `${meta.label} changed`,
        detail: (
          <div className="flex items-center gap-2 flex-wrap">
            {h.oldValue && <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground text-xs">{h.oldValue}</span>}
            {h.oldValue && h.newValue && <span className="text-muted-foreground text-xs">→</span>}
            {h.newValue && <span className="px-2 py-0.5 rounded bg-[#206295]/12 text-[#206295] text-xs font-medium">{h.newValue}</span>}
            {h.reason && <span className="w-full text-muted-foreground text-xs mt-0.5">{h.reason}</span>}
          </div>
        ),
        search: `${meta.label} ${h.oldValue || ""} ${h.newValue || ""} ${h.reason || ""}`.toLowerCase(),
      });
    }
    for (const l of leaves as any[]) {
      if (!l.createdAt) continue;
      const lt = (leaveTypes as any[]).find((t) => t.id === l.leaveTypeId);
      const range = l.startDate === l.endDate ? format(new Date(l.startDate), "MMM d") : `${format(new Date(l.startDate), "MMM d")} – ${format(new Date(l.endDate), "MMM d")}`;
      const name = lt?.name || "leave";
      const status = String(l.status).replace(/_/g, " ");
      out.push({
        id: `leave-${l.id}`, when: new Date(l.createdAt), kind: "leave", color: LEAVE_TINT[l.status] || "#206295", icon: Plane,
        title: `Applied for ${name}`,
        detail: <span className="text-muted-foreground text-xs capitalize">{range} · {status}</span>,
        search: `${name} ${range} ${status}`.toLowerCase(),
      });
    }
    out.sort((a, b) => +b.when - +a.when);
    return out;
  }, [history, leaves, leaveTypes]);

  const term = q.trim().toLowerCase();
  const filtered = useMemo(
    () => rows.filter((r) => (kind === "all" || r.kind === kind) && (!term || r.search.includes(term))),
    [rows, kind, term],
  );

  // Reset the lazy window whenever the filter changes.
  useEffect(() => { setLimit(PAGE); }, [q, kind]);

  const view = filtered.slice(0, limit);
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 240) {
      setLimit((l) => (l < filtered.length ? l + PAGE : l));
    }
  };

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="flex flex-col lg:h-full gap-4">
      {/* Search + type filter — stays fixed above the table */}
      <div className="flex items-center gap-3 flex-wrap flex-shrink-0">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search history…" className="pl-9" data-testid="input-search-history" />
        </div>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="w-52" data-testid="select-history-kind"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            <SelectItem value="change">Role &amp; status changes</SelectItem>
            <SelectItem value="leave">Leave requests</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-0 overflow-hidden lg:flex-1 lg:min-h-0 flex flex-col">
        {/* Fixed header — same surface as the card (no separate fill), never scrolls */}
        <div className="flex items-center gap-4 px-6 py-3 text-[13px] font-semibold text-muted-foreground border-b border-border flex-shrink-0">
          <div className={COL_DATE}>Date</div>
          <div className={COL_EVENT}>Event</div>
          <div className={COL_DETAIL}>Details</div>
        </div>

        {/* Only this container scrolls; rows are lazy-loaded as you reach the bottom */}
        {filtered.length === 0 ? (
          <div className="lg:flex-1 flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">{rows.length === 0 ? "Nothing on record yet." : "No history matches those filters."}</p>
          </div>
        ) : (
          <div className="lg:flex-1 lg:min-h-0 overflow-y-auto list-divider" onScroll={onScroll}>
            {view.map((r) => (
              <div key={r.id} className="flex items-start gap-4 px-6 py-3 hover-elevate" data-testid={`history-${r.id}`}>
                <div className={`${COL_DATE} text-sm text-foreground/80 whitespace-nowrap pt-0.5`}>{format(r.when, "MMM d, yyyy")}</div>
                <div className={`${COL_EVENT} flex items-center gap-2.5 min-w-0`}>
                  <span className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${r.color}1a`, color: r.color }}><r.icon className="h-3.5 w-3.5" /></span>
                  <span className="text-sm font-medium text-foreground truncate">{r.title}</span>
                </div>
                <div className={`${COL_DETAIL} text-xs pt-0.5`}>{r.detail}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
