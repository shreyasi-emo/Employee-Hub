import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarGrid } from "@/components/ui/calendar";
import { Trash2, Pencil } from "lucide-react";
import { format } from "date-fns";

/** Month grid with holiday days highlighted, plus the selected month's list below it. */
export function HolidayCalendarView({ calMonth, onMonthChange, holidayDates, monthHolidays, canManage, onEdit, onDelete }: {
  calMonth: Date;
  onMonthChange: (d: Date) => void;
  holidayDates: Date[];
  monthHolidays: any[];
  canManage: boolean;
  onEdit: (h: any) => void;
  onDelete: (h: any) => void;
}) {
  return (
    <Card className="border-0"><CardContent className="p-4">
      <CalendarGrid
        month={calMonth}
        onMonthChange={onMonthChange}
        modifiers={{ holiday: holidayDates }}
        modifiersClassNames={{ holiday: "bg-[#206295]/15 text-[#206295] font-semibold" }}
        showOutsideDays
        className="w-full p-0"
        classNames={{
          months: "w-full",
          month: "w-full space-y-3",
          caption: "flex justify-center pt-1 relative items-center",
          table: "w-full border-collapse",
          head_row: "flex w-full",
          head_cell: "flex-1 text-muted-foreground font-normal text-[0.8rem]",
          row: "flex w-full mt-1.5",
          cell: "flex-1 p-0.5 text-center text-sm relative",
          day: "h-11 w-full rounded-[10px] font-normal hover-elevate inline-flex items-center justify-center aria-selected:opacity-100",
          day_today: "bg-accent text-accent-foreground",
          day_outside: "text-muted-foreground/50",
        }}
      />
      <div className="mt-2 border-t border-border pt-3">
        <p className="text-sm font-semibold text-foreground mb-2">{format(calMonth, "MMMM yyyy")} · {monthHolidays.length} holiday{monthHolidays.length !== 1 ? "s" : ""}</p>
        {monthHolidays.length === 0 ? (
          <p className="text-sm text-muted-foreground">No holidays this month.</p>
        ) : (
          <div className="list-divider">
            {monthHolidays.map((h) => {
              const d = new Date(h.date);
              return (
                <div key={h.id} className="flex items-center gap-3 py-2">
                  <div className={`w-9 text-center rounded-[10px] py-0.5 flex-shrink-0 ${h.isOptional ? "bg-[#FF6F62]/20 text-[#FF6F62]" : "bg-[#206295]/15 text-[#206295]"}`}>
                    <p className="text-sm font-bold leading-tight">{format(d, "d")}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{h.name}</p>
                    <p className="text-xs text-muted-foreground">{format(d, "EEEE")} · {h.location === "all" ? "All locations" : h.location}</p>
                  </div>
                  <Badge className={`text-xs flex-shrink-0 ${h.isOptional ? "bg-[#FF6F62]/20 text-[#FF6F62]" : "bg-[#4BDCD9]/25 text-[#206295]"}`}>{h.isOptional ? "Optional" : "Mandatory"}</Badge>
                  {canManage && (
                    <div className="flex gap-1.5 flex-shrink-0">
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onEdit(h)} aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="outline" className="h-7 w-7 text-[#FF6F62] border-[#FF6F62]/30" onClick={() => onDelete(h)} aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </CardContent></Card>
  );
}
