// Chrome for the self view: the title bar with its two CTAs, and the three
// overview cards.

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Home, Route, UserCheck, CircleCheck, Briefcase, CalendarDays, MoreVertical } from "lucide-react";
import { StatCard } from "./attendance-ui";

export function MyAttendanceHeader({ onApplyWfh, onMarkOnDuty }: {
  onApplyWfh: () => void;
  onMarkOnDuty: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3">
        <span className="h-10 w-10 rounded-xl bg-[#206295]/10 text-[#206295] flex items-center justify-center"><UserCheck className="h-5 w-5" /></span>
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Attendance</h1>
          <p className="text-sm text-muted-foreground">View your attendance history and update your work status.</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
        {/* Desktop: both actions inline (unchanged). */}
        <div className="hidden sm:flex items-center gap-2 flex-wrap">
          <Button variant="outline" className="h-10 text-[12px]" onClick={onApplyWfh} data-testid="apply-wfh"><Home className="h-4 w-4 mr-1.5" /> Apply Work from Home</Button>
          <Button className="btn-primary-gradient h-10 text-[12px]" onClick={onMarkOnDuty} data-testid="mark-on-duty"><Route className="h-4 w-4 mr-1.5" /> Mark On Duty</Button>
        </div>
        {/* Mobile: Mark On Duty visible; Apply WFH folds into a kebab. */}
        <div className="flex sm:hidden items-center gap-2 w-full">
          <Button className="btn-primary-gradient h-10 text-[12px]" onClick={onMarkOnDuty} data-testid="mark-on-duty-mobile"><Route className="h-4 w-4 mr-1.5" /> Mark On Duty</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10 ml-auto" aria-label="More actions" data-testid="my-attendance-more-mobile"><MoreVertical className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onApplyWfh} data-testid="menu-apply-wfh"><Home className="h-4 w-4 mr-2" /> Apply Work from Home</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

const WORK_MODES = [
  { label: "Office", key: "office", c: "#206295" },
  { label: "WFH", key: "wfh", c: "#0E7C7B" },
  { label: "On Duty", key: "onDuty", c: "#4A90C2" },
] as const;

/** Present / work-mode split / not-present, for the month the calendar is showing. */
export function MyAttendanceStats({ stats }: { stats: any }) {
  return (
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
                {WORK_MODES.map((x) => (
                  <div key={x.label} className="px-3 first:pl-0 last:pr-0">
                    <p className="text-[26px] leading-tight font-bold text-foreground tabular-nums">{stats[x.key]}</p>
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
  );
}
