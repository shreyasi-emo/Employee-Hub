import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as RangeCalendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { CalCaption } from "@/components/shared/date-range-picker";
import { CalendarDays } from "lucide-react";
import { format, startOfDay } from "date-fns";

// default, with an "End date" toggle (OFF by default) that turns it into a multi-day range — same
// pattern as the Attendance custom-range picker.
export function BookingDateField({ value, onChange }: { value: { from?: Date; to?: Date }; onChange: (v: { from?: Date; to?: Date }) => void }) {
  const [open, setOpen] = useState(false);
  const [endOn, setEndOn] = useState(!!(value.from && value.to && +value.from !== +value.to));
  const hasRange = endOn && value.to && value.from && +value.to !== +value.from;
  const label = value.from
    ? hasRange ? `${format(value.from!, "EEE, d MMM")} – ${format(value.to!, "EEE, d MMM yyyy")}` : format(value.from, "EEE, d MMM yyyy")
    : "Select date";
  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={`w-full justify-start font-normal ${!value.from ? "text-muted-foreground" : ""}`} data-testid="veh-date">
          <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" /> {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3">
        {endOn && (
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 text-sm font-medium px-3 py-1.5 rounded-[12px] border border-border text-center">{value.from ? format(value.from, "MMM d, yyyy") : "Start date"}</div>
            <span className="text-muted-foreground text-xs">→</span>
            <div className="flex-1 text-sm font-medium px-3 py-1.5 rounded-[12px] border border-border text-center">{hasRange ? format(value.to!, "MMM d, yyyy") : "End date"}</div>
          </div>
        )}
        {endOn ? (
          <RangeCalendar mode="range" selected={value as any} onSelect={(r: any) => onChange(r ?? {})} defaultMonth={value.from} disabled={{ before: startOfDay(new Date()) }} components={{ Caption: CalCaption }} />
        ) : (
          <RangeCalendar mode="single" selected={value.from} onSelect={(d: any) => { if (d) { onChange({ from: d, to: d }); setOpen(false); } }} defaultMonth={value.from} disabled={{ before: startOfDay(new Date()) }} components={{ Caption: CalCaption }} />
        )}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
          <span className="text-sm font-medium">End date</span>
          <Switch checked={endOn} onCheckedChange={(c) => { setEndOn(c); if (!c && value.from) onChange({ from: value.from, to: value.from }); else if (c && value.from) onChange({ from: value.from, to: undefined }); }} data-testid="veh-end-date-toggle" />
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Date + time form fields (TimeField) now live in the shared @/components/shared/datetime-field.

// Fair company-car assignment: cover `pax` seats using the available vehicles, favouring
// (1) capacity match — least wasted seats, (2) load balance — least-booked driver/vehicle first,
