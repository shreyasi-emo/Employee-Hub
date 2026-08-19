import { useAuth, isManager, hasRole } from "@/lib/auth";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MyAttendanceView } from "../components/my-attendance-view";
import { OrgAttendanceView } from "../components/org-attendance-view";

// Container — role-gated: privileged roles get tabs (My Attendance default + Employee Attendance);
// everyone else sees only My Attendance.
export default function AttendancePage() {
  const { data: auth } = useAuth();
  const user = auth?.user || null;
  const canSeeAll = isManager(user) || hasRole(user, "ceo_approver");
  if (!canSeeAll) return <MyAttendanceView />;
  return (
    <Tabs defaultValue="mine" className="w-full">
      <div className="px-6 pt-6 max-w-[92rem] mx-auto">
        {/* One pill split 50/50 down the middle — no gap, outer corners rounded, active half fills its side. */}
        <TabsList className="w-full grid grid-cols-2 gap-0 p-0 h-12 overflow-hidden rounded-[20px] border border-white/70 shadow-[0_4px_16px_rgba(44,62,98,0.18)]">
          <TabsTrigger value="mine" style={{ borderRadius: 0, borderColor: "transparent" }} className="w-full h-full text-sm" data-testid="tab-my-attendance">My Attendance</TabsTrigger>
          <TabsTrigger value="all" style={{ borderRadius: 0, borderColor: "transparent" }} className="w-full h-full text-sm" data-testid="tab-employee-attendance">Employee Attendance</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="mine" className="mt-0"><MyAttendanceView /></TabsContent>
      <TabsContent value="all" className="mt-0"><OrgAttendanceView /></TabsContent>
    </Tabs>
  );
}
