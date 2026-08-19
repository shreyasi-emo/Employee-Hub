import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getRoleLabel } from "@/lib/auth";

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  invited: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  suspended: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  exited: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
};

/** Who you're signed in as: initials, name, username, account status and role. */
export function AccountSummaryCard({ user, emp }: { user: any; emp: any }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
          <span className="text-primary-foreground font-bold text-lg">
            {emp ? `${emp.firstName[0]}${emp.lastName[0]}` : user?.username?.slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {emp ? `${emp.firstName} ${emp.lastName}` : user?.username}
          </p>
          <p className="text-xs text-muted-foreground">@{user?.username}</p>
          {emp && <p className="text-xs text-muted-foreground">{emp.email}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`text-xs ${statusColors[(user as any)?.accountStatus || "active"]}`} data-testid="badge-account-status">
            {(user as any)?.accountStatus || "active"}
          </Badge>
          <Badge variant="outline" className="text-xs" data-testid="badge-role">
            {getRoleLabel(user?.role as any)}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
