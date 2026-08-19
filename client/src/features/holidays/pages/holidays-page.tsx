import { useState } from "react";
import { useAuth, isAdmin } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Download, Search, List, CalendarDays, CalendarCheck, CalendarClock, Star,
} from "lucide-react";
import { format } from "date-fns";
import { LOCATIONS, yearOptions, exportHolidays } from "../lib/holidays";
import { useHolidays, useDeleteHoliday } from "../api/holidays.api";
import { StatCard, HolidayCard } from "../components/holiday-ui";
import { HolidayDialog } from "../components/holiday-dialog";
import { HolidayCalendarView } from "../components/holiday-calendar-view";
import { UpcomingHolidaysCard } from "../components/upcoming-holidays-card";

export default function HolidaysPage() {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const { toast } = useToast();
  const canManage = isAdmin(user!); // Super Admin & HR Admin only

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [location, setLocation] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "calendar">("list");
  const [calMonth, setCalMonth] = useState<Date>(new Date(currentYear, new Date().getMonth(), 1));
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data: holidays = [], isLoading } = useHolidays(year, location);

  const deleteHoliday = useDeleteHoliday({
    onSuccess: () => toast({ title: "Holiday deleted" }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const onDelete = (h: any) => { if (window.confirm(`Delete "${h.name}"?`)) deleteHoliday.mutate(h.id); };

  const filtered = holidays.filter((h) => {
    const matchType = typeFilter === "all" || (typeFilter === "optional" ? h.isOptional : !h.isOptional);
    const q = search.trim().toLowerCase();
    const matchSearch = !q || h.name?.toLowerCase().includes(q) || (h.description || "").toLowerCase().includes(q) || (h.location || "").toLowerCase().includes(q);
    return matchType && matchSearch;
  }).sort((a, b) => +new Date(a.date) - +new Date(b.date));

  // overview (based on the year + location result)
  const total = holidays.length;
  const mandatory = holidays.filter((h) => !h.isOptional).length;
  const optional = holidays.filter((h) => h.isOptional).length;
  const today = new Date();
  const upcoming = holidays.filter((h) => new Date(h.date) >= today).sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const nextHoliday = upcoming[0];

  const years = yearOptions(currentYear);
  const monthHolidays = filtered.filter((h) => { const d = new Date(h.date); return d.getMonth() === calMonth.getMonth() && d.getFullYear() === calMonth.getFullYear(); });
  const holidayDates = filtered.map((h) => new Date(h.date));

  const viewBtns: { v: typeof view; icon: any; label: string }[] = [
    { v: "list", icon: List, label: "List" },
    { v: "calendar", icon: CalendarDays, label: "Calendar" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[92rem] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Holiday Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">Company holidays, mandatory and optional, across locations</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => exportHolidays(filtered, year, location)} data-testid="button-export-holidays"><Download className="h-4 w-4 mr-1" /> Export</Button>
          {canManage && <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-holiday"><Plus className="h-4 w-4 mr-1" /> Add Holiday</Button>}
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Holidays" value={total} subtitle={`in ${year}`} icon={CalendarDays} color="bg-[#206295]/15 text-[#206295]" />
        <StatCard title="Mandatory" value={mandatory} subtitle="company-wide" icon={CalendarCheck} color="bg-[#4BDCD9]/25 text-[#206295]" />
        <StatCard title="Optional" value={optional} subtitle="restricted holidays" icon={Star} color="bg-[#FF6F62]/20 text-[#FF6F62]" />
        <StatCard title="Next Holiday" value={nextHoliday ? format(new Date(nextHoliday.date), "MMM d") : "—"} subtitle={nextHoliday ? nextHoliday.name : "None upcoming"} icon={CalendarClock} color="bg-[#206295]/15 text-[#206295]" />
      </div>

      {/* Controls: view toggle + search + filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 segmented-toggle p-1">
          {viewBtns.map((b) => (
            <button key={b.v} onClick={() => setView(b.v)} data-testid={`view-${b.v}`}
              className={`flex items-center gap-1 h-8 px-3 rounded-[8px] text-xs transition-colors ${view === b.v ? "btn-primary-gradient text-white" : "text-muted-foreground hover-elevate"}`}>
              <b.icon className="h-4 w-4" /> {b.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search holidays…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-holidays" />
        </div>
        <Select value={String(year)} onValueChange={(v) => { const y = Number(v); setYear(y); setCalMonth(new Date(y, 0, 1)); }}>
          <SelectTrigger className="w-28" data-testid="select-year"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={location} onValueChange={setLocation}>
          <SelectTrigger className="w-36" data-testid="select-location"><SelectValue placeholder="Location" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {LOCATIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36" data-testid="select-type"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="mandatory">Mandatory</SelectItem>
            <SelectItem value="optional">Optional</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {isLoading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <Card key={i} className="border-0"><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16"><CalendarDays className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" /><h3 className="text-lg font-semibold text-foreground">No holidays found</h3><p className="text-sm text-muted-foreground mt-1">Try adjusting your filters{canManage ? " or add one." : "."}</p></div>
          ) : view === "list" ? (
            <div className="space-y-3">
              {filtered.map((h) => <HolidayCard key={h.id} h={h} canManage={canManage} onEdit={setEditing} onDelete={onDelete} />)}
            </div>
          ) : (
            <HolidayCalendarView
              calMonth={calMonth}
              onMonthChange={setCalMonth}
              holidayDates={holidayDates}
              monthHolidays={monthHolidays}
              canManage={canManage}
              onEdit={setEditing}
              onDelete={onDelete}
            />
          )}
        </div>

        {/* Upcoming sidebar */}
        <div>
          <UpcomingHolidaysCard upcoming={upcoming} today={today} />
        </div>
      </div>

      <HolidayDialog open={showAdd} onOpenChange={setShowAdd} defaultYear={year} />
      {editing && <HolidayDialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)} holiday={editing} defaultYear={year} />}
    </div>
  );
}
