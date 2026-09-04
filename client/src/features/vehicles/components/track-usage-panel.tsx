import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { GlassBackButton } from "@/components/shared/glass-back-button";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { Car, Users, User, Search, MapPin, Clock, Route, BarChart3, CalendarDays, ArrowUpDown, Check, ChevronRight } from "lucide-react";
import { format, isSameDay, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { blockOf, fmtRange, overlaps } from "../lib/booking-engine";
import { bookingVisual, statusLabel, statusBadgeClass, avatarTint, driverInitials, empName } from "../lib/booking-visuals";

// ============================ Track Usage side panel (HR) ============================
// Slide-in Sheet (same primitive as Workforce Insights). Two views inside one panel:
// the employee usage list, and — on selecting a person — their vehicle-usage timeline (with a Back button).
export function TrackUsagePanel({ open, onOpenChange, employees, bookings, vehicles, departments }: any) {
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("all");
  const [sort, setSort] = useState<"most" | "least" | "name">("most");
  const [period, setPeriod] = useState<"weekly" | "monthly" | "custom">("monthly");
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>(() => { const t = new Date(); return { from: t, to: t }; });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Active date window the usage counts are computed over.
  const { rangeStart, rangeEnd } = useMemo(() => {
    const t = new Date();
    if (period === "weekly") return { rangeStart: startOfWeek(t, { weekStartsOn: 1 }), rangeEnd: endOfWeek(t, { weekStartsOn: 1 }) };
    if (period === "custom") {
      const f = customRange.from ?? t, to = customRange.to ?? f;
      const lo = f <= to ? f : to, hi = f <= to ? to : f;
      return { rangeStart: startOfDay(lo), rangeEnd: endOfDay(hi) };
    }
    return { rangeStart: startOfMonth(t), rangeEnd: endOfMonth(t) };
  }, [period, customRange]);

  const vehName = (id: string) => (vehicles as any[]).find((v) => v.id === id)?.name || "Vehicle";
  const deptName = (id: string) => (departments as any[]).find((d) => d.id === id)?.name || "—";

  // Per-employee usage: every non-cancelled/rejected booking (within the selected date window)
  // where they were the requester OR a passenger.
  const usage = useMemo(() => {
    const valid = (bookings as any[]).filter((b) => {
      if (b.status === "cancelled" || b.status === "rejected") return false;
      const s = new Date(b.startTime);
      return s >= rangeStart && s <= rangeEnd;
    });
    return (employees as any[]).filter((e) => e.userId).map((e) => {
      const list = valid
        .filter((b) => b.requesterId === e.userId || (Array.isArray(b.attendees) && b.attendees.some((a: any) => a?.userId === e.userId)))
        .sort((a, b) => +new Date(b.startTime) - +new Date(a.startTime));
      return { emp: e, count: list.length, bookings: list };
    }).filter((u) => u.count > 0);
  }, [bookings, employees, rangeStart, rangeEnd]);

  // Department dropdown filters by id; the search box matches employee name OR department name.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return usage
      .filter((u) => dept === "all" || u.emp.departmentId === dept)
      .filter((u) => !q || empName(u.emp).toLowerCase().includes(q) || deptName(u.emp.departmentId).toLowerCase().includes(q))
      .sort((a, b) => sort === "name" ? empName(a.emp).localeCompare(empName(b.emp)) : sort === "least" ? a.count - b.count : b.count - a.count);
  }, [usage, dept, search, sort]);

  const selected = usage.find((u) => u.emp.id === selectedId) || null;
  const usedDeptIds = new Set(usage.map((u) => u.emp.departmentId).filter(Boolean));
  const deptOptions = (departments as any[]).filter((d) => usedDeptIds.has(d.id));
  const SORT_OPTS: { value: "most" | "least" | "name"; label: string }[] = [{ value: "most", label: "Most trips" }, { value: "least", label: "Least trips" }, { value: "name", label: "Name (A–Z)" }];
  const close = (o: boolean) => { if (!o) setSelectedId(null); onOpenChange(o); };

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col gap-0">
        {!selected ? (
          <>
            <SheetHeader className="px-6 pt-6 pb-3 flex-shrink-0">
              <SheetTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-[#206295]" /> Vehicle Usage</SheetTitle>
            </SheetHeader>
            <div className="px-6 pb-3 space-y-2 flex-shrink-0">
              {/* Line 1: search (matches name or department) fills the row */}
              <div className="relative">
                <Search className="h-4 w-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or department…" className="h-9 pl-8 text-sm" data-testid="usage-search" />
              </div>
              {/* Line 2: date window (left) · department + icon-only sort (right) */}
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
                  <SelectTrigger className="w-auto h-9 text-xs gap-1.5" data-testid="usage-period"><CalendarDays className="h-3.5 w-3.5" /><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="custom">Custom Date Range</SelectItem>
                  </SelectContent>
                </Select>
                {period === "custom" && <DateRangePicker value={customRange} onChange={setCustomRange} triggerClassName="h-9" testId="usage-custom-range" />}
                <Select value={dept} onValueChange={setDept}>
                  <SelectTrigger className="w-auto h-9 text-xs gap-1.5 ml-auto" data-testid="usage-dept"><SelectValue placeholder="Department" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {deptOptions.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" aria-label="Sort" data-testid="usage-sort"><ArrowUpDown className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {SORT_OPTS.map((o) => (
                      <DropdownMenuItem key={o.value} onClick={() => setSort(o.value)} className="text-sm gap-2" data-testid={`sort-${o.value}`}>
                        <Check className={`h-4 w-4 text-[#206295] ${sort === o.value ? "opacity-100" : "opacity-0"}`} /> {o.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <ScrollArea className="flex-1 min-h-0">
              <div className="px-6 pt-1 pb-8 space-y-2">
                {filtered.length === 0 ? (
                  <div className="text-center py-16"><Car className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm text-muted-foreground">No usage recorded yet.</p></div>
                ) : filtered.map((u) => {
                  const name = empName(u.emp);
                  return (
                    <button key={u.emp.id} onClick={() => setSelectedId(u.emp.id)} className="w-full flex items-center gap-3 rounded-xl border border-border/60 p-3 text-left hover-elevate" data-testid={`usage-emp-${u.emp.id}`}>
                      <Avatar className="h-9 w-9 flex-shrink-0"><AvatarImage src={u.emp.avatarUrl} /><AvatarFallback className="text-xs bg-[#206295]/15 text-[#206295]">{driverInitials(name)}</AvatarFallback></Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{name}</p>
                        <p className="text-xs text-muted-foreground truncate">{deptName(u.emp.departmentId)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Badge className="bg-[#206295]/15 text-[#206295] text-xs tabular-nums">{u.count} {u.count === 1 ? "trip" : "trips"}</Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        ) : (
          <>
            <SheetHeader className="px-6 pt-6 pb-3 flex-shrink-0">
              <div className="flex items-center gap-3">
                <GlassBackButton onClick={() => setSelectedId(null)} ariaLabel="Back to list" data-testid="usage-back" />
                <Avatar className="h-10 w-10 flex-shrink-0"><AvatarImage src={selected.emp.avatarUrl} /><AvatarFallback className="text-sm bg-[#206295]/15 text-[#206295]">{driverInitials(empName(selected.emp))}</AvatarFallback></Avatar>
                <div className="min-w-0">
                  <SheetTitle className="truncate">{empName(selected.emp)}</SheetTitle>
                  <p className="text-xs text-muted-foreground">{deptName(selected.emp.departmentId)} · {selected.count} {selected.count === 1 ? "trip" : "trips"}</p>
                </div>
              </div>
            </SheetHeader>
            <ScrollArea className="flex-1 min-h-0">
              <div className="px-6 pt-2 pb-8">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-3">Vehicle Usage Timeline</p>
                <div className="relative pl-5 space-y-4 before:absolute before:left-[4px] before:top-1.5 before:bottom-1.5 before:w-px before:bg-border">
                  {selected.bookings.map((b: any) => (
                    <div key={b.id} className="relative" data-testid={`usage-trip-${b.id}`}>
                      <span className={`absolute -left-5 top-1 h-2.5 w-2.5 rounded-full ring-2 ring-background ${b.bookingType === "company_car" ? "bg-[#206295]" : "bg-[#FF6F62]"}`} />
                      <p className="text-sm font-medium text-foreground">{b.purpose}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 inline-flex items-center gap-1.5"><Clock className="h-3 w-3" /> {fmtRange(b.startTime, b.endTime)}</p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <Badge className="text-[10px] bg-muted text-muted-foreground"><Car className="h-3 w-3 mr-1" />{vehName(b.vehicleId)}</Badge>
                        <Badge className={`text-[10px] ${statusBadgeClass(b)}`}>{statusLabel(b)}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
