import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose, SheetTrigger } from "@/components/ui/sheet";
import { DataTable } from "@/components/shared/data-table";
import { usePaged, PaginationBar } from "@/components/shared/pagination";
import { Truck, Plus, Search, LayoutGrid, Table2, ArrowDownUp, AlertTriangle, Package, SlidersHorizontal, X } from "lucide-react";
import { format } from "date-fns";
import { statusClass, statusLabel } from "@/lib/status";
import { useLogisticsRequests, useLogisticsLocations } from "../api/logistics.api";
import { RaiseLogisticsDialog } from "../components/raise-logistics-dialog";
import { LogisticsRequestCard } from "../components/logistics-request-card";
import { LogisticsDetailDialog } from "../components/logistics-detail-dialog";
import { SplitTabs } from "@/components/shared/split-tabs";

const HANDLER_ROLES = ["super_admin", "logistics"];
const ACTIVE = ["pending", "in_progress"];
// Labels for the mobile Filters sheet's active chips (Type + Sort).
const TYPE_CHIP_LABELS: Record<string, string> = { inboard: "Inboard", outboard: "Outboard" };
const SORT_CHIP_LABELS: Record<string, string> = { updated: "Latest Update", newest: "Newest", oldest: "Oldest" };
const fmtDate = (d: any) => { if (!d) return "—"; const s = String(d); const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); return format(m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s), "d MMM yyyy"); };
const flatLoc = (s: any) => String(s || "—").split(/\s*—\s*/).filter(Boolean).join(", ") || "—";

