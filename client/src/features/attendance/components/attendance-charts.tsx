import { UserCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";
import { STATES, STATE_COLOR } from "../lib/attendance-states";
import { ChartTooltip } from "./attendance-ui";

/** Stacked headcount-by-state chart (weekly / monthly), or the average-attendance-%
 *  bar when monthly + unfiltered. */
export function HeadcountChartCard({
  chartView, onChartView, stateFilter, onStateFilter, graphData, seriesStates, showPct, renderXTick,
}: {
  chartView: "monthly" | "weekly";
  onChartView: (v: "monthly" | "weekly") => void;
  stateFilter: string;
  onStateFilter: (v: string) => void;
  graphData: any[];
  seriesStates: readonly { key: string; label: string; color: string }[];
  showPct: boolean;
  renderXTick: (p: any) => any;
}) {
  return (
    <Card className="border-0 h-[24rem] lg:h-full min-h-[20rem] flex flex-col">
      <CardHeader className="pt-4 pb-2 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:h-9">
          <CardTitle className="text-base font-semibold whitespace-nowrap shrink-0">Employee Headcount</CardTitle>
          <div className="flex items-center gap-2 shrink-0">
            <Select value={chartView} onValueChange={(v) => onChartView(v as any)}>
              <SelectTrigger className="h-7 w-[92px] text-[11px] rounded-[10px] opacity-100 border no-default-hover-elevate" style={{ background: "transparent", borderColor: "rgba(29, 31, 32, 0.75)", boxShadow: "none" }} data-testid="select-chart-view">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly" className="text-xs">Weekly</SelectItem>
                <SelectItem value="monthly" className="text-xs">Monthly</SelectItem>
              </SelectContent>
            </Select>
            <Select value={stateFilter} onValueChange={onStateFilter}>
              <SelectTrigger className="h-7 w-[108px] text-[11px] rounded-[10px] opacity-100 border no-default-hover-elevate" style={{ background: "transparent", borderColor: "rgba(29, 31, 32, 0.75)", boxShadow: "none" }} data-testid="select-state-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All</SelectItem>
                {STATES.map((s) => <SelectItem key={s.key} value={s.key} className="text-xs">{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {/* Legend — all attendance states */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          {STATES.map((s) => (
            <span key={s.key} className="flex items-center gap-1 whitespace-nowrap text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} /> {s.label}
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4 overflow-hidden">
        {/* Absolute-positioned chart: Recharts' ResponsiveContainer measures a flex parent
            unreliably and can render taller than its box; pinning it to inset-0 stops it
            from ever overflowing onto the content below. */}
        <div className="relative h-full w-full">
          <div className="absolute inset-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={graphData} barCategoryGap="14%">
            <defs>
              {STATES.map((s) => (
                <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0.55} />
                </linearGradient>
              ))}
              <linearGradient id="grad-pct" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={STATE_COLOR.attendancePct} stopOpacity={0.9} />
                <stop offset="100%" stopColor={STATE_COLOR.attendancePct} stopOpacity={0.55} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={renderXTick} />
            <YAxis
              tickLine={false} axisLine={false} allowDecimals={false}
              width={showPct ? 36 : 26}
              domain={showPct ? [0, 100] : undefined}
              tickFormatter={showPct ? (v: number) => `${v}%` : undefined}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            />
            <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.4)" }} content={<ChartTooltip />} />
            {showPct ? (
              <Bar dataKey="attendancePct" name="Avg Attendance %" fill="url(#grad-pct)" stroke="rgba(255,255,255,0.5)" strokeWidth={1} radius={[12, 12, 12, 12]} maxBarSize={48} />
            ) : (
              seriesStates.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={`url(#grad-${s.key})`} stroke="rgba(255,255,255,0.5)" strokeWidth={1} radius={[12, 12, 12, 12]} maxBarSize={48} />
              ))
            )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Today's whole active workforce, split by current status. */
export function TodayDonutCard({ pieData, pieTotal, todayCounts }: {
  pieData: { key: string; name: string; value: number; color: string }[];
  pieTotal: number;
  todayCounts: Record<string, number>;
}) {
  return (
    <Card className="border-0 h-[24rem] lg:h-full min-h-[20rem] flex flex-col">
      <CardHeader className="pt-4 pb-2">
        <div className="flex items-center h-9">
          <CardTitle className="text-base font-semibold flex items-center gap-2"><UserCheck className="h-4 w-4 text-muted-foreground" /> Today's Attendance</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {pieTotal === 0 ? (
          <div className="py-10 flex items-center justify-center"><p className="text-sm text-muted-foreground">No one active today</p></div>
        ) : (
          <>
            <div className="relative h-36 w-36 mx-auto" style={{ pointerEvents: "none" }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={64} innerRadius={36} paddingAngle={3} cornerRadius={5} stroke="none">
                    {pieData.map((d) => <Cell key={d.key} fill={d.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-bold text-foreground leading-none tabular-nums">{pieTotal}</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">Employees</span>
              </div>
            </div>
            <div className="space-y-1.5 mt-4">
              {STATES.map((s) => {
                const val = (todayCounts as any)[s.key] || 0;
                const pct = pieTotal ? Math.round((val / pieTotal) * 100) : 0;
                return (
                  <div key={s.key} className="flex items-center gap-2 text-xs" data-testid={`today-pie-legend-${s.key}`}>
                    <span className="w-2.5 h-2.5 rounded-[3px] flex-shrink-0" style={{ background: s.color }} />
                    <span className="text-foreground/80 truncate flex-1">{s.label}</span>
                    <span className="text-muted-foreground tabular-nums">{pct}%</span>
                    <span className="font-semibold text-[#206295] flex-shrink-0 w-6 text-right tabular-nums">{val}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
