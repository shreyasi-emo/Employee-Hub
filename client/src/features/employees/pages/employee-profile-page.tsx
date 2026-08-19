import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth, isHR, isAdmin } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft } from "lucide-react";
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
      <div className="p-6 max-w-4xl mx-auto space-y-4">
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

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
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
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="personal" data-testid="tab-personal">Personal</TabsTrigger>
          <TabsTrigger value="employment" data-testid="tab-employment">Employment</TabsTrigger>
          {canSeeSalary && <TabsTrigger value="salary" data-testid="tab-salary">Salary</TabsTrigger>}
          <TabsTrigger value="payslips" data-testid="tab-payslips">Payslips</TabsTrigger>
          <TabsTrigger value="assets" data-testid="tab-assets">Assets</TabsTrigger>
          <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
          {isAdminUser && <TabsTrigger value="audit" data-testid="tab-audit">Audit</TabsTrigger>}
        </TabsList>

        <TabsContent value="personal" className="mt-4">
          <PersonalTab employee={employee} showBank={isHrUser} />
        </TabsContent>

        <TabsContent value="employment" className="mt-4">
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
