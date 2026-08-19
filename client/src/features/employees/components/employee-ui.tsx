// Presentational pieces for the employee directory.
//
// NOTE: StatCard here is a fourth variant (plain string subtitle, no truncate).
// Reconciling the app's StatCards is a separate deliberate pass.

import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Briefcase, MapPin, Calendar } from "lucide-react";
import { format } from "date-fns";
import { statusColors, typeLabel } from "../lib/employee-constants";
import { avatarColor, initials } from "../lib/employee-helpers";

export function StatCard({ title, value, subtitle, icon: Icon, color }: { title: string; value: number | string; subtitle?: string; icon: any; color: string; }) {
  return (
    <Card className="border-0 card-hover"><CardContent className="p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 flex-1 min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-[33px] leading-tight font-bold text-foreground">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-xl flex-shrink-0 ${color}`}><Icon className="h-5 w-5" /></div>
      </div>
    </CardContent></Card>
  );
}

/** Directory card. Clicking opens the profile, or toggles selection in select mode.
 *  Pass `event` (see lib/employee-helpers todayEvent) to show a celebration banner. */
export function EmployeeCard({ employee, departments, designations, selectionMode, selected, onToggle, event }: {
  employee: any; departments: any[]; designations: any[]; selectionMode: boolean; selected: boolean; onToggle: () => void;
  event?: { label: string; tint: string; icon: any } | null;
}) {
  const [, navigate] = useLocation();
  const desig = designations.find((d) => d.id === employee.designationId);
  const detail = "text-xs text-muted-foreground flex items-center gap-1.5";
  const c = avatarColor(employee.id);
  const onCardClick = () => (selectionMode ? onToggle() : navigate(`/employees/${employee.id}`));
  return (
    <Card
      className={`border-0 card-hover cursor-pointer overflow-hidden ${selected ? "ring-2 ring-primary" : ""}`}
      style={event ? { boxShadow: `0 0 0 1.5px ${event.tint}66` } : undefined}
      onClick={onCardClick}
      data-testid={`employee-card-${employee.id}`}
    >
      {event && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 text-white text-[11px] font-bold uppercase tracking-wide" style={{ background: event.tint }}>
          <event.icon className="h-3.5 w-3.5 celebrate-pop flex-shrink-0" /> {event.label}
        </div>
      )}
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {selectionMode && (
            <Checkbox checked={selected} onClick={(e) => e.stopPropagation()} onCheckedChange={onToggle} className="mt-1" data-testid={`select-${employee.id}`} />
          )}
          <Avatar className="h-10 w-10 flex-shrink-0"><AvatarFallback className="text-sm font-semibold" style={{ backgroundColor: `${c}26`, color: c }}>{initials(employee.firstName, employee.lastName)}</AvatarFallback></Avatar>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">{employee.firstName} {employee.lastName}</p>
                <p className="text-xs text-muted-foreground">{employee.employeeCode}</p>
              </div>
              <Badge className={`text-xs flex-shrink-0 ${statusColors[employee.employmentStatus] || statusColors.inactive}`}>{employee.employmentStatus.replace("_", " ")}</Badge>
            </div>
            <p className={detail}>
              <Briefcase className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{desig?.name || "—"}</span>
            </p>
            {employee.workLocation && <p className={detail}><MapPin className="h-3 w-3 flex-shrink-0" /><span className="truncate">{employee.workLocation}</span></p>}
            {employee.joinDate && <p className={detail}><Calendar className="h-3 w-3 flex-shrink-0" /><span className="truncate">{format(new Date(employee.joinDate), "MMM d, yyyy")}</span></p>}
            <div className="pt-1.5">
              <Badge variant="secondary" className="text-[10px]">{typeLabel(employee.employmentType)}</Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Label + value pair used throughout the profile tabs; renders nothing when empty. */
export function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground font-medium">{value}</p>
    </div>
  );
}
