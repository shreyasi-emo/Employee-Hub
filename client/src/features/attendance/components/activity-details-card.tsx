import { format, isSameDay } from "date-fns";
import { Briefcase, CalendarDays, Clock, Home, MapPin, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STATE_COLOR } from "../lib/attendance-states";
import { StatusChip } from "./attendance-ui";

const MODE: Record<string, string> = {
  present: "In office", wfh: "Work from home", on_duty: "On duty · field", half_day: "Half day",
  absent: "Not present", leave: "On leave", holiday: "Holiday", weekend: "Weekend",
};

function DetailRow({ icon: Icon, label, value, tint }: { icon: any; label: string; value: React.ReactNode; tint: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${tint}1A`, color: tint }}><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none">{label}</p>
        <p className="text-sm text-foreground mt-1 truncate">{value}</p>
      </div>
    </div>
  );
}

/** What happened on the selected day, plus the two "end early" actions. */
export function ActivityDetailsCard({
  selected, now, selStatus, selRec, selMeta, selWfhAp, selWfhMeta, selHoliday,
  canEndLeave, endingOnDuty, endingLeave, onEndOnDuty, onEndLeave,
}: {
  selected: Date;
  now: Date;
  selStatus: string | null;
  selRec: any;
  selMeta: any;
  selWfhAp: "approved" | "pending" | "rejected" | null;
  selWfhMeta: any;
  selHoliday: any;
  canEndLeave: boolean;
  endingOnDuty: boolean;
  endingLeave: boolean;
  onEndOnDuty: () => void;
  onEndLeave: () => void;
}) {
  const c = (selStatus && STATE_COLOR[selStatus]) || "#64748B";
  const dayType = selStatus === "holiday" ? (selHoliday?.name || "Holiday") : selStatus === "weekend" ? "Weekend" : "Working day";

  return (
    <div className="card-surface rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-base font-semibold text-foreground">Activity Details</p>
          <p className="text-[13px] text-muted-foreground mt-0.5">{format(selected, "EEE, d MMM yyyy")}{isSameDay(selected, now) ? " · Today" : ""}</p>
        </div>
        <StatusChip s={selStatus || undefined} />
      </div>
      <div className="mt-3 border-t border-foreground/20" />

      <div className="mt-4 space-y-3">
        <DetailRow icon={Briefcase} label="Work mode" value={MODE[selStatus || ""] || "—"} tint={c} />
        <DetailRow icon={CalendarDays} label="Day" value={`${format(selected, "EEEE")} · ${dayType}`} tint="#425B8D" />
        {selMeta && (
          <div className="rounded-xl p-3 space-y-1.5" style={{ border: `1px solid ${STATE_COLOR.on_duty}4D`, backgroundColor: `${STATE_COLOR.on_duty}0F` }}>
            {selMeta.location && <p className="text-xs text-foreground flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" /> <span>{selMeta.location}</span></p>}
            {selMeta.expectedReturn && <p className="text-xs text-foreground flex items-center gap-1.5"><Route className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" /> <span>Expected return {format(new Date(selMeta.expectedReturn), "d MMM, h:mm a")}</span></p>}
            {selRec?.checkIn && <p className="text-xs text-foreground flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" /> <span>Marked at {format(new Date(selRec.checkIn), "h:mm a")}</span></p>}
            {selMeta.remarks && <p className="text-xs text-muted-foreground">{selMeta.remarks}</p>}
          </div>
        )}
        {selWfhMeta && (
          <div className="rounded-xl p-3 space-y-1.5" style={{ border: `1px solid ${STATE_COLOR.wfh}4D`, backgroundColor: `${STATE_COLOR.wfh}0F` }}>
            <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: STATE_COLOR.wfh }}><Home className="h-3.5 w-3.5 flex-shrink-0" /> <span>Work From Home · {selWfhAp === "approved" ? "Approved" : selWfhAp === "rejected" ? "Rejected" : "Pending approval"}{selWfhMeta.duration && selWfhMeta.duration !== "full" ? ` · ${selWfhMeta.duration === "first_half" ? "First Half" : "Second Half"}` : ""}</span></p>
            {selWfhMeta.reason && <p className="text-xs text-muted-foreground">{selWfhMeta.reason}</p>}
            {selWfhAp === "pending" && selWfhMeta.autoApproveAt && <p className="text-[11px] text-muted-foreground flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 flex-shrink-0" /> <span>Auto-approves {format(new Date(selWfhMeta.autoApproveAt), "d MMM, h:mm a")} if not actioned.</span></p>}
          </div>
        )}
      </div>

      {/* Secondary actions — end an active On-Duty trip or an ongoing/upcoming leave */}
      {selStatus === "on_duty" && !selMeta?.endedAt && (
        <Button variant="outline" size="sm" className="w-full mt-4 text-xs" disabled={endingOnDuty} onClick={onEndOnDuty} data-testid="end-on-duty"><Route className="h-3.5 w-3.5 mr-1.5" /> {endingOnDuty ? "Ending…" : "End On Duty"}</Button>
      )}
      {canEndLeave && (
        <Button variant="outline" size="sm" className="w-full mt-4 text-xs" disabled={endingLeave} onClick={onEndLeave} data-testid="end-on-leave"><CalendarDays className="h-3.5 w-3.5 mr-1.5" /> {endingLeave ? "Ending…" : "End Leave"}</Button>
      )}
    </div>
  );
}
