import { Switch, Route, useLocation, Redirect } from "wouter";
import { useAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { ProtectedRoute } from "./protected-route";

import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import EmployeesPage from "@/pages/employees";
import EmployeeProfilePage from "@/pages/employee-profile";
import AttendancePage from "@/pages/attendance";
import LeavePage from "@/pages/leave";
import HolidaysPage from "@/pages/holidays";
import PayrollPage from "@/pages/payroll";
import AdminPage from "@/pages/admin";
import AnnouncementsPage from "@/pages/announcements";
import AssetsPage from "@/pages/assets";
import AuditPage from "@/pages/audit";
import PerformancePage from "@/pages/performance";
import SettingsPage from "@/pages/settings";
import InviteAcceptPage from "@/pages/invite-accept";
import ShiftsPage from "@/pages/shifts";
import OnboardingPage from "@/pages/onboarding";
import ATSPage from "@/pages/workspace/ats";
import HROpsPage from "@/pages/workspace/hr-ops";
import OfficeAdminPage from "@/pages/workspace/office";
import CompanyWorkspacePage from "@/pages/company-workspace";
import ReimbursementReviewPage from "@/pages/reimbursement-review";
import MyRequestsPage from "@/pages/my-requests";
import TeamRequestsPage from "@/pages/team-requests";
import LogisticsPage from "@/pages/logistics";
import RequestsPage from "@/pages/requests";
import ApprovalNotesPage from "@/pages/approval-notes";
import VehiclesPage from "@/pages/vehicles";
import ResourcesPage from "@/pages/resources";
import ReimbursementsPage from "@/pages/reimbursements";
import NotFound from "@/pages/not-found";

/** Brand splash shown while the initial /api/auth/me resolves. */
function AppBootSplash() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto">
          <span className="text-primary-foreground font-bold text-lg">E</span>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 mx-auto" />
          <Skeleton className="h-3 w-24 mx-auto" />
        </div>
      </div>
    </div>
  );
}

export function AppRoutes() {
  const { data: auth, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading && location !== "/login") {
    return <AppBootSplash />;
  }

  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/invite/:token" component={() => <InviteAcceptPage mode="invite" />} />
      <Route path="/reset-password/:token" component={() => <InviteAcceptPage mode="reset" />} />
      <Route path="/" component={() => <Redirect to="/dashboard" />} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={DashboardPage} />} />
      <Route path="/employees" component={() => <ProtectedRoute component={EmployeesPage} />} />
      <Route path="/employees/:id" component={() => <ProtectedRoute component={EmployeeProfilePage} />} />
      <Route path="/attendance" component={() => <ProtectedRoute component={AttendancePage} />} />
      <Route path="/leave" component={() => <ProtectedRoute component={LeavePage} />} />
      <Route path="/holidays" component={() => <ProtectedRoute component={HolidaysPage} />} />
      <Route path="/payroll" component={() => <ProtectedRoute component={PayrollPage} />} />
      <Route path="/announcements" component={() => <ProtectedRoute component={AnnouncementsPage} />} />
      <Route path="/assets" component={() => <ProtectedRoute component={AssetsPage} />} />
      <Route path="/admin" component={() => <ProtectedRoute component={AdminPage} />} />
      <Route path="/audit" component={() => <ProtectedRoute component={AuditPage} />} />
      <Route path="/performance" component={() => <ProtectedRoute component={PerformancePage} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={SettingsPage} />} />
      <Route path="/shifts" component={() => <ProtectedRoute component={ShiftsPage} />} />
      <Route path="/onboarding" component={() => <ProtectedRoute component={OnboardingPage} />} />
      <Route path="/workspace/ats" component={() => <ProtectedRoute component={ATSPage} />} />
      <Route path="/workspace/hr-ops" component={() => <ProtectedRoute component={HROpsPage} />} />
      <Route path="/workspace/office" component={() => <ProtectedRoute component={OfficeAdminPage} />} />
      <Route path="/workspace/approvals" component={() => <ProtectedRoute component={CompanyWorkspacePage} />} />
      <Route path="/company-workspace" component={() => <ProtectedRoute component={CompanyWorkspacePage} />} />
      <Route path="/my-approvals" component={() => <ProtectedRoute component={CompanyWorkspacePage} />} />
      <Route path="/my-approvals/reimbursement/:id" component={() => <ProtectedRoute component={ReimbursementReviewPage} />} />
      <Route path="/my-requests" component={() => <ProtectedRoute component={MyRequestsPage} />} />
      <Route path="/my-requests/:tab" component={() => <ProtectedRoute component={MyRequestsPage} />} />
      <Route path="/team-requests" component={() => <ProtectedRoute component={TeamRequestsPage} />} />
      <Route path="/logistics" component={() => <ProtectedRoute component={LogisticsPage} />} />
      <Route path="/requests" component={() => <ProtectedRoute component={RequestsPage} />} />
      <Route path="/approval-notes" component={() => <ProtectedRoute component={ApprovalNotesPage} />} />
      <Route path="/vehicles" component={() => <ProtectedRoute component={VehiclesPage} />} />
      <Route path="/resources" component={() => <ProtectedRoute component={ResourcesPage} />} />
      <Route path="/reimbursements" component={() => <ProtectedRoute component={ReimbursementsPage} />} />
      <Route component={NotFound} />
    </Switch>
  );
}
