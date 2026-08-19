import { CARD_STYLE, deptChipColor } from "../lib/dashboard-visuals";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Search } from "lucide-react";

// "Meet the Team" — safe, searchable coworker directory (sanitized fields only; no click-through to
// full profiles, which stay blocked server-side). Avatar-forward card grid.
export function MeetTheTeamCard({ employees, departments, designations, meId }: { employees: any[]; departments: any[]; designations: any[]; meId?: string }) {
  const [q, setQ] = useState("");
  const deptName = (id?: string) => (departments as any[]).find((d) => d.id === id)?.name;
  const desigName = (id?: string) => (designations as any[]).find((d) => d.id === id)?.name;
  const initials = (e: any) => `${e.firstName?.[0] || ""}${e.lastName?.[0] || ""}`.toUpperCase();
  const term = q.trim().toLowerCase();
  const list = (employees as any[])
    .filter((e) => e.employmentStatus !== "exited")
    .filter((e) => !term || `${e.firstName} ${e.lastName} ${deptName(e.departmentId) || ""} ${desigName(e.designationId) || ""} ${e.employeeCode || ""}`.toLowerCase().includes(term))
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  return (
    <Card className="border-0 lg:col-span-3 lg:h-[26rem] flex flex-col" style={CARD_STYLE}>
      <CardHeader className="pt-4 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /> Meet the Team <span className="text-xs font-normal text-muted-foreground">{list.length}</span></CardTitle>
        <div className="relative w-full sm:w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, team, role…" className="pl-9 h-9" data-testid="input-team-search" />
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 flex-1 min-h-0">
        {list.length === 0 ? (
          <div className="h-full flex items-center justify-center"><p className="text-sm text-muted-foreground">No one matches your search.</p></div>
        ) : (
          <ScrollArea className="h-full -mr-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 pr-2">
              {list.map((e) => {
                const c = deptChipColor(e.departmentId);
                const isYou = meId && e.id === meId;
                return (
                  <div key={e.id} className="flex items-center gap-3 rounded-xl border border-border/60 p-2.5 hover-elevate" data-testid={`coworker-${e.id}`}>
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      {(e.profilePhoto || e.avatarUrl) && <AvatarImage src={e.profilePhoto || e.avatarUrl} />}
                      <AvatarFallback className="text-xs font-semibold" style={{ backgroundColor: `${c}1F`, color: c }}>{initials(e)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{e.firstName} {e.lastName}{isYou ? <span className="text-[10px] font-normal text-muted-foreground"> (You)</span> : null}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{desigName(e.designationId) || "—"}</p>
                      {e.departmentId && <span className="inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: `${c}1F`, color: c }}>{deptName(e.departmentId)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
