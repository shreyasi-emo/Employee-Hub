import { Redirect, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "./layout/app-layout";

// Back-office routes gated by role — typing the URL can no longer open a page your role shouldn't
// see. Mirrors the sidebar's visibility (see app/layout/nav-items.ts). Self-service pages and pages
// whose API already scopes data per role (dashboard, attendance, leave, payroll self-payslip,
// performance, my-requests/approvals, logistics, requests, resources, reimbursements, own profile)
// are intentionally left open — the backend is the real boundary; this is defence-in-depth + UX.
const ROUTE_ROLES: Record<string, string[]> = {
  "/employees": ["super_admin", "hr_admin", "hr_executive"],
  "/my-team": ["manager"],
  "/assets": ["super_admin", "hr_admin", "hr_executive", "manager"],
  "/shifts": ["super_admin", "hr_admin", "hr_executive", "manager", "hr_ops"],
  "/onboarding": ["super_admin", "hr_admin", "hr_executive", "manager", "hr_ops"],
  "/admin": ["super_admin", "hr_admin", "hr_executive", "finance"],
  "/audit": ["super_admin", "hr_admin"],
  "/team-requests": ["super_admin", "hr_admin", "hr_executive", "manager", "hr_ops", "ceo_approver"],
  "/approval-notes": ["super_admin", "ceo_approver", "hr_admin", "hr_executive", "hr_ops", "logistics", "finance"],
  "/workspace/ats": ["super_admin", "hr_admin", "hr_executive", "recruiter", "hr_ops"],
  "/workspace/hr-ops": ["super_admin", "hr_admin", "hr_executive", "hr_ops"],
  "/workspace/office": ["super_admin", "hr_admin", "hr_executive", "finance"],
  "/workspace/approvals": ["super_admin"],
};

/** Gate + chrome for a signed-in page: waits on /api/auth/me, redirects to
 *  /login when there is no session, bounces to /dashboard when the role isn't
 *  allowed on this route, otherwise renders inside the app shell. */
export function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { data: auth, isLoading, error } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-3 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (error || !auth?.user) {
    return <Redirect to="/login" />;
  }

  const allowed = ROUTE_ROLES[location];
  if (allowed && !allowed.includes((auth.user as any).role)) {
    return <Redirect to="/dashboard" />;
  }

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}
