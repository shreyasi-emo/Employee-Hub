import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, isAdmin } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateInput } from "@/components/shared/datetime-field";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar as CalendarGrid } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Pencil, Download, Search, List, CalendarDays, CalendarCheck,
  CalendarClock, Star, MapPin,
} from "lucide-react";
import { format } from "date-fns";
import { exportXlsx } from "@/lib/export-xlsx";

const LOCATIONS = ["Mumbai", "Pune", "Chennai", "Hyderabad", "Bengaluru"];

function StatCard({ title, value, subtitle, icon: Icon, color }: { title: string; value: any; subtitle?: string; icon: any; color: string; }) {
  return (
    <Card className="border-0 card-hover"><CardContent className="p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 flex-1 min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-[33px] leading-tight font-bold text-foreground truncate">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-xl flex-shrink-0 ${color}`}><Icon className="h-5 w-5" /></div>
      </div>
    </CardContent></Card>
  );
}

// ===================== Add / Edit dialog =====================
function HolidayDialog({ open, onOpenChange, holiday, defaultYear }: { open: boolean; onOpenChange: (v: boolean) => void; holiday?: any; defaultYear: number; }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isEdit = !!holiday;
  const blank = { name: "", date: `${defaultYear}-01-01`, location: "all", type: "mandatory", description: "" };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (!open) return;
    if (holiday) setForm({ name: holiday.name || "", date: holiday.date, location: holiday.location || "all", type: holiday.isOptional ? "optional" : "mandatory", description: holiday.description || "" });
    else setForm({ ...blank });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, holiday]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name, date: form.date, location: form.location,
        isOptional: form.type === "optional", isRestricted: form.type === "optional",
        year: new Date(form.date).getFullYear(), description: form.description || null,
      };
      return isEdit ? apiRequest("PUT", `/api/holidays/${holiday.id}`, payload) : apiRequest("POST", "/api/holidays", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/holidays") });
      toast({ title: isEdit ? "Holiday updated" : "Holiday added" });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? "Edit Holiday" : "Add Holiday"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Holiday Name *</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Independence Day" data-testid="input-holiday-name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <DateInput value={form.date} onChange={(v) => setForm((f) => ({ ...f, date: v }))} testId="input-holiday-date" />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger data-testid="select-holiday-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mandatory">Mandatory</SelectItem>
                  <SelectItem value="optional">Optional / Restricted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Select value={form.location} onValueChange={(v) => setForm((f) => ({ ...f, location: v }))}>
              <SelectTrigger data-testid="select-holiday-location"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {LOCATIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.name || !form.date} data-testid="button-submit-holiday">
              {mutation.isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Holiday"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===================== List-view holiday card =====================
function HolidayCard({ h, canManage, onEdit, onDelete }: { h: any; canManage: boolean; onEdit: (h: any) => void; onDelete: (h: any) => void; }) {
  const date = new Date(h.date);
  return (
    <Card className="border-0 card-hover" data-testid={`holiday-${h.id}`}><CardContent className="p-4">
      <div className="flex items-start gap-4">
        <div className={`w-12 flex-shrink-0 rounded-[12px] py-1.5 text-center ${h.isOptional ? "bg-[#FF6F62]/20 text-[#FF6F62]" : "bg-[#206295]/15 text-[#206295]"}`}>
          <p className="text-lg font-bold leading-tight">{format(date, "d")}</p>
          <p className="text-[10px] uppercase tracking-wide">{format(date, "MMM")}</p>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground">{h.name}</p>
              <p className="text-xs text-muted-foreground">{format(date, "EEEE, MMMM d, yyyy")}</p>
            </div>
            {canManage && (
              <div className="flex gap-1.5 flex-shrink-0">
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onEdit(h)} aria-label="Edit" data-testid={`button-edit-holiday-${h.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="outline" className="h-7 w-7 text-[#FF6F62] border-[#FF6F62]/30" onClick={() => onDelete(h)} aria-label="Delete" data-testid={`button-delete-holiday-${h.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Badge className={`text-xs ${h.isOptional ? "bg-[#FF6F62]/20 text-[#FF6F62]" : "bg-[#4BDCD9]/25 text-[#206295]"}`}>{h.isOptional ? "Optional" : "Mandatory"}</Badge>
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {h.location === "all" ? "All locations" : h.location}</span>
          </div>
          {h.description && <p className="text-xs text-muted-foreground mt-1.5">{h.description}</p>}
        </div>
      </div>
    </CardContent></Card>
  );
}

export default function HolidaysPage() {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const { toast } = useToast();
  const qc = useQueryClient();
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

  const { data: holidays = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/holidays?year=${year}&location=${location}`],
  });

  const deleteHoliday = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/holidays/${id}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/holidays") });
      toast({ title: "Holiday deleted" });
    },
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

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  const monthHolidays = filtered.filter((h) => { const d = new Date(h.date); return d.getMonth() === calMonth.getMonth() && d.getFullYear() === calMonth.getFullYear(); });
  const holidayDates = filtered.map((h) => new Date(h.date));

  function exportHolidays() {
    const headers = ["Holiday", "Date", "Day", "Type", "Location", "Description"];
    const rows = filtered.map((h) => { const d = new Date(h.date); return [h.name, format(d, "dd MMM yyyy"), format(d, "EEEE"), h.isOptional ? "Optional" : "Mandatory", h.location === "all" ? "All" : h.location, h.description || ""]; });
    exportXlsx({
      filename: `holidays-${year}-${location === "all" ? "all" : location.toLowerCase()}.xlsx`,
      sheet: "Holidays",
      title: `Holiday Calendar ${year} — ${location === "all" ? "All Locations" : location}`,
      headers, rows,
    });
  }

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
          <Button variant="secondary" size="sm" onClick={exportHolidays} data-testid="button-export-holidays"><Download className="h-4 w-4 mr-1" /> Export</Button>
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
            <Card className="border-0"><CardContent className="p-4">
              <CalendarGrid
                month={calMonth}
                onMonthChange={setCalMonth}
                modifiers={{ holiday: holidayDates }}
                modifiersClassNames={{ holiday: "bg-[#206295]/15 text-[#206295] font-semibold" }}
                showOutsideDays
                className="w-full p-0"
                classNames={{
                  months: "w-full",
                  month: "w-full space-y-3",
                  caption: "flex justify-center pt-1 relative items-center",
                  table: "w-full border-collapse",
                  head_row: "flex w-full",
                  head_cell: "flex-1 text-muted-foreground font-normal text-[0.8rem]",
                  row: "flex w-full mt-1.5",
                  cell: "flex-1 p-0.5 text-center text-sm relative",
                  day: "h-11 w-full rounded-[10px] font-normal hover-elevate inline-flex items-center justify-center aria-selected:opacity-100",
                  day_today: "bg-accent text-accent-foreground",
                  day_outside: "text-muted-foreground/50",
                }}
              />
              <div className="mt-2 border-t border-border pt-3">
                <p className="text-sm font-semibold text-foreground mb-2">{format(calMonth, "MMMM yyyy")} · {monthHolidays.length} holiday{monthHolidays.length !== 1 ? "s" : ""}</p>
                {monthHolidays.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No holidays this month.</p>
                ) : (
                  <div className="list-divider">
                    {monthHolidays.map((h) => {
                      const d = new Date(h.date);
                      return (
                        <div key={h.id} className="flex items-center gap-3 py-2">
                          <div className={`w-9 text-center rounded-[10px] py-0.5 flex-shrink-0 ${h.isOptional ? "bg-[#FF6F62]/20 text-[#FF6F62]" : "bg-[#206295]/15 text-[#206295]"}`}>
                            <p className="text-sm font-bold leading-tight">{format(d, "d")}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{h.name}</p>
                            <p className="text-xs text-muted-foreground">{format(d, "EEEE")} · {h.location === "all" ? "All locations" : h.location}</p>
                          </div>
                          <Badge className={`text-xs flex-shrink-0 ${h.isOptional ? "bg-[#FF6F62]/20 text-[#FF6F62]" : "bg-[#4BDCD9]/25 text-[#206295]"}`}>{h.isOptional ? "Optional" : "Mandatory"}</Badge>
                          {canManage && (
                            <div className="flex gap-1.5 flex-shrink-0">
                              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setEditing(h)} aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button size="icon" variant="outline" className="h-7 w-7 text-[#FF6F62] border-[#FF6F62]/30" onClick={() => onDelete(h)} aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent></Card>
          )}
        </div>

        {/* Upcoming sidebar */}
        <div>
          <Card className="border-0"><CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><CalendarClock className="h-4 w-4 text-muted-foreground" /> Upcoming Holidays</CardTitle></CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming holidays</p>
              ) : (
                <div className="list-divider">
                  {upcoming.slice(0, 6).map((h) => {
                    const date = new Date(h.date);
                    const daysLeft = Math.ceil((date.getTime() - today.getTime()) / 86400000);
                    return (
                      <div key={h.id} className="flex items-center gap-3 py-2.5">
                        <div className="w-10 h-10 rounded-[12px] bg-[#206295]/10 flex flex-col items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-[#206295] leading-tight">{format(date, "d")}</span>
                          <span className="text-[10px] text-[#206295]/70 leading-tight">{format(date, "MMM")}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{h.name}</p>
                          <p className="text-xs text-muted-foreground">{daysLeft <= 0 ? "Today!" : daysLeft === 1 ? "Tomorrow" : `In ${daysLeft} days`}</p>
                        </div>
                        {h.isOptional && <Badge className="bg-[#FF6F62]/20 text-[#FF6F62] text-[10px] flex-shrink-0">Optional</Badge>}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <HolidayDialog open={showAdd} onOpenChange={setShowAdd} defaultYear={year} />
      {editing && <HolidayDialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)} holiday={editing} defaultYear={year} />}
    </div>
  );
}
