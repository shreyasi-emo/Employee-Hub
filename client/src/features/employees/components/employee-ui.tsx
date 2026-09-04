// Presentational pieces for the employee directory.

import { StatCard } from "@/components/shared/stat-card";
export { StatCard };

import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Briefcase, MapPin, Calendar, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { statusColors, typeLabel } from "../lib/employee-constants";
import { avatarColor, initials } from "../lib/employee-helpers";

/** Directory card. Clicking opens the profile, or toggles selection in select mode.
 *  Pass `event` (see lib/employee-helpers todayEvent) to show a celebration banner. */
export function EmployeeCard({ employee, departments, designations, selectionMode, selected, onToggle, event, onOpen }: {
  employee: any; departments: any[]; designations: any[]; selectionMode: boolean; selected: boolean; onToggle: () => void;
  event?: { label: string; tint: string; icon: any } | null;
  /** When provided, clicking the card calls this instead of navigating to the full profile page. */
  onOpen?: (employee: any) => void;
}) {
  const [, navigate] = useLocation();
  const isMobile = useIsMobile();
  const desig = designations.find((d) => d.id === employee.designationId);
  const detail = "text-xs text-muted-foreground flex items-center gap-1.5";
  const c = avatarColor(employee.id);
  const onCardClick = () => (selectionMode ? onToggle() : onOpen ? onOpen(employee) : navigate(`/employees/${employee.id}`));

  // Mobile: a compact single-row card (avatar · name/role/meta · status + chevron).
  if (isMobile) {
    return (
      <Card
        className={`border-0 card-hover cursor-pointer overflow-hidden ${selected ? "ring-2 ring-primary" : ""}`}
        style={event ? { boxShadow: `0 0 0 1.5px ${event.tint}66` } : undefined}
        onClick={onCardClick}
        data-testid={`employee-card-${employee.id}`}
      >
        {event && (
          <div className="flex items-center gap-1.5 px-3 py-1 text-white text-[10px] font-bold uppercase tracking-wide" style={{ background: event.tint }}>
            <event.icon className="h-3 w-3 celebrate-pop flex-shrink-0" /> {event.label}
          </div>
        )}
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            {selectionMode && (
              <Checkbox checked={selected} onClick={(e) => e.stopPropagation()} onCheckedChange={onToggle} className="flex-shrink-0" data-testid={`select-${employee.id}`} />
            )}
            <Avatar className="h-11 w-11 flex-shrink-0"><AvatarFallback className="text-sm font-semibold" style={{ backgroundColor: `${c}26`, color: c }}>{initials(employee.firstName, employee.lastName)}</AvatarFallback></Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-sm text-foreground truncate">{employee.firstName} {employee.lastName}</p>
                <Badge className={`text-[10px] flex-shrink-0 ${statusColors[employee.employmentStatus] || statusColors.inactive}`}>{employee.employmentStatus.replace("_", " ")}</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {desig?.name || "—"}<span className="mx-1.5 text-border">|</span>{employee.employeeCode}
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5 min-w-0">
                {employee.workLocation && <span className="inline-flex items-center gap-1 min-w-0"><MapPin className="h-3 w-3 flex-shrink-0" /><span className="truncate">{employee.workLocation}</span></span>}
                {employee.workLocation && employee.joinDate && <span className="text-border flex-shrink-0">|</span>}
                {employee.joinDate && <span className="inline-flex items-center gap-1 flex-shrink-0"><Calendar className="h-3 w-3 flex-shrink-0" />{format(new Date(employee.joinDate), "MMM d, yyyy")}</span>}
              </div>
            </div>
            {!selectionMode && <ChevronRight className="h-5 w-5 text-muted-foreground/50 flex-shrink-0" />}
          </div>
        </CardContent>
      </Card>
    );
  }

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
                <p className="font-semibold text-base sm:text-sm text-foreground truncate">{employee.firstName} {employee.lastName}</p>
                <p className="text-[11px] sm:text-xs text-muted-foreground">{employee.employeeCode}</p>
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
