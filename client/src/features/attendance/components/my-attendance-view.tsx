import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  parseMeta, buildWfhApproval, buildEffectiveStatus, monthStats, travelDaysFrom,
} from "../lib/my-attendance-model";
import {
  useMyAttendanceMonth, useTodayAttendanceList, useEndOnDuty, useEndLeave,
} from "../api/attendance.api";
import { MyAttendanceHeader, MyAttendanceStats } from "./my-attendance-sections";
import { MyAttendanceCalendar } from "./my-attendance-calendar";
import { ActivityDetailsCard } from "./activity-details-card";
import { TodaysAttendanceCard } from "./todays-attendance-card";
import { MarkOnDutyDialog } from "./mark-on-duty-dialog";
import { ApplyWfhDialog } from "./apply-wfh-dialog";

export function MyAttendanceView() {
  const now = new Date();
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState<Date>(new Date());
  const [view, setView] = useState<"calendar" | "timeline">("calendar");
  const [calFilter, setCalFilter] = useState<string>("all");
  const [dutyOpen, setDutyOpen] = useState(false);
  const [wfhOpen, setWfhOpen] = useState(false);
  // Deep-link support: /attendance?action=on-duty | wfh (used by the dashboard's header buttons) opens the dialog.
  useEffect(() => {
    const action = new URLSearchParams(window.location.search).get("action");
    if (action === "on-duty") setDutyOpen(true);
    else if (action === "wfh") setWfhOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { toast } = useToast();

  const endOnDuty = useEndOnDuty({
    onSuccess: () => toast({ title: "On Duty ended" }),
    onError: (e: any) => toast({ title: "Couldn't end On Duty", description: e.message, variant: "destructive" }),
  });
  const endOnLeave = useEndLeave({
    onSuccess: () => toast({ title: "Leave ended", description: "Un-taken days were returned to your balance." }),
    onError: (e: any) => toast({ title: "Couldn't end leave", description: e.message, variant: "destructive" }),
  });

  const m = cursor.getMonth() + 1, y = cursor.getFullYear();
  const { data: records = [] } = useMyAttendanceMonth(m, y);
  const { data: holidays = [] } = useQuery<any[]>({ queryKey: [`/api/holidays?year=${y}`] });
  const { data: myEmp } = useQuery<any>({ queryKey: ["/api/employees/me"] });
  const { data: todayList = [] } = useTodayAttendanceList();
  const { data: myTrips = [] } = useQuery<any[]>({ queryKey: ["/api/travel?mine=true"] });

  const dstr = (d: Date) => format(d, "yyyy-MM-dd");
  const byDate = useMemo(() => { const map: Record<string, any> = {}; (records as any[]).forEach((r) => { map[r.date] = r; }); return map; }, [records]);
  const travelDays = useMemo(() => travelDaysFrom(myTrips as any[]), [myTrips]);
  const holidaySet = useMemo(() => new Set((holidays as any[]).map((h) => h.date)), [holidays]);
  const todayStr = dstr(now);
  // Employment window — nothing is "Present" before joining or after the last working day.
  const joinStr = myEmp?.joinDate ? String(myEmp.joinDate).slice(0, 10) : null;
  const exitStr = myEmp?.lastWorkingDate ? String(myEmp.lastWorkingDate).slice(0, 10) : null;

  const wfhApproval = buildWfhApproval(now);
  const effectiveStatus = buildEffectiveStatus({ byDate, holidaySet, todayStr, joinStr, exitStr, wfhApproval });

  const monthDays = useMemo(() => eachDayOfInterval({ start: startOfWeek(startOfMonth(cursor)), end: endOfWeek(endOfMonth(cursor)) }), [cursor]);
  const stats = useMemo(
    () => monthStats({ cursor, now, effectiveStatus }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [records, cursor, holidaySet, now],
  );
  const timeline = useMemo(() => [...(records as any[])].sort((a, b) => (a.date < b.date ? 1 : -1)), [records]);

  const selRec = byDate[dstr(selected)];
  const selMeta = useMemo(() => { const j = parseMeta(selRec); return j && j.kind === "on_duty" ? j : null; }, [selRec]);
  const selWfhAp = selRec?.status === "wfh" ? wfhApproval(selRec) : null;
  const selWfhMeta = selWfhAp ? parseMeta(selRec) : null;
  const selStatus = effectiveStatus(selected);
  const selHoliday = (holidays as any[]).find((h) => h.date === dstr(selected));
  const todayOnDuty = byDate[todayStr]?.status === "on_duty";
  const canEndLeave = (selStatus === "leave" || selStatus === "half_day") && !!selRec?.leaveRequestId && dstr(selected) >= todayStr;

  return (
    <div className="p-6 space-y-5 max-w-[92rem] mx-auto">
      <MyAttendanceHeader
        onApplyWfh={() => setWfhOpen(true)}
        onMarkOnDuty={() => todayOnDuty ? toast({ title: "On Duty already marked for today" }) : setDutyOpen(true)}
      />

      <MyAttendanceStats stats={stats} />

      {/* Bottom row — aligned to the 3-col overview above (calendar = 2 cols, bento = 1 col, same gap).
          Columns stretch to equal height so the right column's last card bottom-aligns with the calendar. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:items-stretch">
        <MyAttendanceCalendar
          view={view} onView={setView}
          calFilter={calFilter} onCalFilter={setCalFilter}
          cursor={cursor} onCursor={setCursor}
          selected={selected} onSelect={setSelected}
          monthDays={monthDays} timeline={timeline}
          now={now} todayStr={todayStr}
          effectiveStatus={effectiveStatus} wfhApproval={wfhApproval}
          byDate={byDate} travelDays={travelDays}
        />

        {/* Right column: the inner stack is absolutely positioned on lg so it fills the
            calendar's height WITHOUT its own content dictating the row height. */}
        <div className="lg:col-span-1 relative min-h-0">
          <div className="flex flex-col gap-4 lg:absolute lg:inset-0">
            <ActivityDetailsCard
              selected={selected} now={now}
              selStatus={selStatus} selRec={selRec} selMeta={selMeta}
              selWfhAp={selWfhAp} selWfhMeta={selWfhMeta} selHoliday={selHoliday}
              canEndLeave={canEndLeave}
              endingOnDuty={endOnDuty.isPending} endingLeave={endOnLeave.isPending}
              onEndOnDuty={() => endOnDuty.mutate()}
              onEndLeave={() => endOnLeave.mutate(selRec.leaveRequestId)}
            />
            <TodaysAttendanceCard todayList={todayList as any[]} myEmp={myEmp} />
          </div>
        </div>
      </div>

      <MarkOnDutyDialog open={dutyOpen} onClose={() => setDutyOpen(false)} />
      <ApplyWfhDialog open={wfhOpen} onClose={() => setWfhOpen(false)} />
    </div>
  );
}
