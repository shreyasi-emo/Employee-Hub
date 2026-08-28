import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type SplitTab = { value: string; label: string; count?: number };

// The app's 50/50 pill toggle (originally the My / Employee Attendance switch), extracted for reuse.
// One pill split evenly with no gap, outer corners rounded, the active segment filling its half
// (primary gradient). Controlled — render the content for the active `value` yourself.
export function SplitTabs({ value, onValueChange, tabs, className = "" }: {
  value: string; onValueChange: (v: string) => void; tabs: SplitTab[]; className?: string;
}) {
  return (
    <Tabs value={value} onValueChange={onValueChange}>
      <TabsList
        className={cn("w-full grid gap-0 p-0 h-12 overflow-hidden rounded-[20px] border border-white/70 shadow-[0_4px_16px_rgba(44,62,98,0.18)]", className)}
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((t) => {
          const active = value === t.value;
          return (
            <TabsTrigger key={t.value} value={t.value} style={{ borderRadius: 0, borderColor: "transparent" }} className="w-full h-full text-sm gap-2" data-testid={`tab-${t.value}`}>
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className={cn("text-[10px] font-bold rounded-full px-1.5 py-0.5", active ? "bg-white/25 text-white" : "bg-muted text-muted-foreground")}>{t.count}</span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
