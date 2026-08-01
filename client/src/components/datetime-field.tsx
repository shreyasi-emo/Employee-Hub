import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as RangeCalendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalCaption } from "@/components/date-range-picker";
import { format } from "date-fns";
import { CalendarDays, Clock } from "lucide-react";

// ============================ Date & Time form fields ============================
// The app-wide *single* date + time inputs, pulled out of the Book-a-Car form so any form
// (on-duty, leave, etc.) uses the same calendar-style pickers instead of a raw <input type="…">.
// For a date OR date-range *filter* use <DateRangePicker> (date-range-picker.tsx) instead — this
// file is the form-field flavour: full-width outline trigger, single date, no end-date toggle.
//
//   <DateField value={date} onChange={setDate} disabled={{ before: startOfDay(new Date()) }} />
//   <TimeField value={hm} onChange={setHM} />                       // full-day 30-min slots + free typing
//   <TimeField value={hm} onChange={setHM} slots={TIME_SLOTS} />   // custom window (e.g. booking 7am–7pm)

// Calendar-style single-date field — full-width form trigger + popover. `disabled` is a
// react-day-picker Matcher (e.g. `{ before: startOfDay(new Date()) }`).
export function DateField({
  value,
  onChange,
  disabled,
  placeholder = "Select date",
  testId = "date-field",
  className = "",
}: {
  value?: Date;
  onChange: (d: Date) => void;
  disabled?: any;
  placeholder?: string;
  testId?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={`w-full justify-start font-normal ${!value ? "text-muted-foreground" : ""} ${className}`} data-testid={testId}>
          <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" /> {value ? format(value, "EEE, d MMM yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3">
        <RangeCalendar mode="single" selected={value} onSelect={(d: any) => { if (d) { onChange(d); setOpen(false); } }} defaultMonth={value} disabled={disabled} components={{ Caption: CalCaption }} />
      </PopoverContent>
    </Popover>
  );
}

// String-valued wrapper around <DateField> for forms that store dates as "yyyy-MM-dd" strings.
// Drop-in replacement for `<Input type="date" value={s} onChange={e => setS(e.target.value)} />`
// so every date field in the app uses the same styled calendar. `disabled` is an RDP matcher.
export function DateInput({ value, onChange, disabled, placeholder, testId, className }: {
  value?: string;
  onChange: (v: string) => void;
  disabled?: any;
  placeholder?: string;
  testId?: string;
  className?: string;
}) {
  const parse = (s?: string): Date | undefined => { if (!s) return undefined; const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return <DateField value={parse(value)} onChange={(d) => onChange(fmt(d))} disabled={disabled} placeholder={placeholder} testId={testId} className={className} />;
}

// "HH:mm" → "h:mm a" label (works for any time, not just preset slots).
export const hmLabel = (v: string) => { if (!v) return ""; const [h, m] = v.split(":").map(Number); if (isNaN(h) || isNaN(m)) return v; return format(new Date(2000, 0, 1, h, m), "h:mm a"); };

// Parse a free-typed time ("9", "9:15", "9 am", "2:30 pm", "14:30") → "HH:mm", or null if unparseable.
export function parseTime(raw: string): string | null {
  const s = (raw || "").trim().toLowerCase();
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10); const min = m[2] ? parseInt(m[2], 10) : 0; const ap = m[3];
  if (min > 59 || h > 23) return null;
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (h > 23) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

// Default full-day 30-minute slot list (00:00 … 23:30).
const FULL_DAY_SLOTS: { value: string; label: string }[] = (() => {
  const out: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) for (const m of [0, 30]) out.push({ value: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, label: format(new Date(2000, 0, 1, h, m), "h:mm a") });
  return out;
})();

// Time field — editable combobox: pick from the 30-min list OR type any time manually.
// Pass `slots` to restrict the list to a custom window (defaults to a full day).
export function TimeField({
  value,
  onChange,
  min,
  max,
  placeholder = "Select time",
  slots = FULL_DAY_SLOTS,
  testId = "time-field",
}: {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  slots?: { value: string; label: string }[];
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(hmLabel(value));
  useEffect(() => { setText(hmLabel(value)); }, [value]);
  const opts = slots.filter((t) => (!min || t.value > min) && (!max || t.value <= max));
  const commit = (raw: string) => { const hm = parseTime(raw); if (hm) { onChange(hm); return true; } return false; };
  return (
    <div className="relative">
      <Clock className="h-4 w-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      <Input
        value={text}
        className="pl-8"
        placeholder={placeholder}
        data-testid={testId}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setText(e.target.value); if (!open) setOpen(true); }}
        onBlur={() => { window.setTimeout(() => setOpen(false), 120); if (!commit(text)) setText(hmLabel(value)); }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(text); setOpen(false); (e.currentTarget as HTMLInputElement).blur(); } else if (e.key === "Escape") { setOpen(false); } }}
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover shadow-md p-1.5">
          <ScrollArea className="h-56">
            <div className="space-y-0.5 pr-2">
              {opts.length === 0 ? <p className="text-xs text-muted-foreground px-2 py-2">No times available</p> :
                opts.map((t) => (
                  <button key={t.value} type="button" onMouseDown={(e) => { e.preventDefault(); onChange(t.value); setOpen(false); }} className={`w-full text-left rounded-[10px] px-3 py-1.5 text-sm ${value === t.value ? "btn-primary-gradient text-white" : "text-foreground hover-elevate"}`}>{t.label}</button>
                ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
