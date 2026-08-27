import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getRoleLabel } from "@/lib/auth";

const statusColors: Record<string, string> = {
  active: "bg-[#4BDCD9]/25 text-[#0E7C7B]",
  invited: "bg-[#FFA962]/25 text-[#D98324]",
  suspended: "bg-[#FF6F62]/20 text-[#C4402F]",
  exited: "bg-muted text-muted-foreground",
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
