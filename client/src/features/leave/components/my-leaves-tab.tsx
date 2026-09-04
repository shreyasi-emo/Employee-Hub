import { useState, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/shared/data-table";
import { Plane, Clock, Search, CheckCircle2, XCircle, SlidersHorizontal, X } from "lucide-react";
import { format } from "date-fns";
import { statusOf, findCasualLeaveType, leaveTypeColor, leaveActionFor } from "../lib/leave-model";
import { StatCard } from "./leave-ui";

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = { pending: "Pending", approved: "Approved", rejected: "Rejected", cancelled: "Cancelled" };

/** The employee's own requests: four stat cards, filters, and the table.
 *  Owns its own search/status/type filter state. */
export function MyLeavesTab({ myYear, leaveTypes, leaveBalances, selectedYear, isLoading, onApply, onCancelRequest, onEndRequest }: {
  myYear: any[];
  leaveTypes: any[];
  leaveBalances: any[];
  selectedYear: number;
  isLoading: boolean;
  onApply: () => void;
  onCancelRequest: (id: string) => void;
  onEndRequest: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sheetOpen, setSheetOpen] = useState(false);

  const filteredMy = myYear.filter((r: any) => {
    const lt = leaveTypes.find((l: any) => l.id === r.leaveTypeId);
    const matchSearch = !search || (lt?.name || "").toLowerCase().includes(search.toLowerCase()) || (r.reason || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    const matchType = typeFilter === "all" || r.leaveTypeId === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const clType = findCasualLeaveType(leaveTypes);
  const clBalance = parseFloat(leaveBalances.find((b: any) => b.leaveTypeId === clType?.id)?.closingBalance || "0");
  const pendingCount = myYear.filter((r: any) => r.status === "pending").length;
  const approvedDays = myYear.filter((r: any) => r.status === "approved").reduce((sum: number, r: any) => sum + parseFloat(r.totalDays || "0"), 0);
  const rejectedCount = myYear.filter((r: any) => r.status === "rejected").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Leave Balance" value={clBalance} subtitle="Casual leave available" icon={Plane} color="bg-[#4BDCD9]/25 text-[#206295]" />
        <StatCard title="Pending Requests" value={pendingCount} subtitle="Awaiting approval" icon={Clock} color="bg-[#206295]/15 text-[#206295]" />
        <StatCard title="Approved This Year" value={approvedDays} subtitle={`Days taken in ${selectedYear}`} icon={CheckCircle2} color="bg-[#4BDCD9]/25 text-[#206295]" />
        <StatCard title="Rejected Requests" value={rejectedCount} subtitle={`In ${selectedYear}`} icon={XCircle} color="bg-[#FF6F62]/20 text-[#FF6F62]" />
      </div>

      {/* Filters */}
      {(() => {
        const chips: { key: string; label: string; onClear: () => void }[] = [];
        if (statusFilter !== "all") chips.push({ key: "status", label: STATUS_LABELS[statusFilter] ?? statusFilter, onClear: () => setStatusFilter("all") });
        if (typeFilter !== "all") chips.push({ key: "type", label: leaveTypes.find((lt: any) => lt.id === typeFilter)?.name ?? "Leave Type", onClear: () => setTypeFilter("all") });
        const resetAll = () => { setStatusFilter("all"); setTypeFilter("all"); };
        return (
          <>
            {/* Desktop: search + status + leave type inline (unchanged). */}
            <div className="hidden sm:flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by leave type or reason..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-leave" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36" data-testid="select-status-filter"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40" data-testid="select-type-filter"><SelectValue placeholder="Leave Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {leaveTypes.map((lt: any) => <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Mobile: search + Filters on one row; status + leave type behind one badged Filters sheet. */}
            <div className="sm:hidden space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by leave type or reason..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-leave-mobile" />
                </div>
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                  <SheetTrigger asChild>
                    <Button variant="secondary" size="sm" className="flex-shrink-0" data-testid="button-filters-mobile">
                      <SlidersHorizontal className="h-4 w-4 mr-1.5" /> Filters
                      {chips.length > 0 && <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#206295] px-1 text-[10px] font-bold text-white">{chips.length}</span>}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
                    <SheetHeader className="text-left"><SheetTitle>Filters</SheetTitle></SheetHeader>
                    <div className="space-y-4 py-4">
                      <FilterField label="Status">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="w-full" data-testid="sheet-status-filter"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </FilterField>
                      <FilterField label="Leave Type">
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                          <SelectTrigger className="w-full" data-testid="sheet-type-filter"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            {leaveTypes.map((lt: any) => <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </FilterField>
                    </div>
                    <SheetFooter className="flex-row gap-2">
                      <Button variant="outline" className="flex-1" onClick={resetAll} data-testid="sheet-reset">Reset</Button>
                      <SheetClose asChild><Button className="flex-1 btn-primary-gradient text-white" data-testid="sheet-apply">Show results</Button></SheetClose>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>
              </div>
              {chips.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {chips.map((c) => (
                    <button key={c.key} onClick={c.onClear} className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2.5 py-1 text-xs text-foreground hover-elevate" data-testid={`chip-${c.key}`}>
                      <span className="truncate max-w-[8rem]">{c.label}</span> <X className="h-3 w-3 flex-shrink-0" />
                    </button>
                  ))}
                  {chips.length > 1 && <button onClick={resetAll} className="text-xs font-medium text-[#206295] underline underline-offset-2" data-testid="chip-clear-all">Clear all</button>}
                </div>
              )}
            </div>
          </>
        );
      })()}

      {/* Table */}
      <Card className="border-0"><CardContent className="p-0">
        {isLoading ? (
          <div className="p-4"><Skeleton className="h-32 w-full" /></div>
        ) : filteredMy.length === 0 ? (
          <div className="text-center py-12">
            <Plane className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{myYear.length === 0 ? "No leave requests yet" : "No requests match your filters"}</p>
            {myYear.length === 0 && <Button variant="outline" size="sm" className="mt-3" onClick={onApply}>Apply for Leave</Button>}
          </div>
        ) : (
          <DataTable
            columns={[
              { key: "type", header: "Leave Type", render: (r: any) => { const lt = leaveTypes.find((l: any) => l.id === r.leaveTypeId); return <span className="flex items-center gap-1.5 text-foreground"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: leaveTypeColor(lt) }} />{lt?.name || "—"}</span>; } },
              { key: "dates", header: "Dates", cellClassName: "text-muted-foreground", render: (r: any) => <>{format(new Date(r.startDate), "MMM d")}{r.startDate !== r.endDate ? ` – ${format(new Date(r.endDate), "MMM d, yyyy")}` : `, ${format(new Date(r.startDate), "yyyy")}`}</> },
              { key: "days", header: "Days", cellClassName: "text-muted-foreground", render: (r: any) => `${r.totalDays}d` },
              { key: "reason", header: "Reason", cellClassName: "text-muted-foreground max-w-[16rem] truncate", render: (r: any) => r.reason || "—" },
              { key: "status", header: "Status", render: (r: any) => { const sc = statusOf(r.status); return <Badge className={`text-xs ${sc.bg} ${sc.text}`}>{sc.label}</Badge>; } },
              { key: "action", header: "Action", align: "right", render: (r: any) => {
                const a = leaveActionFor(r);
                if (!a) return <span className="text-xs text-muted-foreground">—</span>;
                const isEnd = a.kind === "end";
                return (
                  <Button
                    size="sm" variant="outline"
                    className={`h-7 text-xs ${isEnd ? "text-[#206295] border-[#206295]/30" : "text-[#FF6F62] border-[#FF6F62]/30"}`}
                    onClick={() => (isEnd ? onEndRequest(r.id) : onCancelRequest(r.id))}
                    data-testid={`button-${a.kind}-leave-${r.id}`}
                  >{a.label}</Button>
                );
              } },
            ]}
            rows={filteredMy}
            getRowKey={(r: any) => r.id}
            testIdPrefix="leave-row"
          />
        )}
      </CardContent></Card>
    </div>
  );
}
