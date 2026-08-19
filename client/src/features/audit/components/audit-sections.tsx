// Chrome for the audit log: title, filter row, the four counters, and the
// entry list / loading / empty states.

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Search, Activity } from "lucide-react";
import { format } from "date-fns";
import { entityTypeLabels, actionColorFor } from "../lib/audit-labels";

export function AuditHeader({ total }: { total: number }) {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">{total} total entries</p>
      </div>
    </div>
  );
}

export function AuditFilterBar({ search, onSearch, entityFilter, onEntityFilter, entityTypes, actionFilter, onActionFilter }: {
  search: string; onSearch: (v: string) => void;
  entityFilter: string; onEntityFilter: (v: string) => void; entityTypes: any[];
  actionFilter: string; onActionFilter: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="relative flex-1 min-w-48">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search actions, entities, reasons..."
          value={search}
          onChange={e => onSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-audit"
        />
      </div>
      <Select value={entityFilter} onValueChange={onEntityFilter}>
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
      <Select value={actionFilter} onValueChange={onActionFilter}>
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
  );
}

export function AuditStats({ auditLogs, filteredCount }: { auditLogs: any[]; filteredCount: number }) {
  const tiles = [
    { label: "Total Entries", value: auditLogs.length, color: "text-foreground" },
    { label: "Today", value: auditLogs.filter((l: any) => new Date(l.createdAt).toDateString() === new Date().toDateString()).length, color: "text-blue-600" },
    { label: "Critical Actions", value: auditLogs.filter((l: any) => l.action?.includes("payroll") || l.action?.includes("salary") || l.action?.includes("unlock")).length, color: "text-red-600" },
    { label: "Filtered", value: filteredCount, color: "text-primary" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {tiles.map(s => (
        <Card key={s.label}>
          <CardContent className="p-3 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function AuditLoading() {
  return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
}

export function AuditEmpty() {
  return (
    <div className="text-center py-12">
      <Activity className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
      <p className="text-muted-foreground text-sm">No audit logs found</p>
    </div>
  );
}

export function AuditLogList({ logs }: { logs: any[] }) {
  return (
    <div className="space-y-2">
      {logs.map((log: any) => (
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
                <Badge className={`text-xs ${actionColorFor(log.action)}`}>
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
      ))}
    </div>
  );
}

export function AuditAccessDenied() {
  return (
    <div className="p-6 text-center">
      <Shield className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
      <h2 className="text-lg font-semibold">Access Denied</h2>
      <p className="text-sm text-muted-foreground mt-1">Audit logs require admin access</p>
    </div>
  );
}
