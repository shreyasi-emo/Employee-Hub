import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth, isHR, isAdmin } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, User, Briefcase, CreditCard, FileText, Package, Target, History as HistoryIcon, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useEmployee, useDepartments, useDesignations, useEmployeeSalary,
  useEmployeePayslips, useEmployeeAssets, useEmployeeAuditLogs,
  useEmployeesList, useUpdateEmploymentStatus,
} from "../api/employees.api";
import { ProfileHeaderCard } from "../components/profile-header-card";
import {
  PersonalTab, EmploymentTab, SalaryTab, PayslipsTab, AssignedAssetsTab, ProfileAuditTab,
} from "../components/profile-tabs";
import { EmployeePerformanceHistory } from "../components/employee-performance-history";
import { EmploymentHistoryTab } from "../components/employment-history-tab";
import { EmployeeFormDialog } from "../components/employee-form-dialog";
import { AddSalaryDialog } from "../components/add-salary-dialog";

export default function EmployeeProfilePage() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { data: auth } = useAuth();
  const user = auth?.user;
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("personal");
  const [showAddSalary, setShowAddSalary] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const empId = params.id === "me" ? auth?.employee?.id : params.id;
  const isAdminUser = isAdmin(user!);
  const isHrUser = isHR(user!);
  const isSelf = user?.employeeId === empId;
  const canSeeSalary = isAdminUser || isSelf;

  const { data: employee, isLoading } = useEmployee(empId);
  const { data: departments = [] } = useDepartments();
  const { data: designations = [] } = useDesignations();
  const { data: employees = [] } = useEmployeesList();
  const { data: salaryStructures = [] } = useEmployeeSalary(empId, canSeeSalary);
  const { data: payslips = [] } = useEmployeePayslips(empId);
  const { data: assets = [] } = useEmployeeAssets(empId);
  const { data: auditLogs = [] } = useEmployeeAuditLogs(empId, isAdminUser);

  const updateStatus = useUpdateEmploymentStatus(empId, { onSuccess: () => toast({ title: "Status updated" }) });

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
  const tabDefs = [
    { value: "personal", label: "Personal", icon: User, show: true },
    { value: "salary", label: "Salary", icon: CreditCard, show: canSeeSalary },
    { value: "payslips", label: "Payslips", icon: FileText, show: true },
    { value: "assets", label: "Assets", icon: Package, show: true },
    { value: "performance", label: "Performance", icon: Target, show: true },
    { value: "history", label: "History", icon: HistoryIcon, show: true },
    { value: "audit", label: "Audit", icon: Shield, show: isAdminUser },
  ].filter((t) => t.show);

  return (
    <div className="p-6 max-w-[92rem] mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="icon" className="h-10 w-10 flex-shrink-0" onClick={() => navigate("/employees")} aria-label="Back" data-testid="button-back">
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      <ProfileHeaderCard
        employee={employee}
        dept={dept}
        desig={desig}
        canManage={isHrUser}
        onStatusChange={(v) => updateStatus.mutate(v)}
        onEdit={() => setShowEdit(true)}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto">
          {tabDefs.map((t) => (
            <TabsTrigger key={t.value} value={t.value} data-testid={`tab-${t.value}`} className="gap-1.5">
              <t.icon className="h-4 w-4" /> {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="personal" className="mt-4 space-y-4">
          <PersonalTab employee={employee} showBank={isHrUser} onEdit={isHrUser ? () => setShowEdit(true) : undefined} />
          <EmploymentTab employee={employee} dept={dept} desig={desig} manager={manager} />
        </TabsContent>

        {canSeeSalary && (
          <TabsContent value="salary" className="mt-4">
            <SalaryTab salaryStructures={salaryStructures} canAdd={isAdminUser} onAdd={() => setShowAddSalary(true)} />
            <AddSalaryDialog open={showAddSalary} onOpenChange={setShowAddSalary} employeeId={empId!} />
          </TabsContent>
        )}

        <TabsContent value="payslips" className="mt-4">
          <PayslipsTab payslips={payslips} />
        </TabsContent>

        <TabsContent value="assets" className="mt-4">
          <AssignedAssetsTab assets={assets} />
        </TabsContent>

        <TabsContent value="performance" className="mt-4">
          <EmployeePerformanceHistory empId={empId!} />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <EmploymentHistoryTab empId={empId!} />
        </TabsContent>

        {isAdminUser && (
          <TabsContent value="audit" className="mt-4">
            <ProfileAuditTab auditLogs={auditLogs} />
          </TabsContent>
        )}
      </Tabs>

      {isHrUser && (
        <EmployeeFormDialog
          open={showEdit}
          onOpenChange={setShowEdit}
          employee={employee}
          departments={departments}
          designations={designations}
          employees={employees}
          knownLocations={Array.from(new Set(employees.map((e: any) => e.workLocation).filter(Boolean))) as string[]}
        />
      )}
    </div>
  );
}
