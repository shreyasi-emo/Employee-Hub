import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Search, ArrowUpRight } from "lucide-react";
import { EMP_STATUSES } from "../lib/employee-constants";
import { avatarColor, initials } from "../lib/employee-helpers";
import { useAllEmployees, useDepartments, useDesignations } from "../api/employees.api";
import { EmployeeCardGrid } from "../components/employee-card-grid";
import { EmployeesLoading } from "../components/employees-sections";
import { TeamMemberDrawer } from "../components/team-member-drawer";

// Manager's team roster: their own "You" card on top, then search + status filter, then the
// direct reports. No department filter (a manager owns one team), no HR chrome.
export default function MyTeamPage() {
  const { data: auth } = useAuth();
  const me = auth?.employee;
  const myEmpId = me?.id;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  // A report opens in a right-side drawer (basic info + personal), never the full profile page.
  const [drawerEmp, setDrawerEmp] = useState<any | null>(null);
  const { data: allEmployees = [], isLoading } = useAllEmployees();
  const { data: departments = [] } = useDepartments();
  const { data: designations = [] } = useDesignations();

  const deptName = (id?: string) => (departments as any[]).find((d) => d.id === id)?.name;
  const desigName = (id?: string) => (designations as any[]).find((d) => d.id === id)?.name;

  const reports = allEmployees.filter((e) => e.managerId === myEmpId);
  const activeReports = reports.filter((e) => e.employmentStatus !== "exited");
  const byStatus = statusFilter === "all" ? reports : reports.filter((e) => e.employmentStatus === statusFilter);
  const term = search.trim().toLowerCase();
  const shown = term
    ? byStatus.filter((e) => `${e.firstName} ${e.lastName} ${e.email || ""} ${e.employeeCode || ""}`.toLowerCase().includes(term))
    : byStatus;

  const c = me ? avatarColor(me.id) : "#206295";
  const myDesig = desigName(me?.designationId);
  const myDept = deptName(me?.departmentId);

  return (
    <div className="p-6 space-y-6 max-w-[92rem] mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Team</h1>
        <p className="text-sm text-muted-foreground">
          {activeReports.length} {activeReports.length === 1 ? "person reports" : "people report"} to you
        </p>
      </div>

      {/* YOU — the manager's own card */}
      {me && (
        <Card className="border-0">
          <CardContent className="p-5 flex items-center gap-4 flex-wrap">
            <Avatar className="h-16 w-16 flex-shrink-0">
              {me.avatarUrl && <AvatarImage src={me.avatarUrl} />}
              <AvatarFallback className="text-xl font-bold" style={{ backgroundColor: `${c}26`, color: c }}>{initials(me.firstName, me.lastName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground truncate">{me.firstName} {me.lastName}</h2>
                <Badge className="bg-[#206295]/15 text-[#206295]">You</Badge>
              </div>
              <p className="text-sm text-foreground/80 truncate mt-0.5">
                {myDesig || ""}
                {myDesig && myDept && <span className="mx-1.5 text-muted-foreground">|</span>}
                {myDept || ""}
              </p>
              {me.email && <p className="text-xs text-muted-foreground mt-1 truncate">{me.email}</p>}
            </div>
            <div className="flex items-center gap-6 flex-shrink-0">
              <div className="text-center">
                <p className="text-2xl font-bold text-[#206295] leading-none">{activeReports.length}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Team size</p>
              </div>
              <Button variant="secondary" size="sm" asChild data-testid="link-my-profile">
                <a href="/employees/me">My Profile <ArrowUpRight className="h-3.5 w-3.5 ml-1" /></a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search + status filter */}
      {reports.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your team…" className="pl-9" data-testid="input-search-team" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40" data-testid="select-team-status"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              {EMP_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              <SelectItem value="all">All Statuses</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {isLoading ? (
        <EmployeesLoading />
      ) : reports.length === 0 ? (
        <div className="text-center py-16">
          <Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground">No direct reports</h3>
          <p className="text-sm text-muted-foreground mt-1">Nobody currently reports to you.</p>
        </div>
      ) : shown.length === 0 ? (
        <div className="text-center py-16">
          <Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground">No matches</h3>
          <p className="text-sm text-muted-foreground mt-1">No one on your team matches those filters.</p>
        </div>
      ) : (
        <EmployeeCardGrid
          employees={shown}
          departments={departments}
          designations={designations}
          selectionMode={false}
          selected={new Set()}
          onToggle={() => {}}
          onOpen={(emp) => setDrawerEmp(emp)}
        />
      )}

      <TeamMemberDrawer
        open={!!drawerEmp}
        onOpenChange={(o) => { if (!o) setDrawerEmp(null); }}
        employee={drawerEmp}
        dept={drawerEmp ? (departments as any[]).find((d) => d.id === drawerEmp.departmentId) : null}
        desig={drawerEmp ? (designations as any[]).find((d) => d.id === drawerEmp.designationId) : null}
        manager={drawerEmp ? ((allEmployees as any[]).find((e) => e.id === drawerEmp.managerId) || me) : null}
      />
    </div>
  );
}
