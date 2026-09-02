import { CARD_STYLE } from "../lib/dashboard-visuals";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, AlertCircle, ArrowRight, Megaphone, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigation } from "react-day-picker";
import { format } from "date-fns";

// Small widgets shared across the dashboard grid.
// NOTE: CalCaption duplicates the one exported by components/shared/date-range-picker.
// Left as-is pending a check that they render identically.
// Simple "< June 2026 >" month navigation for the dashboard calendar
export function CalCaption({ displayMonth }: { displayMonth: Date }) {
  const { goToMonth, nextMonth, previousMonth } = useNavigation();
  return (
    <div className="flex items-center justify-center gap-3 pt-0.5 pb-1">
      <button
        type="button"
        disabled={!previousMonth}
        onClick={() => previousMonth && goToMonth(previousMonth)}
        className="p-1 rounded-md hover-elevate disabled:opacity-30"
        aria-label="Previous month"
        data-testid="button-cal-prev"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-sm font-semibold min-w-[8.5rem] text-center">
        {format(displayMonth, "MMMM yyyy")}
      </span>
      <button
        type="button"
        disabled={!nextMonth}
        onClick={() => nextMonth && goToMonth(nextMonth)}
        className="p-1 rounded-md hover-elevate disabled:opacity-30"
        aria-label="Next month"
        data-testid="button-cal-next"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// StatCard: this variant carries the glass CARD_STYLE, a rounded-lg icon box and an
// optional "View details" href. Not the shared components/shared/stat-card.tsx.
export function StatCard({ title, value, icon: Icon, subtitle, color, href }: {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  subtitle?: string;
  color: string;
  href?: string;
}) {
  const card = (
    <Card className={`card-hover border-0 h-full ${href ? "cursor-pointer" : ""}`} style={CARD_STYLE}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 flex-1">
            {/* Label = 14px (text-sm); number = 33px */}
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-[33px] leading-tight font-bold text-foreground">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={`p-2.5 rounded-lg ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {href && (
          <span className="mt-3 flex items-center gap-1 text-xs text-primary font-medium">
            View details <ArrowRight className="h-3 w-3" />
          </span>
        )}
      </CardContent>
    </Card>
  );
  // Whole card is the click target when it links somewhere.
  return href
    ? <a href={href} className="block h-full" data-testid={`statcard-${title.toLowerCase().replace(/\s+/g, "-")}`}>{card}</a>
    : card;
}

export function AnnouncementCard({ announcement }: { announcement: any }) {
  return (
    <div className="flex gap-3 py-3">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Megaphone className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-foreground leading-snug">{announcement.title}</h3>
          {announcement.category && (
            <Badge variant="secondary" className="text-xs capitalize">{announcement.category}</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{announcement.content}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {format(new Date(announcement.createdAt), "MMM d, yyyy")}
        </p>
      </div>
    </div>
  );
}

export function LeaveRequestCard({ request, employees, leaveTypes }: { request: any; employees: any[]; leaveTypes: any[] }) {
  const emp = employees.find(e => e.id === request.employeeId);
  const lt = leaveTypes.find(l => l.id === request.leaveTypeId);
  const initials = emp ? `${emp.firstName[0]}${emp.lastName[0]}` : "?";

  const statusIcon = request.status === "pending"
    ? <AlertCircle className="h-4 w-4 text-muted-foreground" />
    : request.status === "approved"
    ? <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
    : <XCircle className="h-4 w-4 text-[#FF6F62]" />;

  return (
    <div className="flex items-center gap-3 py-2.5">
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {emp ? `${emp.firstName} ${emp.lastName}` : "Unknown"}
        </p>
        <p className="text-xs text-muted-foreground">
          {lt?.name} · {format(new Date(request.startDate), "MMM d")}
          {request.startDate !== request.endDate && ` - ${format(new Date(request.endDate), "MMM d")}`}
          · {request.totalDays}d
        </p>
      </div>
      <div className="flex items-center gap-1">
        {statusIcon}
        <span className="text-xs capitalize text-muted-foreground">{request.status}</span>
      </div>
    </div>
  );
}

export function ServiceRequestRow({ icon: Icon, label, count, href, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  href: string;
  color: string;
}) {
  return (
    <a
      href={href}
      className="block flex-1"
      data-testid={`service-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <Card className="border-0 h-full card-hover" style={CARD_STYLE}>
        <CardContent className="h-full p-4 flex items-center gap-4">
          <div className={`p-3 rounded-xl flex-shrink-0 ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <p className="flex-1 min-w-0 text-sm font-medium text-foreground truncate">{label}</p>
          <span className="text-[33px] leading-tight font-bold text-foreground">{count}</span>
          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        </CardContent>
      </Card>
    </a>
  );
}
