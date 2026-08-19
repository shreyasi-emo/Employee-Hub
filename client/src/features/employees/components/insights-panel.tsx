import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Cake, Gift, HeartHandshake, Building2, MapPin, Calendar } from "lucide-react";
import { format } from "date-fns";
import { INSIGHT_COLORS } from "../lib/employee-constants";
import { avatarColor, initials, daysUntilAnnual, daysUntilDate } from "../lib/employee-helpers";

const TENURE_BUCKETS = [
  { name: "<1y", min: 0, max: 1 },
  { name: "1–2y", min: 1, max: 2 },
  { name: "2–3y", min: 2, max: 3 },
  { name: "3–5y", min: 3, max: 5 },
  { name: "5y+", min: 5, max: Infinity },
];

/** Workforce insights side sheet: upcoming celebrations + three distributions. */
export function InsightsPanel({ open, onOpenChange, employees, departments }: {
  open: boolean; onOpenChange: (v: boolean) => void; employees: any[]; departments: any[];
}) {
  const deptData = departments.map((d) => ({ name: d.name, value: employees.filter((e) => e.departmentId === d.id).length })).filter((d) => d.value > 0);

  const locMap = new Map<string, number>();
  employees.forEach((e) => { if (e.workLocation) locMap.set(e.workLocation, (locMap.get(e.workLocation) || 0) + 1); });
  const locData = Array.from(locMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const maxLoc = Math.max(1, ...locData.map((l) => l.value));

  // Tenure / years-of-service buckets (from join date)
  const tenureNow = Date.now();
  const yearsOfService = (joinDate: string) => (tenureNow - +new Date(joinDate)) / (365.25 * 86400000);
  const tenureData = TENURE_BUCKETS.map((b) => ({
    name: b.name,
    value: employees.filter((e) => { if (!e.joinDate) return false; const y = yearsOfService(e.joinDate); return y >= b.min && y < b.max; }).length,
  }));
  const hasTenure = tenureData.some((t) => t.value > 0);

  const birthdays = employees.filter((e) => e.dateOfBirth).map((e) => ({ e, d: daysUntilAnnual(e.dateOfBirth) })).filter((x) => x.d <= 45).sort((a, b) => a.d - b.d).slice(0, 8);
  const annivs = employees.filter((e) => e.joinDate).map((e) => ({ e, d: daysUntilAnnual(e.joinDate), yrs: new Date().getFullYear() - new Date(e.joinDate).getFullYear() })).filter((x) => x.d <= 45 && x.yrs >= 1).sort((a, b) => a.d - b.d).slice(0, 8);
  const farewells = employees.filter((e) => e.lastWorkingDate).map((e) => ({ e, d: daysUntilDate(e.lastWorkingDate) })).filter((x) => x.d >= 0 && x.d <= 60).sort((a, b) => a.d - b.d).slice(0, 8);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col gap-0">
        <SheetHeader className="px-6 pt-6 pb-3 flex-shrink-0"><SheetTitle>Workforce Insights</SheetTitle></SheetHeader>
        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-4 px-6 pt-2 pb-8">
            <Card className="border-0"><CardContent className="p-4">
              <p className="text-sm font-semibold mb-1 flex items-center gap-2"><Cake className="h-4 w-4 text-muted-foreground" /> Upcoming Birthdays</p>
              {birthdays.length === 0 ? <p className="text-xs text-muted-foreground pt-1">None in the next 45 days</p> : (
                <div className="list-divider">
                  {birthdays.map(({ e, d }) => (
                    <div key={e.id} className="flex items-center gap-2.5 py-2">
                      <Avatar className="h-8 w-8 flex-shrink-0"><AvatarFallback className="text-xs" style={{ backgroundColor: `${avatarColor(e.id)}26`, color: avatarColor(e.id) }}>{initials(e.firstName, e.lastName)}</AvatarFallback></Avatar>
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium text-foreground truncate">{e.firstName} {e.lastName}</p><p className="text-xs text-[#6A7366]">{format(new Date(e.dateOfBirth), "MMM d")}</p></div>
                      <Badge className="text-[10px] flex-shrink-0 bg-[#FF6F62]/15 text-[#FF6F62]">{d === 0 ? "Today" : `${d}d`}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent></Card>

            <Card className="border-0"><CardContent className="p-4">
              <p className="text-sm font-semibold mb-1 flex items-center gap-2"><Gift className="h-4 w-4 text-muted-foreground" /> Work Anniversaries</p>
              {annivs.length === 0 ? <p className="text-xs text-muted-foreground pt-1">None in the next 45 days</p> : (
                <div className="list-divider">
                  {annivs.map(({ e, d, yrs }) => (
                    <div key={e.id} className="flex items-center gap-2.5 py-2">
                      <Avatar className="h-8 w-8 flex-shrink-0"><AvatarFallback className="text-xs" style={{ backgroundColor: `${avatarColor(e.id)}26`, color: avatarColor(e.id) }}>{initials(e.firstName, e.lastName)}</AvatarFallback></Avatar>
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium text-foreground truncate">{e.firstName} {e.lastName}</p><p className="text-xs text-[#6A7366]">{yrs} year{yrs !== 1 ? "s" : ""} · {format(new Date(e.joinDate), "MMM d")}</p></div>
                      <Badge className="text-[10px] flex-shrink-0 bg-[#FFA962]/20 text-[#FFA962]">{d === 0 ? "Today" : `${d}d`}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent></Card>

            {farewells.length > 0 && (
              <Card className="border-0"><CardContent className="p-4">
                <p className="text-sm font-semibold mb-1 flex items-center gap-2"><HeartHandshake className="h-4 w-4 text-muted-foreground" /> Farewells</p>
                <div className="list-divider">
                  {farewells.map(({ e, d }) => (
                    <div key={e.id} className="flex items-center gap-2.5 py-2">
                      <Avatar className="h-8 w-8 flex-shrink-0"><AvatarFallback className="text-xs" style={{ backgroundColor: `${avatarColor(e.id)}26`, color: avatarColor(e.id) }}>{initials(e.firstName, e.lastName)}</AvatarFallback></Avatar>
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium text-foreground truncate">{e.firstName} {e.lastName}</p><p className="text-xs text-[#6A7366]">Last day · {format(new Date(e.lastWorkingDate), "MMM d")}</p></div>
                      <Badge className="text-[10px] flex-shrink-0 bg-[#6A7366]/15 text-[#6A7366]">{d === 0 ? "Today" : `${d}d`}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent></Card>
            )}

            <Card className="border-0"><CardContent className="p-4">
              <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" /> Department Distribution</p>
              {deptData.length === 0 ? <p className="text-xs text-muted-foreground">No data</p> : (
                <div className="flex items-center gap-4">
                  <div className="h-36 w-36 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={deptData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={64} innerRadius={36} paddingAngle={3} cornerRadius={5}>
                          {deptData.map((_, i) => <Cell key={i} fill={INSIGHT_COLORS[i % INSIGHT_COLORS.length]} fillOpacity={0.85} stroke="rgba(255,255,255,0.75)" strokeWidth={2} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {deptData.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-2 text-xs">
                        <span className="w-2.5 h-2.5 rounded-[3px] flex-shrink-0" style={{ background: INSIGHT_COLORS[i % INSIGHT_COLORS.length] }} />
                        <span className="text-foreground/80 truncate flex-1">{d.name}</span>
                        <span className="font-semibold text-[#206295] flex-shrink-0">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent></Card>

            <Card className="border-0"><CardContent className="p-4">
              <p className="text-sm font-semibold mb-3 flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> Location Distribution</p>
              {locData.length === 0 ? <p className="text-xs text-muted-foreground">No data</p> : (
                <div className="space-y-2.5">
                  {locData.map((l) => (
                    <div key={l.name}>
                      <div className="flex justify-between text-xs mb-1"><span className="text-foreground/80">{l.name}</span><span className="font-semibold text-[#206295]">{l.value}</span></div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(l.value / maxLoc) * 100}%`, background: "#206295" }} /></div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent></Card>

            <Card className="border-0"><CardContent className="p-4">
              <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /> Tenure Distribution</p>
              {!hasTenure ? <p className="text-xs text-muted-foreground">No data</p> : (
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tenureData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: "rgba(32,98,149,0.06)" }} contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }} formatter={(v: any) => [`${v} employee${v === 1 ? "" : "s"}`, "Tenure"]} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={40}>
                        {tenureData.map((_, i) => <Cell key={i} fill={INSIGHT_COLORS[i % INSIGHT_COLORS.length]} fillOpacity={0.9} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent></Card>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
