import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { ChevronRight, CalendarRange, LayoutGrid, Table as TableIcon } from "lucide-react";
import { format } from "date-fns";

// Shared chrome for the approval screens.
export function StatCard({ title, value, subtitle, icon: Icon, color, onClick }: { title: string; value: any; subtitle?: React.ReactNode; icon: any; color: string; onClick?: () => void; }) {
  const inner = (
    <CardContent className="p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 flex-1 min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-[33px] leading-tight font-bold text-foreground truncate">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-xl flex-shrink-0 ${color}`}><Icon className="h-5 w-5" /></div>
      </div>
    </CardContent>
  );
  return onClick
    ? <button onClick={onClick} className="text-left w-full focus:outline-none"><Card className="border-0 card-hover h-full">{inner}</Card></button>
    : <Card className="border-0 card-hover">{inner}</Card>;
}

// Definition-list row inside the detail modal
export function Field({ label, value }: { label: string; value: any }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-xs text-muted-foreground flex-shrink-0">{label}</span>
      <span className="text-sm text-foreground text-right break-words min-w-0">{value}</span>
    </div>
  );
}

export function NavCard({ title, count, subtitle, icon: Icon, onClick }: { title: string; count: number; subtitle?: string; icon: any; onClick: () => void; }) {
  return (
    <button onClick={onClick} className="text-left w-full focus:outline-none" data-testid={`nav-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <Card className="border-0 card-hover"><CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-[#4BDCD9]/25 text-[#206295] flex-shrink-0"><Icon className="h-5 w-5" /></div>
            <div className="min-w-0">
              {/* count is 20% larger than the label text */}
              <p className="text-sm text-muted-foreground truncate">{title}</p>
              <p className="text-[1.05rem] leading-tight font-bold text-foreground">
                {count} <span className="text-sm font-normal text-muted-foreground">{subtitle}</span>
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </div>
      </CardContent></Card>
    </button>
  );
}

// Notion-style date picker (matches /attendance): single date by default, "End date" toggle to make it a range.
// Returns a { from?, to? } range of Date objects; a single date is represented as from === to.
export function ApprovalDateRange({ value, onChange }: { value: { from?: Date; to?: Date }; onChange: (v: { from?: Date; to?: Date }) => void }) {
  const [endDate, setEndDate] = useState(!!(value.from && value.to && +value.from !== +value.to));
  const hasRange = endDate && value.to && value.from && +value.to !== +value.from;
  const label = value.from
    ? hasRange ? `${format(value.from!, "MMM d")} – ${format(value.to!, "MMM d, yyyy")}` : format(value.from, "MMM d, yyyy")
    : "Date range";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9" data-testid="appr-date-range"><CalendarRange className="h-4 w-4 mr-1.5" /> {label}</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-3">
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
          <Calendar mode="range" selected={value as any} onSelect={(r: any) => onChange(r ?? {})} defaultMonth={value.from} />
        ) : (
          <Calendar mode="single" selected={value.from} onSelect={(d: any) => d && onChange({ from: d, to: d })} defaultMonth={value.from} />
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
            data-testid="switch-appr-end-date"
          />
        </div>
        {(value.from || value.to) && (
          <Button variant="ghost" size="sm" className="w-full mt-1" onClick={() => { setEndDate(false); onChange({}); }}>Clear</Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

// Card / Table view switch, shared across the approval lists.
export function ViewToggle({ view, onChange }: { view: "card" | "table"; onChange: (v: "card" | "table") => void }) {
  return (
    <div className="segmented-toggle inline-flex p-0.5 h-9 flex-shrink-0">
      {([["card", LayoutGrid], ["table", TableIcon]] as const).map(([v, Icon]) => (
        <button key={v} onClick={() => onChange(v)} title={`${v === "card" ? "Card" : "Table"} view`} data-testid={`view-${v}`}
          className={`px-2.5 h-full rounded-[10px] flex items-center transition-colors ${view === v ? "btn-primary-gradient text-white" : "text-muted-foreground hover-elevate"}`}>
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
