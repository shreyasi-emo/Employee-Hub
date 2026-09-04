import { CARD_STYLE, ATT_COLORS } from "../lib/dashboard-visuals";
import { useQuery } from "@tanstack/react-query";
import { useAuth, isHR, isManager, isExecutive, getRoleLabel } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Users, Plane, Calendar, ArrowRight, UserCheck, ClipboardList, ShoppingCart, Car, CalendarDays, Route, Home, Hash, Briefcase, Mail, ArrowUpRight, PartyPopper, MoreVertical } from "lucide-react";
import { todayEvent } from "@/features/employees/lib/employee-helpers";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { format } from "date-fns";
import { Stats } from "../types";
import { StatCard, AnnouncementCard, ServiceRequestRow } from "../components/dashboard-ui";
import { CalendarCard } from "../components/calendar-card";
import { QuickActionsRow } from "../components/quick-actions-row";
import { MeetTheTeamCard } from "../components/meet-the-team-card";
import { RecentActivityCard } from "../components/recent-activity-card";

export default function DashboardPage() {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const emp = auth?.employee;

  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  // Company-wide totals — only fetched for the HR/admin layout, so a plain manager's
  // browser never receives org-wide numbers (the stats grid is hidden for them anyway).
  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({ queryKey: ["/api/dashboard/stats"], enabled: isHR(user!) || isExecutive(user!) });
  const { data: announcements = [], isLoading: annLoading } = useQuery<any[]>({ queryKey: ["/api/announcements"] });
  const { data: leaveRequests = [] } = useQuery<any[]>({ queryKey: ["/api/leave-requests"] });
  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/employees"],
    enabled: !!user, // used by the "Meet the Team" directory (sanitized list) + admin panels
  });
  const { data: myAttendance = [] } = useQuery<any[]>({
    queryKey: emp ? [`/api/attendance?employeeId=${emp.id}&month=${currentMonth}&year=${currentYear}`] : [],
    enabled: !!emp,
  });
  const { data: myLeaveBalances = [] } = useQuery<any[]>({
    queryKey: emp ? [`/api/leave-balances?employeeId=${emp.id}&year=${currentYear}`] : [],
    enabled: !!emp,
  });
  const { data: myPayslips = [] } = useQuery<any[]>({
    queryKey: ["/api/payslips/me"],
  });
  const { data: myEmp } = useQuery<any>({ queryKey: ["/api/employees/me"], enabled: !!emp });
  const { data: departments = [] } = useQuery<any[]>({ queryKey: ["/api/departments"], enabled: !!user });
  const { data: designations = [] } = useQuery<any[]>({ queryKey: ["/api/designations"], enabled: !!user });
  const { data: allBookings = [] } = useQuery<any[]>({ queryKey: ["/api/vehicles/bookings"], enabled: !!user, retry: false });
  // Executives see a company-wide attendance snapshot (they have no personal attendance of their own).
  const { data: orgMonthAtt = [] } = useQuery<any[]>({
    queryKey: [`/api/attendance/month?month=${currentMonth}&year=${currentYear}`],
    enabled: isExecutive(user!),
  });

  // Service-request counts + calendar data for the admin dashboard layout.
  // A plain `manager` gets the employee layout (isHR covers every HR/admin role but
  // manager), with a Pending Leave Approvals card in place of My Pending Requests.
  const showAdminLayout = isHR(user!);
  const isTeamManager = user?.role === "manager";
  // Executives (CEO/CTO): company-overview stats + approvals, but no personal leave/attendance
  // self-service (they never apply for leave or clock attendance).
  const isExec = isExecutive(user!);
  const { data: requestSummary } = useQuery<any>({
    queryKey: ["/api/my-requests/summary"],
    enabled: !!user,
  });
  // /api/team-requests returns an object: { purchases, travels, tickets, teamMembers }
  const { data: teamRequests } = useQuery<any>({
    queryKey: ["/api/team-requests"],
    enabled: showAdminLayout,
    retry: false,
  });
  const { data: holidays = [] } = useQuery<any[]>({
    queryKey: [`/api/holidays?year=${currentYear}`],
    enabled: !!user,
  });

  const purchasePending = requestSummary?.purchases?.pending ?? 0;
  const travelPending = requestSummary?.travels?.pending ?? 0;
  const teamPending = [
    ...(teamRequests?.purchases ?? []),
    ...(teamRequests?.travels ?? []),
    ...(teamRequests?.tickets ?? []),
  ].filter(
    (r: any) => !["fulfilled", "rejected", "closed", "completed", "cancelled", "done", "resolved"].includes(r.status)
  ).length;

  const holidayDates = holidays
    .map((h: any) => (h.date ? new Date(h.date) : null))
    .filter(Boolean) as Date[];
  const upcomingHolidays = holidays
    .filter((h: any) => h.date && new Date(h.date) >= new Date(new Date().toDateString()))
    .sort((a: any, b: any) => +new Date(a.date) - +new Date(b.date))
    .slice(0, 4);

  const greeting = () => {
    const h = today.getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  };

  const displayName = emp ? emp.firstName : user?.username || "User";

  // Elapsed working days this month (Mon–Fri minus holidays, up to today).
  const monthStart = new Date(currentYear, currentMonth - 1, 1);
  const holidayStrSet = new Set((holidays as any[]).map((h) => h.date));
  let workingDays = 0;
  for (let d = new Date(monthStart); d <= today; d.setDate(d.getDate() + 1)) {
    const wd = d.getDay();
    if (wd === 0 || wd === 6) continue;
    if (holidayStrSet.has(format(d, "yyyy-MM-dd"))) continue;
    workingDays++;
  }
  // Only count records for ELAPSED working days so the numbers stay consistent with `workingDays`
  // (future planned leave/WFH must not inflate this-month-so-far totals).
  const todayStr = format(today, "yyyy-MM-dd");
  const elapsedAtt = (myAttendance as any[]).filter((a) => {
    if (!a.date || a.date > todayStr) return false;
    const d = new Date(`${a.date}T00:00:00`);
    const wd = d.getDay();
    return wd !== 0 && wd !== 6 && !holidayStrSet.has(a.date);
  });
  const countStatus = (s: string) => elapsedAtt.filter((a) => a.status === s).length;
  const wfhDays = countStatus("wfh");
  const onDutyDays = countStatus("on_duty");
  const absentDays = countStatus("absent");
  const leaveDays = countStatus("leave");
  const halfDays = countStatus("half_day");
  // Present-by-default: every elapsed working day with no exception record counts as office-present.
  const officePresent = Math.max(0, workingDays - wfhDays - onDutyDays - leaveDays - absentDays - halfDays);
  const presentDays = officePresent + wfhDays + onDutyDays; // "present" incl. WFH / On-Duty

  // Full month breakdown (all six states, for the legend) + non-zero subset (for the donut).
  const attLegend = [
    { key: "present", name: "Present (Office)", value: officePresent },
    { key: "wfh", name: "WFH", value: wfhDays },
    { key: "on_duty", name: "On Duty", value: onDutyDays },
    { key: "half_day", name: "Half Day", value: halfDays },
    { key: "leave", name: "Leave", value: leaveDays },
    { key: "absent", name: "Absent", value: absentDays },
  ].map((s) => ({ ...s, color: ATT_COLORS[s.key] })).sort((a, b) => b.value - a.value);
  const attSegments = attLegend.filter((s) => s.value > 0);
  const attendancePct = workingDays ? Math.round(((officePresent + wfhDays + onDutyDays + 0.5 * halfDays) / workingDays) * 100) : 0;

  // Today's celebrations — birthdays + work anniversaries (replaces the Regularizations stat).
  const celebrations = (employees as any[]).map((e) => todayEvent(e)).filter((ev) => ev && ev.kind !== "farewell") as any[];
  const bdayCount = celebrations.filter((ev) => ev.kind === "birthday").length;
  const annivCount = celebrations.filter((ev) => ev.kind === "anniversary").length;
  const celebrationCaption = (() => {
    const parts: string[] = [];
    if (bdayCount) parts.push(`${bdayCount} birthday${bdayCount > 1 ? "s" : ""}`);
    if (annivCount) parts.push(`${annivCount} ${annivCount > 1 ? "anniversaries" : "anniversary"}`);
    return parts.length ? parts.join(", ") : "None today";
  })();

  // Company-wide attendance snapshot for TODAY (executives). Present-by-default: every active
  // employee with no exception record today counts as office-present — mirrors the personal donut.
  const orgTodayCount = (s: string) => (orgMonthAtt as any[]).filter((a) => a.date === todayStr && a.status === s).length;
  const orgActiveTotal = stats?.totalEmployees || 0;
  const orgWfh = orgTodayCount("wfh"), orgOnDuty = orgTodayCount("on_duty"), orgLeaveN = orgTodayCount("leave"), orgAbsent = orgTodayCount("absent"), orgHalf = orgTodayCount("half_day");
  const orgOffice = Math.max(0, orgActiveTotal - orgWfh - orgOnDuty - orgLeaveN - orgAbsent - orgHalf);
  const orgPresentTotal = orgOffice + orgWfh + orgOnDuty;
  const orgLegend = [
    { key: "present", name: "Present (Office)", value: orgOffice },
    { key: "wfh", name: "WFH", value: orgWfh },
    { key: "on_duty", name: "On Duty", value: orgOnDuty },
    { key: "half_day", name: "Half Day", value: orgHalf },
    { key: "leave", name: "On Leave", value: orgLeaveN },
    { key: "absent", name: "Absent", value: orgAbsent },
  ].map((s) => ({ ...s, color: ATT_COLORS[s.key] })).sort((a, b) => b.value - a.value);
  const orgSegments = orgLegend.filter((s) => s.value > 0);
  const orgPct = orgActiveTotal ? Math.round(((orgOffice + orgWfh + orgOnDuty + 0.5 * orgHalf) / orgActiveTotal) * 100) : 0;

  const pendingLeaveRequests = leaveRequests.filter((r: any) => r.status === "pending");
  const myPendingCount = pendingLeaveRequests.length + (requestSummary?.purchases?.pending ?? 0) + (requestSummary?.travels?.pending ?? 0);
  const totalLeaveBalance = myLeaveBalances.reduce((a: number, b: any) => a + parseFloat(b.closingBalance || "0"), 0);

  // Profile snapshot lookups + my upcoming car bookings (for the calendar).
  const deptName = (departments as any[]).find((d) => d.id === emp?.departmentId)?.name;
  const designationName = (designations as any[]).find((d) => d.id === emp?.designationId)?.name;
  const empInitials = emp ? `${emp.firstName?.[0] || ""}${emp.lastName?.[0] || ""}`.toUpperCase() : "";
  const empJoinDate = (emp as any)?.joinDate as string | undefined;
  const empEmploymentType = (emp as any)?.employmentType as string | undefined;
  const tenure = (() => {
    if (!empJoinDate) return "";
    const j = new Date(empJoinDate);
    let m = (today.getFullYear() - j.getFullYear()) * 12 + (today.getMonth() - j.getMonth());
    if (m < 0) m = 0;
    const y = Math.floor(m / 12), mm = m % 12;
    return y ? `${y}y ${mm}m` : `${mm} mo`;
  })();
  const managerName = myEmp?.managerName as string | undefined;
  const empEmail = (myEmp?.email || (emp as any)?.email) as string | undefined;
  // Today's status chip.
  const todayRec = (myAttendance as any[]).find((a) => a.date === todayStr);
  const todayStatusKey = todayRec?.status || ([0, 6].includes(today.getDay()) ? "weekend" : holidayStrSet.has(todayStr) ? "holiday" : "present");
  const STATUS_META: Record<string, { label: string; color: string }> = {
    present: { label: "In Office", color: "#206295" }, wfh: { label: "WFH", color: "#0E7C7B" }, on_duty: { label: "On Duty", color: "#4A90C2" },
    half_day: { label: "Half Day", color: "#6A7366" }, leave: { label: "On Leave", color: "#953229" }, absent: { label: "Absent", color: "#FF6F62" },
    weekend: { label: "Weekend", color: "#94A3B8" }, holiday: { label: "Holiday", color: "#94A3B8" },
  };
  const todayMeta = STATUS_META[todayStatusKey] || STATUS_META.present;

  const todayMidnight = new Date(new Date().toDateString());
  const myBookings = (allBookings as any[])
    .filter((b) => (b.requesterId === user?.id || (b.attendees || []).some((a: any) => a?.userId === user?.id)) && b.startTime && new Date(b.startTime) >= todayMidnight && b.status !== "cancelled")
    .sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime));
  const bookingDates = myBookings.map((b) => new Date(b.startTime));
  const upcomingBookings = myBookings.slice(0, 4);

  return (
    <div className="min-h-full">
      <div className="p-6 space-y-4 max-w-[92rem] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {greeting()}, {displayName}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {format(today, "EEEE, MMMM d, yyyy")} · {getRoleLabel(user?.role as any)}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap w-full sm:w-auto">
          {/* Desktop: all quick actions inline (unchanged). */}
          <div className="hidden sm:flex gap-2 flex-wrap">
            {isHR(user!) && (
              <Button asChild size="sm" data-testid="button-add-employee">
                <a href="/employees?action=new">
                  <Users className="h-4 w-4 mr-1.5" />
                  Add Employee
                </a>
              </Button>
            )}
            {emp && !showAdminLayout && !isExec && (
              <>
                <Button variant="outline" size="sm" asChild data-testid="button-mark-on-duty">
                  <a href="/attendance?action=on-duty"><Route className="h-4 w-4 mr-1.5" /> Mark On Duty</a>
                </Button>
                <Button variant="outline" size="sm" asChild data-testid="button-apply-wfh">
                  <a href="/attendance?action=wfh"><Home className="h-4 w-4 mr-1.5" /> Apply WFH</a>
                </Button>
                <div className="w-px self-stretch bg-border mx-0.5" aria-hidden="true" />
              </>
            )}
            {!isExec && (
              <Button variant="outline" size="sm" asChild data-testid="button-apply-leave">
                <a href="/leave?action=apply">
                  <Plane className="h-4 w-4 mr-1.5" />
                  Apply Leave
                </a>
              </Button>
            )}
          </div>
          {/* Mobile: primary stays visible, quick actions fold into a right-aligned kebab. */}
          <div className="flex sm:hidden items-center gap-2 w-full">
            {isHR(user!) && (
              <Button asChild size="sm" data-testid="button-add-employee-mobile">
                <a href="/employees?action=new"><Users className="h-4 w-4 mr-1.5" /> Add Employee</a>
              </Button>
            )}
            {!isExec && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="ml-auto" aria-label="Quick actions" data-testid="button-dashboard-actions"><MoreVertical className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {emp && !showAdminLayout && (
                    <>
                      <DropdownMenuItem asChild><a href="/attendance?action=on-duty"><Route className="h-4 w-4 mr-2" /> Mark On Duty</a></DropdownMenuItem>
                      <DropdownMenuItem asChild><a href="/attendance?action=wfh"><Home className="h-4 w-4 mr-2" /> Apply WFH</a></DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem asChild><a href="/leave?action=apply"><Plane className="h-4 w-4 mr-2" /> Apply Leave</a></DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid — company-wide overview (HR/admin + execs). */}
      {(showAdminLayout || isExec) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border-0" style={CARD_STYLE}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))
          ) : (
            <>
              <StatCard
                title="Active Employees"
                value={stats?.totalEmployees || 0}
                icon={Users}
                subtitle="Total headcount"
                color="bg-[#206295]/15 text-[#206295]"
                href={isHR(user!) ? "/employees" : undefined}
              />
              <StatCard
                title="Present Today"
                value={stats?.presentToday || 0}
                icon={UserCheck}
                subtitle={`of ${stats?.totalEmployees || 0} employees`}
                color="bg-[#4BDCD9]/25 text-[#206295]"
                href="/attendance"
              />
              <StatCard
                title="Pending Leaves"
                value={stats?.pendingLeaves || 0}
                icon={Plane}
                subtitle="Awaiting approval"
                color="bg-[#206295]/15 text-[#206295]"
                href="/leave"
              />
              <StatCard
                title="Today's Celebrations"
                value={celebrations.length}
                icon={PartyPopper}
                subtitle={celebrationCaption}
                color="bg-[#4BDCD9]/25 text-[#206295]"
              />
            </>
          )}
        </div>
      )}

      {/* Personal row — profile snapshot (merged) + the two non-attendance stats.
          Attendance now lives in the donut below, so no repetitive present/absence cards. */}
      {emp && !showAdminLayout && !isExec && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Profile snapshot — spans the first two card slots */}
          <Card className="border-0 col-span-2" style={CARD_STYLE}>
            <CardContent className="p-5 flex items-start gap-5">
              {/* Everything but the open-profile button. The rule below belongs to this column,
                  so it stops short of the button rather than running underneath it. */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-5">
                  <div className="relative flex-shrink-0">
                    <Avatar className="h-14 w-14 ring-2 ring-[#206295]/20 ring-offset-2 ring-offset-transparent">
                      {emp.avatarUrl && <AvatarImage src={emp.avatarUrl} />}
                      <AvatarFallback className="text-lg font-bold bg-[#206295]/10 text-[#206295]">{empInitials}</AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white" style={{ backgroundColor: todayMeta.color }} title={`Today · ${todayMeta.label}`} />
                  </div>

                  {/* Name on its own line; the role badge sits below it beside the status pill,
                      so line one stays a single clean string however long the name runs. */}
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-bold text-foreground truncate">{emp.firstName} {emp.lastName}</p>
                    {/* Designation | Dept — semibold dark-grey, in place of the role/status chips. */}
                    {(designationName || deptName) && (
                      <p className="text-[12.5px] font-semibold text-foreground/80 truncate mt-1.5">
                        {designationName || ""}
                        {designationName && deptName && <span className="mx-1.5 font-normal text-muted-foreground">|</span>}
                        {deptName || ""}
                      </p>
                    )}
                  </div>

                  <div className="hidden sm:flex sm:w-56 flex-shrink-0 flex-col gap-3.5 text-[13px] text-muted-foreground pt-1">
                    {empEmail && <p className="inline-flex items-center gap-2 w-full min-w-0"><Mail className="h-3.5 w-3.5 text-[#206295] flex-shrink-0" /><span className="truncate">{empEmail}</span></p>}
                    <p className="inline-flex items-center gap-2"><UserCheck className="h-3.5 w-3.5 text-[#206295] flex-shrink-0" /> {managerName ? <>Reports to <span className="font-medium text-foreground">{managerName}</span></> : "No manager assigned"}</p>
                  </div>
                </div>

                <div className="h-px bg-border/70 my-4" />

                {/* Bottom row — the employment facts as icon + heading over value, sharing the row
                    evenly. Built from a list so a fact with no data takes its divider with it
                    instead of leaving a stray rule behind. */}
                <div className="flex items-stretch">
                  {([
                    [Hash, "Employee ID", emp.employeeCode || "—"],
                    empEmploymentType ? [Briefcase, "Employment", empEmploymentType.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())] : null,
                    empJoinDate ? [CalendarDays, "Joined", `${format(new Date(empJoinDate), "MMM yyyy")}${tenure ? ` | ${tenure}` : ""}`] : null,
                  ].filter(Boolean) as [any, string, string][]).map(([Icon, label, value], i) => (
                    <div key={label} className={`flex-1 min-w-0 flex items-center gap-2.5 ${i > 0 ? "border-l border-border/70 pl-4" : ""}`}>
                      <Icon className="h-4 w-4 text-[#206295] flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[12px] leading-tight text-muted-foreground">{label}</p>
                        <p className="text-[13px] leading-tight font-medium text-foreground truncate mt-0.5">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <a
                href={`/employees/${emp.id}`}
                aria-label="Open full profile"
                title="Open full profile"
                className="flex-shrink-0 h-8 w-8 rounded-lg border border-border/70 flex items-center justify-center text-[#206295] hover-elevate"
                data-testid="link-profile-snapshot"
              >
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </CardContent>
          </Card>
          <StatCard
            title="Leave Balance"
            value={totalLeaveBalance}
            icon={Plane}
            subtitle="Total available days"
            color="bg-[#4BDCD9]/25 text-[#206295]"
            href="/leave"
          />
          {isTeamManager ? (
            <StatCard
              title="Pending Leave Approvals"
              value={pendingLeaveRequests.length}
              icon={ClipboardList}
              subtitle="From your team"
              color="bg-[#206295]/15 text-[#206295]"
              href="/leave?tab=team-leaves"
            />
          ) : (
            <StatCard
              title="My Pending Requests"
              value={myPendingCount}
              icon={ClipboardList}
              subtitle="Awaiting approval"
              color="bg-[#206295]/15 text-[#206295]"
              href="/my-requests"
            />
          )}
        </div>
      )}

      {/* Announcements panel (reused in both layouts) */}
      {(() => {
        const announcementsPanel = (
          <Card className="border-0 h-full flex flex-col" style={CARD_STYLE}>
            <CardHeader className="pt-4 pb-2 flex flex-row items-center justify-between gap-1 space-y-0">
              <CardTitle className="text-base font-semibold">Announcements</CardTitle>
              <Button variant="ghost" size="sm" asChild className="text-xs h-auto min-h-0 py-1">
                <a href="/announcements">View all <ArrowRight className="h-3 w-3 ml-1" /></a>
              </Button>
            </CardHeader>
            <CardContent className="px-5 pb-4 flex-1 min-h-0">
              <ScrollArea className="h-full">
                {annLoading ? (
                  <div className="space-y-4">
                    {[1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : announcements.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No announcements yet
                  </div>
                ) : (
                  <div className="list-divider pr-2">
                    {announcements.map((ann: any) => (
                      <AnnouncementCard key={ann.id} announcement={ann} />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        );

        if (isExec) {
          // Execs: company attendance snapshot + Calendar + Announcements. Their reporting managers'
          // leave approvals show in the dedicated card below; no personal self-service cards.
          return (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <Card className="border-0 lg:h-[27rem] flex flex-col" style={CARD_STYLE}>
                <CardHeader className="pt-4 pb-2 flex flex-row items-center justify-between gap-1 space-y-0">
                  <CardTitle className="text-base font-semibold">Company Attendance</CardTitle>
                  <span className="text-xs text-muted-foreground">Today</span>
                </CardHeader>
                <CardContent className="px-5 pb-4 flex-1 min-h-0 flex flex-col">
                  {orgActiveTotal === 0 ? (
                    <div className="flex-1 flex items-center justify-center"><p className="text-sm text-muted-foreground">No employee data</p></div>
                  ) : (
                    <>
                      <div className="relative h-[147px] w-[147px] mx-auto flex-shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={orgSegments} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={67} innerRadius={39} paddingAngle={3} cornerRadius={5} stroke="none">
                              {orgSegments.map((s) => <Cell key={s.key} fill={s.color} />)}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-2xl font-bold text-foreground leading-none tabular-nums">{orgPct}<span className="text-[0.7em] align-baseline">%</span></span>
                          <span className="text-[10px] text-muted-foreground mt-0.5">present</span>
                        </div>
                      </div>
                      <p className="text-center text-xs text-muted-foreground mt-2">
                        <span className="font-semibold text-foreground">{orgPresentTotal}</span> of {orgActiveTotal} present today
                      </p>
                      <Separator className="my-3" />
                      <div className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1">
                        {orgLegend.map((s) => (
                          <div key={s.key} className={`flex items-center gap-2 text-xs ${s.value === 0 ? "opacity-45" : ""}`}>
                            <span className="w-2.5 h-2.5 rounded-[3px] flex-shrink-0" style={{ background: s.color }} />
                            <span className="text-foreground/80 truncate flex-1">{s.name}</span>
                            <span className="font-semibold text-foreground tabular-nums">{s.value}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  <Button variant="secondary" size="sm" asChild className="w-full mt-3 rounded-[12px] flex-shrink-0">
                    <a href="/attendance" data-testid="link-view-attendance"><CalendarDays className="h-3.5 w-3.5 mr-1.5" /> View full attendance</a>
                  </Button>
                </CardContent>
              </Card>
              <CalendarCard holidayDates={holidayDates} upcomingHolidays={upcomingHolidays} employees={employees} readOnly bookingDates={bookingDates} upcomingBookings={upcomingBookings} />
              <div className="h-[20rem] md:h-[27rem]">{announcementsPanel}</div>
            </div>
          );
        }

        if (showAdminLayout) {
          return (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* LEFT — Pending Service Requests (bento card, below 1st overview card) */}
              <Card className="border-0 lg:h-[27rem] flex flex-col" style={CARD_STYLE}>
                <CardHeader className="pt-4 pb-2">
                  <CardTitle className="text-base font-semibold">Pending Service Requests</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 flex-1 flex flex-col gap-4">
                  <ServiceRequestRow
                    icon={ShoppingCart} label="Purchase Requests" count={purchasePending}
                    href="/my-requests?tab=purchases"
                    color="bg-[#206295]/15 text-[#206295]"
                  />
                  <ServiceRequestRow
                    icon={Car} label="Travel Requests" count={travelPending}
                    href="/my-requests?tab=travels"
                    color="bg-[#4BDCD9]/25 text-[#206295]"
                  />
                  <ServiceRequestRow
                    icon={Users} label="Team Requests" count={teamPending}
                    href="/team-requests"
                    color="bg-[#206295]/15 text-[#206295]"
                  />
                </CardContent>
              </Card>

              {/* CENTER — Calendar (below 2nd & 3rd overview cards) */}
              <CalendarCard holidayDates={holidayDates} upcomingHolidays={upcomingHolidays} employees={employees} bookingDates={bookingDates} upcomingBookings={upcomingBookings} />

              {/* RIGHT — Announcements (below 4th overview card) */}
              <div className="h-[20rem] md:h-[27rem]">{announcementsPanel}</div>
            </div>
          );
        }

        return (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* LEFT — My Attendance donut + quick access to the attendance page */}
            <Card className="border-0 lg:h-[27rem] flex flex-col" style={CARD_STYLE}>
              <CardHeader className="pt-4 pb-2 flex flex-row items-center justify-between gap-1 space-y-0">
                <CardTitle className="text-base font-semibold">My Attendance</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 flex-1 min-h-0 flex flex-col">
                {workingDays === 0 ? (
                  <div className="flex-1 flex items-center justify-center"><p className="text-sm text-muted-foreground">No working days yet this month</p></div>
                ) : (
                  <>
                    <div className="relative h-[147px] w-[147px] mx-auto flex-shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={attSegments} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={67} innerRadius={39} paddingAngle={3} cornerRadius={5} stroke="none">
                            {attSegments.map((s) => <Cell key={s.key} fill={s.color} />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-bold text-foreground leading-none tabular-nums">{attendancePct}<span className="text-[0.7em] align-baseline">%</span></span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">attendance</span>
                      </div>
                    </div>
                    <p className="text-center text-xs text-muted-foreground mt-2">
                      <span className="font-semibold text-foreground">{presentDays}</span> of {workingDays} working days present
                    </p>
                    <Separator className="my-3" />
                    <div className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1">
                      {attLegend.map((s) => (
                        <div key={s.key} className={`flex items-center gap-2 text-xs ${s.value === 0 ? "opacity-45" : ""}`}>
                          <span className="w-2.5 h-2.5 rounded-[3px] flex-shrink-0" style={{ background: s.color }} />
                          <span className="text-foreground/80 truncate flex-1">{s.name}</span>
                          <span className="font-semibold text-foreground tabular-nums">{s.value}<span className="text-muted-foreground font-normal"> {s.value === 1 ? "day" : "days"}</span></span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <Button variant="secondary" size="sm" asChild className="w-full mt-3 rounded-[12px] flex-shrink-0">
                  <a href="/attendance" data-testid="link-view-attendance"><CalendarDays className="h-3.5 w-3.5 mr-1.5" /> View full attendance</a>
                </Button>
              </CardContent>
            </Card>

            {/* CENTER — read-only Calendar: holidays + my upcoming bookings; no Add Event / attendee tooling. */}
            <CalendarCard holidayDates={holidayDates} upcomingHolidays={upcomingHolidays} employees={[]} readOnly bookingDates={bookingDates} upcomingBookings={upcomingBookings} />

            {/* RIGHT — Announcements */}
            <div className="h-[20rem] md:h-[27rem]">{announcementsPanel}</div>
          </div>
        );
      })()}

      {/* Meet the Team (3/4) + Recent Activity (1/4) — equal height */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <MeetTheTeamCard employees={employees} departments={departments} designations={designations} meId={emp?.id} />
        <RecentActivityCard />
      </div>

      {/* Quick Actions — always last */}
      <QuickActionsRow />
      </div>
    </div>
  );
}
