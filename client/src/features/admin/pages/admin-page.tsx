import { useAuth, isHR, isAdmin } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Users, Shield } from "lucide-react";
import { DepartmentSection } from "../components/department-section";
import { DesignationSection } from "../components/designation-section";
import { StatutorySection } from "../components/statutory-section";
import { LeaveTypesSection } from "../components/leave-types-section";
import { UsersSection } from "../components/users-section";

export default function AdminPage() {
  const { data: auth } = useAuth();
  const user = auth?.user;

  if (!isHR(user!)) {
    return (
      <div className="p-6 text-center">
        <Shield className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
        <h2 className="text-lg font-semibold">Access Denied</h2>
        <p className="text-sm text-muted-foreground mt-1">You don't have permission to view this page</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Settings</h1>
        <p className="text-sm text-muted-foreground">Configure organization structure and policies</p>
      </div>

      <Tabs defaultValue="departments">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="departments" data-testid="tab-departments">Departments</TabsTrigger>
          <TabsTrigger value="designations" data-testid="tab-designations">Designations</TabsTrigger>
          <TabsTrigger value="leave-types" data-testid="tab-leave-types">Leave Types</TabsTrigger>
          {isAdmin(user!) && (
            <>
              <TabsTrigger value="statutory" data-testid="tab-statutory">Statutory Config</TabsTrigger>
              <TabsTrigger value="users" data-testid="tab-users">Users & Access</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="departments" className="mt-4">
          <DepartmentSection />
        </TabsContent>
        <TabsContent value="designations" className="mt-4">
          <DesignationSection />
        </TabsContent>
        <TabsContent value="leave-types" className="mt-4">
          <LeaveTypesSection />
        </TabsContent>
        {isAdmin(user!) && (
          <>
            <TabsContent value="statutory" className="mt-4">
              <StatutorySection />
            </TabsContent>
            <TabsContent value="users" className="mt-4">
              <UsersSection />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
