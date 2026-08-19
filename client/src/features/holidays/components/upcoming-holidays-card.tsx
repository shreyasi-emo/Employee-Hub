import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarClock } from "lucide-react";
import { format } from "date-fns";

/** Next six holidays with a days-remaining line. */
export function UpcomingHolidaysCard({ upcoming, today }: { upcoming: any[]; today: Date }) {
  return (
    <Card className="border-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-muted-foreground" /> Upcoming Holidays
        </CardTitle>
      </CardHeader>
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
  );
}
