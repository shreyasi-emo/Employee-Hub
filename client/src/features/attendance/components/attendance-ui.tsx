// Small presentational pieces used by both attendance views. Kept in one file
// rather than four ~15-line files.

import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { STATE_COLOR, statusLabelOf } from "../lib/attendance-states";
import { initials } from "@/lib/format";
export { initials };

export function EmpAvatar({ emp, className = "h-8 w-8" }: { emp: any; className?: string }) {
  return (
    <Avatar className={`${className} flex-shrink-0`}>
      {emp?.avatarUrl && <AvatarImage src={emp.avatarUrl} />}
      <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials(emp?.firstName, emp?.lastName)}</AvatarFallback>
    </Avatar>
  );
}

// StatCard: this variant takes a ReactNode `subtitle` and renders it raw (callers pass
// their own <p>). components/shared/stat-card.tsx wraps a plain string instead.
export function StatCard({ title, value, subtitle, icon: Icon, color }: {
  title: string; value: number | string; subtitle?: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>; color: string;
}) {
  return (
    <Card className="border-0 card-hover">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-[33px] leading-tight font-bold text-foreground">{value}</p>
            {subtitle}
          </div>
          <div className={`p-2.5 rounded-xl flex-shrink-0 ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Glass tooltip — matches the app's card hover-card style (background, shadow, padding, type)
export function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p: any) => p.value != null && p.value !== 0);
  if (!rows.length) return null;
  return (
    <div className="card-surface px-3 py-2 text-xs" style={{ borderRadius: 12, minWidth: 140 }}>
      <p className="font-bold text-foreground mb-1">{label}</p>
      <div className="space-y-0.5">
        {rows.map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: STATE_COLOR[p.dataKey] || "#9AA6B2" }} />
              {p.name}
            </span>
            <span className="font-semibold text-foreground">{p.dataKey === "attendancePct" ? `${p.value}%` : p.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatusChip({ s }: { s?: string }) {
  const c = (s && STATE_COLOR[s]) || "#64748B";
  return <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: `${c}22`, color: c }}><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c }} />{statusLabelOf(s)}</span>;
}