export default function LogisticsPage() {
  const { data: auth } = useAuth();
  const role = auth?.user?.role || "";
  const isHandler = HANDLER_ROLES.includes(role);
  const [raise, setRaise] = useState(false);
  const [detail, setDetail] = useState<any>(null);

  const [tab, setTab] = useState<"mine" | "process">("mine");
  const [phase, setPhase] = useState<"active" | "done">("active");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updated");
  const [view, setView] = useState<"card" | "table">("card");
  const [filterSheet, setFilterSheet] = useState(false); // mobile Filters bottom-sheet (Type + Sort)

  const { data: requests = [] } = useLogisticsRequests();
  const { data: locations = [] } = useLogisticsLocations();
  const locName = (id: string) => locations.find((l: any) => l.id === id)?.name;
  const routeOf = (r: any) => `${r.fromLocationText || locName(r.fromLocationId) || ""} ${r.toLocationText || locName(r.toLocationId) || ""}`;

  const me = auth?.user?.id;
  // Handlers get two surfaces: their own requests (Mine) and others' awaiting action (To Process).
  const mineAll = requests.filter((r) => r.requesterId === me);
  const processAll = isHandler ? requests.filter((r) => r.requesterId !== me) : [];
  const activeTab = isHandler ? tab : "mine";
  const base = activeTab === "process" ? processAll : mineAll;
  const activeCount = base.filter((r) => ACTIVE.includes(r.status)).length;
  const doneCount = base.length - activeCount;
  const mineActive = mineAll.filter((r) => ACTIVE.includes(r.status)).length;
  const processActive = processAll.filter((r) => ACTIVE.includes(r.status)).length;

  const rows = useMemo(() => {
    const source = activeTab === "process" ? requests.filter((r) => r.requesterId !== me) : requests.filter((r) => r.requesterId === me);
    const q = search.trim().toLowerCase();
    let list = source.filter((r) => (phase === "active" ? ACTIVE.includes(r.status) : !ACTIVE.includes(r.status)));
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
  }, [requests, locations, activeTab, me, phase, typeFilter, search, sortBy]);

  const paged = usePaged(rows);

  // Active (non-default) filters for the mobile Filters sheet — badge count + dismissible chips.
  const logisticsFilterChips: { key: string; label: string; onClear: () => void }[] = [];
  if (typeFilter !== "all") logisticsFilterChips.push({ key: "type", label: TYPE_CHIP_LABELS[typeFilter] ?? typeFilter, onClear: () => { setTypeFilter("all"); paged.setPage(1); } });
  if (sortBy !== "updated") logisticsFilterChips.push({ key: "sort", label: SORT_CHIP_LABELS[sortBy] ?? sortBy, onClear: () => { setSortBy("updated"); paged.setPage(1); } });
  const resetLogisticsFilters = () => { setTypeFilter("all"); setSortBy("updated"); paged.setPage(1); };

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
        {activeTab === "mine" && <Button className="btn-primary-gradient" onClick={() => setRaise(true)} data-testid="logistics-raise"><Plus className="h-4 w-4 mr-1.5" /> Raise Request</Button>}
      </div>

      {/* My Requests vs handler To-Process queue */}
      {isHandler && (
        <SplitTabs
          value={tab}
          onValueChange={(v) => { setTab(v as "mine" | "process"); setPhase("active"); paged.setPage(1); }}
          tabs={[
            { value: "mine", label: "My Requests", count: mineActive },
            { value: "process", label: "To Process", count: processActive },
          ]}
        />
      )}

      {/* Controls — view · phase · search · type · sort */}
      {/* Desktop — original inline strip (unchanged). */}
      <div className="hidden sm:flex items-center gap-3 flex-wrap">
        <div className="segmented-toggle inline-flex p-0.5 h-10 flex-shrink-0">
          <button onClick={() => setView("card")} aria-label="Card view" aria-pressed={view === "card"} data-testid="view-card" className={`px-3 h-full rounded-[10px] inline-flex items-center justify-center ${view === "card" ? "btn-primary-gradient text-white" : "text-muted-foreground"}`}><LayoutGrid className="h-4 w-4" /></button>
          <button onClick={() => setView("table")} aria-label="Table view" aria-pressed={view === "table"} data-testid="view-table" className={`px-3 h-full rounded-[10px] inline-flex items-center justify-center ${view === "table" ? "btn-primary-gradient text-white" : "text-muted-foreground"}`}><Table2 className="h-4 w-4" /></button>
        </div>
        <div className="hidden sm:block w-px self-stretch flex-shrink-0 bg-foreground/30" />
        <div className="segmented-toggle inline-flex p-0.5 h-10 flex-shrink-0" data-testid="logistics-phase-toggle">
          {(["active", "done"] as const).map((p) => (
            <button key={p} onClick={() => { setPhase(p); paged.setPage(1); }} aria-pressed={phase === p} data-testid={`logistics-phase-${p}`} className={`px-3 h-full rounded-[10px] text-xs font-medium whitespace-nowrap ${phase === p ? "btn-primary-gradient text-white" : "text-muted-foreground"}`}>
              {p === "active" ? `Active (${activeCount})` : `Closed (${doneCount})`}
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
        <Select value={sortBy} onValueChange={(v) => { setSortBy(v); paged.setPage(1); }}>
          <SelectTrigger className="h-10 w-[210px] gap-1 flex-shrink-0" data-testid="select-sort"><ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" /><span className="text-muted-foreground">Sort:</span><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Latest Update</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mobile — search + Filters on one row; view · phase toggles below; Type + Sort go in a Filters sheet. */}
      <div className="sm:hidden space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); paged.setPage(1); }} placeholder="Search reference, route, cargo…" className="pl-8 h-10 w-full" data-testid="input-search-logistics-mobile" />
          </div>
          <Sheet open={filterSheet} onOpenChange={setFilterSheet}>
            <SheetTrigger asChild>
              <Button variant="secondary" size="sm" className="flex-shrink-0" data-testid="button-filters-mobile">
                <SlidersHorizontal className="h-4 w-4 mr-1.5" /> Filters
                {logisticsFilterChips.length > 0 && <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#206295] px-1 text-[10px] font-bold text-white">{logisticsFilterChips.length}</span>}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
              <SheetHeader className="text-left"><SheetTitle>Filters</SheetTitle></SheetHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Type</p>
                  <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); paged.setPage(1); }}>
                    <SelectTrigger className="w-full" data-testid="sheet-type-filter"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="inboard">Inboard</SelectItem>
                      <SelectItem value="outboard">Outboard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Sort</p>
                  <Select value={sortBy} onValueChange={(v) => { setSortBy(v); paged.setPage(1); }}>
                    <SelectTrigger className="w-full" data-testid="sheet-sort"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="updated">Latest Update</SelectItem>
                      <SelectItem value="newest">Newest</SelectItem>
                      <SelectItem value="oldest">Oldest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <SheetFooter className="flex-row gap-2">
                <Button variant="outline" className="flex-1" onClick={resetLogisticsFilters} data-testid="sheet-reset">Reset</Button>
                <SheetClose asChild><Button className="flex-1 btn-primary-gradient text-white" data-testid="sheet-apply">Show results</Button></SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="segmented-toggle inline-flex p-0.5 h-10 flex-shrink-0">
            <button onClick={() => setView("card")} aria-label="Card view" aria-pressed={view === "card"} data-testid="view-card-mobile" className={`px-3 h-full rounded-[10px] inline-flex items-center justify-center ${view === "card" ? "btn-primary-gradient text-white" : "text-muted-foreground"}`}><LayoutGrid className="h-4 w-4" /></button>
            <button onClick={() => setView("table")} aria-label="Table view" aria-pressed={view === "table"} data-testid="view-table-mobile" className={`px-3 h-full rounded-[10px] inline-flex items-center justify-center ${view === "table" ? "btn-primary-gradient text-white" : "text-muted-foreground"}`}><Table2 className="h-4 w-4" /></button>
          </div>
          <div className="segmented-toggle inline-flex p-0.5 h-10 flex-shrink-0" data-testid="logistics-phase-toggle-mobile">
            {(["active", "done"] as const).map((p) => (
              <button key={p} onClick={() => { setPhase(p); paged.setPage(1); }} aria-pressed={phase === p} data-testid={`logistics-phase-${p}-mobile`} className={`px-3 h-full rounded-[10px] text-xs font-medium whitespace-nowrap ${phase === p ? "btn-primary-gradient text-white" : "text-muted-foreground"}`}>
                {p === "active" ? `Active (${activeCount})` : `Closed (${doneCount})`}
              </button>
            ))}
          </div>
        </div>
        {logisticsFilterChips.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {logisticsFilterChips.map((c) => (
              <button key={c.key} onClick={c.onClear} className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2.5 py-1 text-xs text-foreground hover-elevate" data-testid={`chip-${c.key}`}>
                <span className="truncate max-w-[8rem]">{c.label}</span> <X className="h-3 w-3 flex-shrink-0" />
              </button>
            ))}
            {logisticsFilterChips.length > 1 && <button onClick={resetLogisticsFilters} className="text-xs font-medium text-[#206295] underline underline-offset-2" data-testid="chip-clear-all">Clear all</button>}
          </div>
        )}
      </div>

      {/* List */}
      {rows.length === 0 ? (
        <div className="card-surface rounded-2xl py-16 text-center"><Truck className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-sm text-muted-foreground">No logistics requests here.</p></div>
      ) : view === "table" ? (
        <Card className="border-0"><CardContent className="p-0">
          <DataTable
            columns={[
              { key: "reference", header: "Order ID", cellClassName: "", render: (r: any) => (
                <div className="flex items-center gap-2">
                  <span className="h-7 w-7 rounded-lg bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0"><Truck className="h-3.5 w-3.5" /></span>
                  <div className="min-w-0">
                    <span className="font-semibold text-[#206295] whitespace-nowrap">{r.reference}</span>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                      <span>{r.requestType === "inboard" ? "Inboard" : "Outboard"}</span>
                      {r.priority === "urgent" && <span className="font-semibold text-[#C4402F]">· Urgent</span>}
                    </div>
                  </div>
                </div>
              ) },
              { key: "requester", header: "Requester", cellClassName: "", render: (r: any) => (
                <div className="min-w-0 max-w-[12rem]">
                  <p className="font-medium text-foreground truncate">{r.requesterName || "Unassigned"}</p>
                  {r.requesterDept && <p className="text-xs text-muted-foreground truncate">{r.requesterDept}</p>}
                </div>
              ) },
              { key: "route", header: "Route", render: (r: any) => (
                <div className="min-w-0 max-w-[16rem]">
                  <div className="flex items-center gap-2 min-w-0"><span className="h-2 w-2 rounded-full border border-muted-foreground flex-shrink-0" /><span className="truncate text-foreground">{flatLoc(r.fromLocationText || locName(r.fromLocationId))}</span></div>
                  <div className="ml-[3px] h-3 w-px bg-muted-foreground/40" />
                  <div className="flex items-center gap-2 min-w-0"><span className="h-2 w-2 rounded-full bg-[#206295] flex-shrink-0" /><span className="truncate text-foreground">{flatLoc(r.toLocationText || locName(r.toLocationId))}</span></div>
                </div>
              ) },
              { key: "cargo", header: "Cargo", cellClassName: "", render: (r: any) => (
                <div className="min-w-0 max-w-[10rem]">
                  <p className="text-foreground whitespace-nowrap">{Number(r.quantity) || 0} unit{Number(r.quantity) === 1 ? "" : "s"}</p>
                  {r.goodsCategory && <p className="text-xs text-muted-foreground truncate capitalize">{r.goodsCategory}</p>}
                </div>
              ) },
              { key: "weight", header: "Weight", align: "right", cellClassName: "whitespace-nowrap", render: (r: any) => (r.weightKg ? `${Number(r.weightKg)} kg` : "—") },
              { key: "pickup", header: "Pickup", cellClassName: "text-muted-foreground whitespace-nowrap", render: (r: any) => fmtDate(r.pickupDate) },
              { key: "eta", header: "ETA", cellClassName: "text-muted-foreground whitespace-nowrap", render: (r: any) => fmtDate(r.deliveryDate) },
              { key: "status", header: "Status", cellClassName: "", render: (r: any) => <Badge className={`gap-1.5 text-xs ${statusClass(r.status)}`}><span className="h-1.5 w-1.5 rounded-full bg-current" /> {statusLabel(r.status)}</Badge> },
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
            const pageUrgent = paged.pageItems.filter((r: any) => r.priority === "urgent").length;
            const pageStandard = paged.pageItems.length - pageUrgent;
            let prev: boolean | null = null;
            paged.pageItems.forEach((r) => {
              if (phase === "active") {
                const u = r.priority === "urgent";
                if (u !== prev) {
                  const count = u ? pageUrgent : pageStandard;
                  out.push(
                    <div key={`sec-${u}`} className="flex items-center gap-2 pt-3 first:pt-0">
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
