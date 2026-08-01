import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as RangeCalendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { useNavigation } from "react-day-picker";
import { format } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

// ============================ Date Range Picker ============================
// The app-wide "single date, flip a switch for an end date" picker (originally the Attendance
// custom-range control). Reuse this everywhere a date OR date-range filter is needed instead of
// copy-pasting the popover. Also exports `CalCaption` for any standalone <RangeCalendar>.
//
//   <DateRangePicker value={range} onChange={setRange} />                 // trigger + popover
//   <RangeCalendar ... components={{ Caption: CalCaption }} />           // just the "‹ Month ›" header

export type DateRange = { from?: Date; to?: Date };

// "‹ June 2026 ›" month caption — pass to a RangeCalendar's `components={{ Caption: CalCaption }}`.
export function CalCaption({ displayMonth }: { displayMonth: Date }) {
  const { goToMonth, nextMonth, previousMonth } = useNavigation();
  return (
    <div className="flex items-center justify-center gap-3 pt-1 pb-2">
      <button type="button" disabled={!previousMonth} onClick={() => previousMonth && goToMonth(previousMonth)} className="p-1 rounded-md hover-elevate disabled:opacity-30" aria-label="Previous month">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-sm font-semibold min-w-[8.5rem] text-center">{format(displayMonth, "MMMM yyyy")}</span>
      <button type="button" disabled={!nextMonth} onClick={() => nextMonth && goToMonth(nextMonth)} className="p-1 rounded-md hover-elevate disabled:opacity-30" aria-label="Next month">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function DateRangePicker({
  value,
  onChange,
  align = "start",
  triggerClassName = "",
  testId = "date-range-trigger",
  disabled,
}: {
  value: DateRange;
  onChange: (v: DateRange) => void;
  align?: "start" | "center" | "end";
  triggerClassName?: string;
  testId?: string;
  disabled?: any; // react-day-picker Matcher(s) for days to disable, e.g. { before: startOfDay(new Date()) }
}) {
  const [endDate, setEndDate] = useState(!!(value.from && value.to && +value.from !== +value.to));
  const hasRange = endDate && value.to && value.from && +value.to !== +value.from;
  const label = value.from
    ? hasRange ? `${format(value.from!, "MMM d")} – ${format(value.to!, "MMM d, yyyy")}` : format(value.from, "MMM d, yyyy")
    : "Pick date";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" className={triggerClassName} data-testid={testId}>
          <CalendarDays className="h-4 w-4 mr-1.5" /> {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto p-3">
        {/* Selected start / end summary */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 text-sm font-medium px-3 py-1.5 rounded-[12px] border border-border text-center">
            {value.from ? format(value.from, "MMM d, yyyy") : "Start date"}
          </div>
          {endDate && (
            <>
              <span className="text-muted-foreground text-xs">→</span>
              <div className="flex-1 text-sm font-medium px-3 py-1.5 rounded-[12px] border border-border text-center">
                {hasRange ? format(value.to!, "MMM d, yyyy") : "End date"}
              </div>
            </>
          )}
        </div>

        {endDate ? (
          <RangeCalendar mode="range" selected={value as any} onSelect={(r: any) => onChange(r ?? {})} defaultMonth={value.from} disabled={disabled} components={{ Caption: CalCaption }} />
        ) : (
          <RangeCalendar mode="single" selected={value.from} onSelect={(d: any) => d && onChange({ from: d, to: d })} defaultMonth={value.from} disabled={disabled} components={{ Caption: CalCaption }} />
        )}

        {/* End date toggle */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
          <span className="text-sm font-medium">End date</span>
          <Switch
            checked={endDate}
            onCheckedChange={(c) => {
              setEndDate(c);
              if (!c && value.from) onChange({ from: value.from, to: value.from });
              else if (c && value.from) onChange({ from: value.from, to: undefined });
            }}
            data-testid="switch-end-date"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
