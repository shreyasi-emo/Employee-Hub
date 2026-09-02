import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth, isHR, isAdmin } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { ChevronLeft, ChevronDown, User, Package, Target, History as HistoryIcon, Edit, Mail, Check, CalendarDays } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useEmployee, useDepartments, useDesignations, useEmployeeAssets,
  useEmployeeAuditLogs, useEmployeesList, useUpdateEmploymentStatus,
} from "../api/employees.api";
import { ProfileSummaryCard } from "../components/profile-summary-card";
import { ProfileOverview, AssignedAssetsTab } from "../components/profile-tabs";
import { ProfileDocsCard, ProfileActivityCard } from "../components/profile-side-cards";
import { EmployeePerformanceHistory } from "../components/employee-performance-history";
import { EmploymentHistoryTab } from "../components/employment-history-tab";
import { EmployeeFormDialog } from "../components/employee-form-dialog";
import { SelfEditDialog } from "../components/self-edit-dialog";

const STATUS_OPTS = ["active", "on_notice", "inactive", "exited"];
const STATUS_DOT: Record<string, string> = { active: "#0E7C7B", on_notice: "#D98324", inactive: "#64748B", exited: "#C4402F" };

// Profile KPI card — heading 5% smaller than the shared StatCard, with optional hover tooltip.
function ProfileStat({ title, value, icon: Icon, color, tooltip }: { title: string; value: number | string; icon: any; color: string; tooltip?: string }) {
  const card = (
    <Card className="border-0 card-hover h-full"><CardContent className="px-5 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-0.5 flex-1 min-w-0">
          <p className="text-[13.3px] font-medium text-muted-foreground">{title}</p>
          <p className="text-[26px] leading-tight font-bold text-foreground">{value}</p>
        </div>
        <div className={`p-2 rounded-xl flex-shrink-0 ${color}`}><Icon className="h-5 w-5" /></div>
      </div>
    </CardContent></Card>
  );
  if (!tooltip) return card;
  return (
    <Tooltip>
      <TooltipTrigger asChild><div className="h-full cursor-default">{card}</div></TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export default function EmployeeProfilePage() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { data: auth } = useAuth();
  const user = auth?.user;
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [showEdit, setShowEdit] = useState(false);

  const fromMyProfile = params.id === "me";
  const empId = fromMyProfile ? auth?.employee?.id : params.id;
  const isAdminUser = isAdmin(user!);
  const isHrUser = isHR(user!);
  const isSelf = user?.employeeId === empId;
  const canEdit = isHrUser || isSelf;

  const now = new Date();

  const { data: employee, isLoading } = useEmployee(empId);
  const { data: departments = [] } = useDepartments();
  const { data: designations = [] } = useDesignations();
  const { data: employees = [] } = useEmployeesList();
  // Salary + payslips are intentionally NOT fetched on this deployment.
  const { data: assets = [] } = useEmployeeAssets(empId);
  const { data: auditLogs = [] } = useEmployeeAuditLogs(empId, isAdminUser);
  const { data: leaveTypes = [] } = useQuery<any[]>({ queryKey: ["/api/leave-types"] });
  const { data: leaveRequests = [] } = useQuery<any[]>({ queryKey: ["/api/leave-requests"] });

  const updateStatus = useUpdateEmploymentStatus(empId, { onSuccess: () => toast({ title: "Status updated" }) });

  const qc = useQueryClient();
  const uploadAvatar = useMutation({
    mutationFn: (avatarUrl: string | null) => apiRequest("PUT", isSelf ? "/api/employees/me" : `/api/employees/${empId}`, { avatarUrl }),
    onSuccess: (_data, avatarUrl) => {
      qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && ((q.queryKey[0] as string).startsWith("/api/employees") || q.queryKey[0] === "/api/auth/me") });
      toast({ title: avatarUrl ? "Photo updated" : "Photo removed" });
    },
    onError: (e: any) => toast({ title: "Couldn't update photo", description: e.message, variant: "destructive" }),
  });

  // Documents are HR/Super-Admin managed → always the by-id endpoint (requireHR on the server).
  const saveDocuments = useMutation({
    mutationFn: (documents: Record<string, any>) => apiRequest("PUT", `/api/employees/${empId}`, { documents }),
    onSuccess: () => {
      qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/employees") });
      toast({ title: "Documents updated" });
    },
    onError: (e: any) => toast({ title: "Couldn't update documents", description: e.message, variant: "destructive" }),
  });

  if (isLoading || !empId) {
    return (
      <div className="p-6 max-w-[92rem] mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-semibold">Employee not found</h2>
        <Button className="mt-4" onClick={() => navigate("/employees")}>Back to Employees</Button>
      </div>
    );
  }

  const dept = departments.find((d: any) => d.id === employee.departmentId);
  const desig = designations.find((d: any) => d.id === employee.designationId);
  const manager = employees.find((e: any) => e.id === employee.managerId);
  const status = employee.employmentStatus as string;
  const myLeaves = (leaveRequests as any[]).filter((r) => r.employeeId === empId);

  // ----- Stats -----
  const daysInCompany = employee.joinDate ? Math.max(0, Math.floor((now.getTime() - new Date(employee.joinDate).getTime()) / 86400000)) : null;

  const tabDefs = [
    { value: "overview", label: "Overview", icon: User, show: true },
    // Salary + Payslips are intentionally NOT exposed on this deployment.
    { value: "assets", label: "Assets", icon: Package, show: true },
    { value: "performance", label: "Performance", icon: Target, show: true },
    { value: "history", label: "History", icon: HistoryIcon, show: true },
  ].filter((t) => t.show);

  return (
    <TooltipProvider delayDuration={200}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full max-w-[92rem] mx-auto p-6 flex flex-col gap-6">
        {/* Header — "Employee Details" | tabs | (HR status) Actions */}
        <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
          {!fromMyProfile && (
            <Button variant="secondary" size="icon" className="h-10 w-10 flex-shrink-0" onClick={() => navigate("/employees")} aria-label="Back" data-testid="button-back">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <h1 className="text-xl font-bold text-foreground flex-shrink-0">Employee Details</h1>
          <div className="w-px self-stretch bg-border mx-1 hidden lg:block" />
          <TabsList className="flex-wrap h-auto">
            {tabDefs.map((t) => (
              <TabsTrigger key={t.value} value={t.value} data-testid={`tab-${t.value}`} className="gap-1.5">
                <t.icon className="h-4 w-4" /> {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex-1" />

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* HR / super-admin actions on this employee — left of the edit button */}
            {isHrUser && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5" data-testid="profile-status">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_DOT[status] || STATUS_DOT.inactive }} />
                    <span className="capitalize">{status?.replace("_", " ")}</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Set status</DropdownMenuLabel>
                  {STATUS_OPTS.map((s) => (
                    <DropdownMenuItem key={s} onClick={() => updateStatus.mutate(s)} data-testid={`set-status-${s}`}>
                      <span className="capitalize">{s.replace("_", " ")}</span>
                      {status === s && <Check className="h-3.5 w-3.5 ml-auto text-[#206295]" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5" data-testid="profile-actions">Actions <ChevronDown className="h-3.5 w-3.5" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={() => setShowEdit(true)} data-testid="action-edit"><Edit className="h-4 w-4 mr-2" /> Edit Details</DropdownMenuItem>
                  {employee.email && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => { window.location.href = `mailto:${employee.email}`; }}><Mail className="h-4 w-4 mr-2" /> Send email</DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* 3 columns — left + right fixed full-height, middle's inner container is the only scroller. */}
        {/* overflow-visible on desktop so card hover-lift + shadows aren't clipped; each column is
            already bounded by lg:h-full + its own internal scroll, so nothing actually overflows. */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-4 lg:auto-rows-fr gap-4 overflow-y-auto lg:overflow-visible">
          {/* LEFT — Job Details */}
          <aside className="lg:col-span-1 lg:h-full lg:min-h-0">
            <ProfileSummaryCard
              employee={employee}
              dept={dept}
              desig={desig}
              manager={manager}
              canEditPhoto={isSelf || isHrUser}
              onAvatarChange={(url) => uploadAvatar.mutate(url)}
            />
          </aside>

          {/* MIDDLE — fixed stat cards + one scrolling container */}
          <div className="lg:col-span-2 lg:h-full lg:min-h-0 flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-shrink-0 px-0.5 pt-0.5">
              <ProfileStat title="Days in the Company" value={daysInCompany ?? "—"} icon={CalendarDays} color="bg-[#206295]/15 text-[#206295]" />
              <ProfileStat title="Assets Assigned" value={assets.length} icon={Package} color="bg-[#4BDCD9]/25 text-[#206295]" />
            </div>

            {/* One fixed container; content scrolls INSIDE via ScrollArea (never the card itself). */}
            <div className="flex-1 min-h-0">
              <TabsContent value="overview" className="mt-0 lg:h-full">
                <Card className="lg:h-full flex flex-col overflow-hidden">
                  {/* pr-4 puts the scrollbar 16px off the card's right edge — same inset as the
                      Recent Activities card. The inner pr-2 makes up the 24px so the fields stay put. */}
                  <CardContent className="pl-0 pr-4 py-4 flex-1 min-h-0">
                    <ScrollArea className="lg:h-full">
                      <div className="pl-6 pr-2 py-2">
                        <ProfileOverview employee={employee} desig={desig} showBank={isHrUser || isSelf} />
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Salary + Payslips tabs are removed from this deployment entirely. */}
              <TabsContent value="assets" className="mt-0 lg:h-full"><ScrollArea className="lg:h-full"><div className="lg:pr-3"><AssignedAssetsTab assets={assets} /></div></ScrollArea></TabsContent>
              <TabsContent value="performance" className="mt-0 lg:h-full"><ScrollArea className="lg:h-full"><div className="lg:pr-3"><EmployeePerformanceHistory empId={empId!} /></div></ScrollArea></TabsContent>
              <TabsContent value="history" className="mt-0 lg:h-full"><div className="lg:h-full px-1 pt-1.5 pb-1"><EmploymentHistoryTab empId={empId!} leaves={myLeaves} leaveTypes={leaveTypes} /></div></TabsContent>
            </div>
          </div>

          {/* RIGHT — Docs + Recent Activities */}
          <aside className="lg:col-span-1 lg:h-full lg:min-h-0 flex flex-col gap-4">
            <div className="lg:flex-1 lg:min-h-0"><ProfileDocsCard documents={employee.documents} canManage={isHrUser} onSave={(next) => saveDocuments.mutate(next)} /></div>
            <div className="lg:flex-1 lg:min-h-0"><ProfileActivityCard auditLogs={auditLogs} leaveRequests={myLeaves} leaveTypes={leaveTypes} /></div>
          </aside>
        </div>

        {/* Edit — HR gets the full form; an employee edits their own personal + bank details only. */}
        {isHrUser ? (
          <EmployeeFormDialog
            open={showEdit}
            onOpenChange={setShowEdit}
            employee={employee}
            departments={departments}
            designations={designations}
            employees={employees}
            knownLocations={Array.from(new Set(employees.map((e: any) => e.workLocation).filter(Boolean))) as string[]}
          />
        ) : isSelf ? (
          <SelfEditDialog open={showEdit} onOpenChange={setShowEdit} employee={employee} />
        ) : null}
      </Tabs>
    </TooltipProvider>
  );
}
