import { Switch, Route, useLocation, Redirect } from "wouter";
import { useAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { ProtectedRoute } from "./protected-route";

import LoginPage from "@/features/auth/pages/login-page";
import DashboardPage from "@/features/dashboard/pages/dashboard-page";
import EmployeesPage from "@/features/employees/pages/employees-page";
import EmployeeProfilePage from "@/features/employees/pages/employee-profile-page";
import MyTeamPage from "@/features/employees/pages/my-team-page";
import AttendancePage from "@/features/attendance/pages/attendance-page";
import LeavePage from "@/features/leave/pages/leave-page";
import HolidaysPage from "@/features/holidays/pages/holidays-page";
import PayrollPage from "@/features/payroll/pages/payroll-page";
import AdminPage from "@/features/admin/pages/admin-page";
import AnnouncementsPage from "@/features/announcements/pages/announcements-page";
import AssetsPage from "@/features/assets/pages/assets-page";
import AuditPage from "@/features/audit/pages/audit-page";
import PerformancePage from "@/features/performance/pages/performance-page";
import InviteAcceptPage from "@/features/auth/pages/invite-accept-page";
import ShiftsPage from "@/features/shifts/pages/shifts-page";
import OnboardingPage from "@/features/onboarding/pages/onboarding-page";
import CandidateDocForm from "@/features/onboarding/pages/candidate-doc-form";
import ATSPage from "@/features/hr-workspace/pages/ats-page";
import HROpsPage from "@/features/hr-workspace/pages/hr-ops-page";
import CompanyWorkspacePage from "@/features/company-workspace/pages/company-workspace-page";
import MyApprovalsPage from "@/features/company-workspace/pages/my-approvals-page";
import ReimbursementReviewPage from "@/features/company-workspace/reimbursements/pages/reimbursement-review-page";
import MyRequestsPage from "@/features/company-workspace/pages/my-requests-page";
import TeamRequestsPage from "@/features/company-workspace/pages/team-requests-page";
import LogisticsPage from "@/features/logistics/pages/logistics-page";
import RequestsPage from "@/features/company-workspace/pages/requests-page";
import ApprovalNotesPage from "@/features/admin/pages/approval-notes-page";
import VehiclesPage from "@/features/vehicles/pages/vehicles-page";
import ResourcesPage from "@/features/resources/pages/resources-page";
import ReimbursementsPage from "@/features/company-workspace/reimbursements/pages/reimbursements-page";
import NotFound from "./not-found";

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

  if (isLoading && location !== "/login" && !location.startsWith("/onboard")) {
    return <AppBootSplash />;
  }

  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/invite/:token" component={() => <InviteAcceptPage mode="invite" />} />
      <Route path="/reset-password/:token" component={() => <InviteAcceptPage mode="reset" />} />
      <Route path="/onboard/:token" component={CandidateDocForm} />
      <Route path="/" component={() => <Redirect to="/dashboard" />} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={DashboardPage} />} />
      <Route path="/employees" component={() => <ProtectedRoute component={EmployeesPage} />} />
      <Route path="/my-team" component={() => <ProtectedRoute component={MyTeamPage} />} />
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
      <Route path="/shifts" component={() => <ProtectedRoute component={ShiftsPage} />} />
      <Route path="/onboarding" component={() => <ProtectedRoute component={OnboardingPage} />} />
      <Route path="/workspace/ats" component={() => <ProtectedRoute component={ATSPage} />} />
      <Route path="/workspace/hr-ops" component={() => <ProtectedRoute component={HROpsPage} />} />
      <Route path="/workspace/approvals" component={() => <ProtectedRoute component={MyApprovalsPage} />} />
      <Route path="/company-workspace" component={() => <ProtectedRoute component={CompanyWorkspacePage} />} />
      <Route path="/my-approvals" component={() => <ProtectedRoute component={MyApprovalsPage} />} />
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
