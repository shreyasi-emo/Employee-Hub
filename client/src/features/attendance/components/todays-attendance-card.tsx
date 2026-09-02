import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { STATES } from "../lib/attendance-states";
import { teamRankAgainst } from "../lib/my-attendance-model";
import { fetchAttendanceStreak } from "../api/attendance.api";
import { EmpAvatar } from "./attendance-ui";

const STREAK_VERB: Record<string, string> = { leave: "on leave", wfh: "on WFH", on_duty: "on duty", half_day: "on half-day" };
// Forward-looking: how many upcoming working days they'll STILL be in this state (0 = don't show).
const streakLabel = (s: { status: string; days: number }) => `${s.days} day${s.days > 1 ? "s" : ""} left${STREAK_VERB[s.status] ? ` ${STREAK_VERB[s.status]}` : ""}`;

function dayStatusMeta(s: string) {
  const found = STATES.find((x) => x.key === s);
  if (found) return { color: found.color, label: found.key === "present" ? "In Office" : found.label };
  if (s === "holiday") return { color: "#94A3B8", label: "Holiday" };
  if (s === "weekend") return { color: "#CBD5E1", label: "Weekend" };
  return { color: "#94A3B8", label: "—" };
}

/** Who's in / out today, teammates first, with a hover streak lookup.
 *  Owns its own search/filter/hover state. */
export function TodaysAttendanceCard({ todayList, myEmp }: { todayList: any[]; myEmp: any }) {
  const [todaySearch, setTodaySearch] = useState("");
  const [todayFilter, setTodayFilter] = useState<string>("all");
  const [scope, setScope] = useState<"team" | "all">("team"); // Teammates (default) vs All employees
  const [streakMap, setStreakMap] = useState<Record<string, { status: string; days: number }>>({});
  const [hoveredEmp, setHoveredEmp] = useState<string | null>(null);

  const teamRank = teamRankAgainst(myEmp);
  const isTeammate = (e: any) => !!myEmp && teamRank(e) <= 1; // you + peers/manager/reports
  const teamCount = useMemo(() => (todayList as any[]).filter(isTeammate).length, [todayList, myEmp]);
  const todayRows = useMemo(() => {
    const q = todaySearch.trim().toLowerCase();
    return (todayList as any[])
      .filter((e) => scope === "all" || !myEmp || isTeammate(e))
      .filter((e) => todayFilter === "all" || e.status === todayFilter)
      .filter((e) => !q || `${e.firstName} ${e.lastName} ${e.employeeCode || ""}`.toLowerCase().includes(q))
      .sort((a, b) => { const r = teamRank(a) - teamRank(b); return r !== 0 ? r : `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayList, todaySearch, todayFilter, scope, myEmp]);

  const loadStreak = async (id: string) => {
    setHoveredEmp(id);
    if (streakMap[id]) return;
    try { const s: any = await fetchAttendanceStreak(id); setStreakMap((m) => ({ ...m, [id]: s })); } catch { /* ignore */ }
  };

  return (
    <div className="card-surface rounded-2xl p-4 flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-3 gap-2">
        <p className="text-base font-semibold text-foreground">Today's Attendance</p>
        <Select value={todayFilter} onValueChange={setTodayFilter}>
          <SelectTrigger className="h-7 w-[116px] text-[11px] rounded-[10px]" data-testid="select-today-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All States</SelectItem>
            {STATES.map((s) => <SelectItem key={s.key} value={s.key} className="text-xs">{s.key === "present" ? "In Office" : s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {myEmp && (
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#206295]/10 border border-[#206295]/15 mb-3" role="tablist">
          {([["team", "Teammates", teamCount], ["all", "All", (todayList as any[]).length]] as const).map(([val, label, count]) => {
            const active = scope === val;
            return (
              <button
                key={val}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setScope(val as "team" | "all")}
                className={`flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-semibold transition-colors ${active ? "btn-primary-gradient text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                data-testid={`today-scope-${val}`}
              >
                {label}
                <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${active ? "bg-white/25 text-white" : "bg-foreground/10 text-muted-foreground"}`}>{count}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={todaySearch} onChange={(e) => setTodaySearch(e.target.value)} placeholder="Search people…" className="pl-9 h-9" data-testid="input-today-search" />
      </div>
      {todayRows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No one matches.</p>
      ) : (
        <ScrollArea className="flex-1 min-h-0 -mr-2">
          <div className="list-divider pr-2">
            {todayRows.map((e: any) => {
              const meta = dayStatusMeta(e.status);
              const st = streakMap[e.id];
              const isYou = myEmp && e.id === myEmp.id;
              return (
                <div
                  key={e.id}
                  className="flex items-center gap-3 py-2"
                  onMouseEnter={() => loadStreak(e.id)}
                  onMouseLeave={() => setHoveredEmp(null)}
                  data-testid={`today-emp-${e.id}`}
                >
                  <EmpAvatar emp={e} className="h-8 w-8" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{e.firstName} {e.lastName}{isYou ? " (You)" : ""}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{e.department || e.employeeCode || ""}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: `${meta.color}22`, color: meta.color }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />{meta.label}
                    </span>
                    {hoveredEmp === e.id && st && st.days > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">{streakLabel(st)}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
