import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth, isAdmin } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Search, Filter, Activity } from "lucide-react";
import { format } from "date-fns";

const actionColors: Record<string, string> = {
  create: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  update: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  delete: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  salary_change: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  payroll_lock: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  payroll_unlock: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  attendance_override: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  leave_approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  leave_rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  login: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  role_change: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
};

const entityTypeLabels: Record<string, string> = {
  employee: "Employee",
  salary: "Salary",
  payroll: "Payroll",
  attendance: "Attendance",
  leave: "Leave",
  user: "User",
  announcement: "Announcement",
  asset: "Asset",
  holiday: "Holiday",
};

export default function AuditPage() {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");

  const { data: auditLogs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/audit-logs"],
    enabled: isAdmin(user!),
  });

  if (!isAdmin(user!)) {
    return (
      <div className="p-6 text-center">
        <Shield className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
        <h2 className="text-lg font-semibold">Access Denied</h2>
        <p className="text-sm text-muted-foreground mt-1">Audit logs require admin access</p>
      </div>
    );
  }

  const filtered = auditLogs.filter((log: any) => {
    if (entityFilter !== "all" && log.entityType !== entityFilter) return false;
    if (actionFilter !== "all" && !log.action.includes(actionFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      return log.action?.toLowerCase().includes(q) ||
        log.entityType?.toLowerCase().includes(q) ||
        log.reason?.toLowerCase().includes(q);
    }
    return true;
  });

  const entityTypes = Array.from(new Set(auditLogs.map((l: any) => l.entityType))).filter(Boolean);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">{auditLogs.length} total entries</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search actions, entities, reasons..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-audit"
          />
        </div>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-36" data-testid="select-entity-filter">
            <SelectValue placeholder="Entity type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            {entityTypes.map((et: any) => (
              <SelectItem key={et} value={et}>{entityTypeLabels[et] || et}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-36" data-testid="select-action-filter">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="salary">Salary Changes</SelectItem>
            <SelectItem value="payroll">Payroll</SelectItem>
            <SelectItem value="attendance">Attendance</SelectItem>
            <SelectItem value="leave">Leave</SelectItem>
            <SelectItem value="role">Role Changes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Entries", value: auditLogs.length, color: "text-foreground" },
          { label: "Today", value: auditLogs.filter((l: any) => new Date(l.createdAt).toDateString() === new Date().toDateString()).length, color: "text-blue-600" },
          { label: "Critical Actions", value: auditLogs.filter((l: any) => l.action?.includes("payroll") || l.action?.includes("salary") || l.action?.includes("unlock")).length, color: "text-red-600" },
          { label: "Filtered", value: filtered.length, color: "text-primary" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Logs */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Activity className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">No audit logs found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log: any) => {
            const actionColor = Object.entries(actionColors).find(([k]) => log.action?.includes(k))?.[1] || actionColors.update;

            return (
              <Card key={log.id} data-testid={`audit-log-${log.id}`}>
                <CardContent className="p-3 flex items-start gap-3">
                  <Shield className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground capitalize">
                        {log.action?.replace(/_/g, " ")}
                      </span>
                      {log.entityType && (
                        <Badge variant="outline" className="text-xs capitalize">
                          {entityTypeLabels[log.entityType] || log.entityType}
                        </Badge>
                      )}
                      <Badge className={`text-xs ${actionColor}`}>
                        {log.action?.split("_")[0]}
                      </Badge>
                    </div>
                    {log.reason && (
                      <p className="text-xs text-muted-foreground mt-0.5">Reason: {log.reason}</p>
                    )}
                    {log.changedFields && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Fields changed: {Array.isArray(log.changedFields) ? log.changedFields.join(", ") : JSON.stringify(log.changedFields)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(log.createdAt), "MMM d, yyyy 'at' h:mm:ss a")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
