import { Redirect } from "wouter";
import { useAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "./layout/app-layout";

/** Gate + chrome for a signed-in page: waits on /api/auth/me, redirects to
 *  /login when there is no session, otherwise renders inside the app shell. */
export function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { data: auth, isLoading, error } = useAuth();

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

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}
