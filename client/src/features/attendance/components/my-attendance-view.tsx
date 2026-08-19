import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval,
} from "date-fns";
import { Home, Route, UserCheck, CircleCheck, Briefcase, CalendarDays } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  parseMeta, buildWfhApproval, buildEffectiveStatus, monthStats, travelDaysFrom,
} from "../lib/my-attendance-model";
import {
  useMyAttendanceMonth, useTodayAttendanceList, useEndOnDuty, useEndLeave,
} from "../api/attendance.api";
import { StatCard } from "./attendance-ui";
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

  // Counts derived from effectiveStatus over the elapsed working days, so they match the calendar.
  const stats = useMemo(
    () => monthStats({ cursor, now, effectiveStatus }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [records, cursor, holidaySet, now],
  );

  const selRec = byDate[dstr(selected)];
  const selMeta = useMemo(() => { const j = parseMeta(selRec); return j && j.kind === "on_duty" ? j : null; }, [selRec]);
  const selWfhAp = selRec?.status === "wfh" ? wfhApproval(selRec) : null;
  const selWfhMeta = selWfhAp ? parseMeta(selRec) : null;
  const selStatus = effectiveStatus(selected);
  const selHoliday = (holidays as any[]).find((h) => h.date === dstr(selected));
  const todayOnDuty = byDate[todayStr]?.status === "on_duty";
  const canEndLeave = (selStatus === "leave" || selStatus === "half_day") && !!selRec?.leaveRequestId && dstr(selected) >= todayStr;

  const timeline = useMemo(() => [...(records as any[])].sort((a, b) => (a.date < b.date ? 1 : -1)), [records]);

  return (
    <div className="p-6 space-y-5 max-w-[92rem] mx-auto">
      {/* Header + primary CTA */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-xl bg-[#206295]/10 text-[#206295] flex items-center justify-center"><UserCheck className="h-5 w-5" /></span>
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Attendance</h1>
            <p className="text-sm text-muted-foreground">View your attendance history and update your work status.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" className="h-10 text-[12px]" onClick={() => setWfhOpen(true)} data-testid="apply-wfh"><Home className="h-4 w-4 mr-1.5" /> Apply Work from Home</Button>
          <Button className="btn-primary-gradient h-10 text-[12px]" onClick={() => todayOnDuty ? toast({ title: "On Duty already marked for today" }) : setDutyOpen(true)} data-testid="mark-on-duty"><Route className="h-4 w-4 mr-1.5" /> Mark On Duty</Button>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 card-hover">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">Present This Month</p>
                <p className="text-[33px] leading-tight font-bold text-foreground tabular-nums">{stats.present}<span className="text-[16px] font-normal text-muted-foreground align-baseline">/{stats.working}</span></p>
                <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{stats.pct}%</span> attendance rate</p>
              </div>
              <div className="p-2.5 rounded-xl flex-shrink-0 bg-[#4BDCD9]/25 text-[#0E7C7B]"><CircleCheck className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 card-hover">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">Work Mode This Month</p>
                <div className="mt-2 grid grid-cols-3 divide-x divide-foreground/25">
                  {[{ label: "Office", n: stats.office, c: "#206295" }, { label: "WFH", n: stats.wfh, c: "#0E7C7B" }, { label: "On Duty", n: stats.onDuty, c: "#4A90C2" }].map((x) => (
                    <div key={x.label} className="px-3 first:pl-0 last:pr-0">
                      <p className="text-[26px] leading-tight font-bold text-foreground tabular-nums">{x.n}</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: x.c }} />{x.label}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-2.5 rounded-xl flex-shrink-0 bg-[#425B8D]/15 text-[#425B8D]"><Briefcase className="h-5 w-5" /></div>
            </div>
          </CardContent>
        </Card>
        <StatCard title="Not Present This Month" value={`${stats.notPresent}`} icon={CalendarDays} color="bg-[#FF6F62]/20 text-[#FF6F62]" subtitle={<p className="text-xs text-muted-foreground">Absent: <span className="font-semibold text-foreground">{stats.absent}</span> | Leave: <span className="font-semibold text-foreground">{stats.leave}</span></p>} />
      </div>

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

        {/* Right — activity details + upcoming holidays. The inner stack is absolutely positioned on
            lg so it fills the calendar's height WITHOUT its own content dictating the row height
            (that's what kept stretching the calendar). The holidays list just scrolls within. */}
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
