import { useState } from "react";
import { useAuth, isAdmin } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { yearOptions, exportHolidays } from "../lib/holidays";
import { useHolidays, useDeleteHoliday } from "../api/holidays.api";
import {
  HolidaysHeader, HolidaysStats, HolidaysFilterBar,
  HolidaysLoading, HolidaysEmpty, HolidayList,
} from "../components/holidays-sections";
import { HolidayCalendarView } from "../components/holiday-calendar-view";
import { UpcomingHolidaysCard } from "../components/upcoming-holidays-card";
import { HolidayDialog } from "../components/holiday-dialog";

export default function HolidaysPage() {
  const { data: auth } = useAuth();
  const { toast } = useToast();
  const canManage = isAdmin(auth?.user!); // Super Admin & HR Admin only

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

  const today = new Date();
  const upcoming = holidays.filter((h) => new Date(h.date) >= today).sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const monthHolidays = filtered.filter((h) => { const d = new Date(h.date); return d.getMonth() === calMonth.getMonth() && d.getFullYear() === calMonth.getFullYear(); });

  return (
    <div className="p-6 space-y-6 max-w-[92rem] mx-auto">
      <HolidaysHeader
        canManage={canManage}
        onExport={() => exportHolidays(filtered, year, location)}
        onAdd={() => setShowAdd(true)}
      />

      <HolidaysStats
        total={holidays.length}
        mandatory={holidays.filter((h) => !h.isOptional).length}
        optional={holidays.filter((h) => h.isOptional).length}
        nextHoliday={upcoming[0]}
        year={year}
      />

      <HolidaysFilterBar
        view={view} onView={setView}
        search={search} onSearch={setSearch}
        year={year} onYear={(y) => { setYear(y); setCalMonth(new Date(y, 0, 1)); }} years={yearOptions(currentYear)}
        location={location} onLocation={setLocation}
        typeFilter={typeFilter} onTypeFilter={setTypeFilter}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {isLoading ? (
            <HolidaysLoading />
          ) : filtered.length === 0 ? (
            <HolidaysEmpty canManage={canManage} />
          ) : view === "list" ? (
            <HolidayList holidays={filtered} canManage={canManage} onEdit={setEditing} onDelete={onDelete} />
          ) : (
            <HolidayCalendarView
              calMonth={calMonth}
              onMonthChange={setCalMonth}
              holidayDates={filtered.map((h) => new Date(h.date))}
              monthHolidays={monthHolidays}
              canManage={canManage}
              onEdit={setEditing}
              onDelete={onDelete}
            />
          )}
        </div>

        <div>
          <UpcomingHolidaysCard upcoming={upcoming} today={today} />
        </div>
      </div>

      <HolidayDialog open={showAdd} onOpenChange={setShowAdd} defaultYear={year} />
      {editing && <HolidayDialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)} holiday={editing} defaultYear={year} />}
    </div>
  );
}
