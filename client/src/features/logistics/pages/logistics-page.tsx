import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/shared/data-table";
import { usePaged, PaginationBar } from "@/components/shared/pagination";
import { Truck, Plus, Search, LayoutGrid, Table2, ArrowDownUp, AlertTriangle, Package } from "lucide-react";
import { format } from "date-fns";
import { statusClass, statusLabel } from "@/lib/status";
import { useLogisticsRequests, useLogisticsLocations } from "../api/logistics.api";
import { RaiseLogisticsDialog } from "../components/raise-logistics-dialog";
import { LogisticsRequestCard } from "../components/logistics-request-card";
import { LogisticsDetailDialog } from "../components/logistics-detail-dialog";

const HANDLER_ROLES = ["super_admin", "logistics"];
const ACTIVE = ["pending", "in_progress"];

export default function LogisticsPage() {
  const { data: auth } = useAuth();
  const role = auth?.user?.role || "";
  const isHandler = HANDLER_ROLES.includes(role);
  const [raise, setRaise] = useState(false);
  const [detail, setDetail] = useState<any>(null);

  const [phase, setPhase] = useState<"active" | "done">("active");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updated");
  const [view, setView] = useState<"card" | "table">("card");

  const { data: requests = [] } = useLogisticsRequests();
  const { data: locations = [] } = useLogisticsLocations();
  const locName = (id: string) => locations.find((l: any) => l.id === id)?.name;
  const routeOf = (r: any) => `${r.fromLocationText || locName(r.fromLocationId) || ""} ${r.toLocationText || locName(r.toLocationId) || ""}`;

  const activeCount = requests.filter((r) => ACTIVE.includes(r.status)).length;
  const doneCount = requests.length - activeCount;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = requests.filter((r) => (phase === "active" ? ACTIVE.includes(r.status) : !ACTIVE.includes(r.status)));
    if (typeFilter !== "all") list = list.filter((r) => r.requestType === typeFilter);
    if (q) list = list.filter((r) => `${r.reference} ${routeOf(r)} ${r.goodsCategory || ""} ${r.pocName || ""}`.toLowerCase().includes(q));
    const upd = (r: any) => +new Date(r.updatedAt || r.createdAt || 0);
    const crt = (r: any) => +new Date(r.createdAt || 0);
    return [...list].sort((a, b) => {
      // Urgent always floats to the top section while active.
      if (phase === "active") {
        const u = (r: any) => (r.priority === "urgent" ? 1 : 0);
        if (u(a) !== u(b)) return u(b) - u(a);
      }
      if (sortBy === "newest") return crt(b) - crt(a);
      if (sortBy === "oldest") return crt(a) - crt(b);
      return upd(b) - upd(a);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests, locations, phase, typeFilter, search, sortBy]);

  const paged = usePaged(rows);
  const urgentCount = rows.filter((r: any) => r.priority === "urgent").length;

  return (
    <div className="p-6 space-y-6 max-w-[92rem] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-xl bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0"><Truck className="h-5 w-5" /></span>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Logistics</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{isHandler ? "Process inward & outward movement requests" : "Raise and track your movement requests"}</p>
          </div>
        </div>
        <Button className="btn-primary-gradient" onClick={() => setRaise(true)} data-testid="logistics-raise"><Plus className="h-4 w-4 mr-1.5" /> Raise Request</Button>
      </div>

      {/* Controls — view · phase · search · type · sort */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="segmented-toggle inline-flex p-0.5 h-10 flex-shrink-0">
          <button onClick={() => setView("card")} aria-label="Card view" data-testid="view-card" className={`px-3 h-full rounded-[10px] inline-flex items-center justify-center ${view === "card" ? "btn-primary-gradient text-white" : "text-muted-foreground"}`}><LayoutGrid className="h-4 w-4" /></button>
          <button onClick={() => setView("table")} aria-label="Table view" data-testid="view-table" className={`px-3 h-full rounded-[10px] inline-flex items-center justify-center ${view === "table" ? "btn-primary-gradient text-white" : "text-muted-foreground"}`}><Table2 className="h-4 w-4" /></button>
        </div>
        <div className="h-10 w-px flex-shrink-0 bg-foreground/30" />
        <div className="segmented-toggle inline-flex p-0.5 h-10 flex-shrink-0" data-testid="logistics-phase-toggle">
          {(["active", "done"] as const).map((p) => (
            <button key={p} onClick={() => { setPhase(p); paged.setPage(1); }} data-testid={`logistics-phase-${p}`} className={`px-3 h-full rounded-[10px] text-xs font-medium whitespace-nowrap ${phase === p ? "btn-primary-gradient text-white" : "text-muted-foreground"}`}>
              {p === "active" ? `Active (${activeCount})` : `Completed (${doneCount})`}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[12rem]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); paged.setPage(1); }} placeholder="Search reference, route, cargo…" className="pl-8 h-10 w-full" data-testid="input-search-logistics" />
        </div>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); paged.setPage(1); }}>
          <SelectTrigger className="h-10 w-[140px] flex-shrink-0" data-testid="select-type-filter"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="inboard">Inboard</SelectItem>
            <SelectItem value="outboard">Outboard</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-10 w-[210px] gap-1 flex-shrink-0" data-testid="select-sort"><ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" /><span className="text-muted-foreground">Sort:</span><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Latest Update</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {rows.length === 0 ? (
        <div className="card-surface rounded-2xl py-16 text-center"><Truck className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-sm text-muted-foreground">No logistics requests here.</p></div>
      ) : view === "table" ? (
        <Card className="border-0"><CardContent className="p-0">
          <DataTable
            columns={[
              { key: "reference", header: "Reference", cellClassName: "font-medium text-foreground", render: (r: any) => r.reference },
              { key: "type", header: "Type", cellClassName: "text-muted-foreground", render: (r: any) => (r.requestType === "inboard" ? "Inboard" : "Outboard") },
              { key: "route", header: "Route", cellClassName: "text-foreground max-w-[20rem] truncate", render: (r: any) => `${r.fromLocationText || locName(r.fromLocationId) || "—"} → ${r.toLocationText || locName(r.toLocationId) || "—"}` },
              { key: "cargo", header: "Cargo", cellClassName: "text-muted-foreground whitespace-nowrap", render: (r: any) => `${r.quantity} unit${r.quantity !== 1 ? "s" : ""}${r.weightKg ? ` · ${Number(r.weightKg)} kg` : ""}` },
              { key: "pickup", header: "Pickup", cellClassName: "text-muted-foreground whitespace-nowrap", render: (r: any) => (r.pickupDate ? format(new Date(r.pickupDate), "d MMM yyyy") : "—") },
              { key: "status", header: "Status", render: (r: any) => <Badge className={`text-xs ${statusClass(r.status)}`}>{statusLabel(r.status)}</Badge> },
            ]}
            rows={rows}
            getRowKey={(r: any) => r.id}
            onRowClick={(r: any) => setDetail(r)}
            testIdPrefix="logistics-row"
          />
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {(() => {
            const out: any[] = [];
            let prev: boolean | null = null;
            paged.pageItems.forEach((r) => {
              if (phase === "active") {
                const u = r.priority === "urgent";
                if (u !== prev) {
                  const count = u ? urgentCount : rows.length - urgentCount;
                  out.push(
                    <div key={`sec-${u}`} className="flex items-center gap-2 pt-1 first:pt-0">
                      {u ? <AlertTriangle className="h-3.5 w-3.5 text-[#C4402F] flex-shrink-0" /> : <Package className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                      <span className={`text-xs font-semibold uppercase tracking-wide ${u ? "text-[#C4402F]" : "text-muted-foreground"}`}>{u ? "Urgent" : "Standard Requests"}</span>
                      <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${u ? "bg-[#FF6F62]/20 text-[#C4402F]" : "bg-muted text-muted-foreground"}`}>{count}</span>
                    </div>,
                  );
                  prev = u;
                }
              }
              out.push(<LogisticsRequestCard key={r.id} r={r} locName={locName} onOpen={setDetail} />);
            });
            return out;
          })()}
          <PaginationBar page={paged.page} totalPages={paged.totalPages} count={paged.count} size={paged.size} onPage={paged.setPage} />
        </div>
      )}

      <RaiseLogisticsDialog open={raise} onClose={() => setRaise(false)} locations={locations} />
      {detail && <LogisticsDetailDialog request={detail} isHandler={isHandler} isOwner={detail.requesterId === auth?.user?.id} locName={locName} onClose={() => setDetail(null)} />}
    </div>
  );
}
