// Chrome for the audit log: title, filter row, the four counters, and the
// entry list / loading / empty states.

import { useState, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Search, Activity, SlidersHorizontal, X } from "lucide-react";
import { format } from "date-fns";
import { entityTypeLabels, actionColorFor } from "../lib/audit-labels";

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

const ACTION_LABELS: Record<string, string> = { salary: "Salary Changes", payroll: "Payroll", attendance: "Attendance", leave: "Leave", role: "Role Changes" };

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
  const [sheetOpen, setSheetOpen] = useState(false);

  // Active (non-default) filters — counted on the Filters button and shown as dismissible chips.
  const chips: { key: string; label: string; onClear: () => void }[] = [];
  if (entityFilter !== "all") chips.push({ key: "entity", label: entityTypeLabels[entityFilter] || entityFilter, onClear: () => onEntityFilter("all") });
  if (actionFilter !== "all") chips.push({ key: "action", label: ACTION_LABELS[actionFilter] ?? actionFilter, onClear: () => onActionFilter("all") });
  const resetAll = () => { onEntityFilter("all"); onActionFilter("all"); };

  return (
    <>
      {/* Desktop: search + entity type + action inline (unchanged). */}
      <div className="hidden sm:flex items-center gap-3 flex-wrap">
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

      {/* Mobile: search + Filters on one row; entity + action collapse behind one badged Filters sheet. */}
      <div className="sm:hidden space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search actions, entities, reasons..."
              value={search}
              onChange={e => onSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-audit-mobile"
            />
          </div>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="secondary" size="sm" className="flex-shrink-0" data-testid="button-filters-mobile">
                <SlidersHorizontal className="h-4 w-4 mr-1.5" /> Filters
                {chips.length > 0 && <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#206295] px-1 text-[10px] font-bold text-white">{chips.length}</span>}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
              <SheetHeader className="text-left"><SheetTitle>Filters</SheetTitle></SheetHeader>
              <div className="space-y-4 py-4">
                <FilterField label="Entity type">
                  <Select value={entityFilter} onValueChange={onEntityFilter}>
                    <SelectTrigger className="w-full" data-testid="sheet-entity-filter"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Entities</SelectItem>
                      {entityTypes.map((et: any) => (
                        <SelectItem key={et} value={et}>{entityTypeLabels[et] || et}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>
                <FilterField label="Action">
                  <Select value={actionFilter} onValueChange={onActionFilter}>
                    <SelectTrigger className="w-full" data-testid="sheet-action-filter"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actions</SelectItem>
                      <SelectItem value="salary">Salary Changes</SelectItem>
                      <SelectItem value="payroll">Payroll</SelectItem>
                      <SelectItem value="attendance">Attendance</SelectItem>
                      <SelectItem value="leave">Leave</SelectItem>
                      <SelectItem value="role">Role Changes</SelectItem>
                    </SelectContent>
                  </Select>
                </FilterField>
              </div>
              <SheetFooter className="flex-row gap-2">
                <Button variant="outline" className="flex-1" onClick={resetAll} data-testid="sheet-reset">Reset</Button>
                <SheetClose asChild><Button className="flex-1 btn-primary-gradient text-white" data-testid="sheet-apply">Show results</Button></SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
        {chips.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {chips.map((c) => (
              <button key={c.key} onClick={c.onClear} className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2.5 py-1 text-xs text-foreground hover-elevate" data-testid={`chip-${c.key}`}>
                <span className="truncate max-w-[8rem]">{c.label}</span> <X className="h-3 w-3 flex-shrink-0" />
              </button>
            ))}
            {chips.length > 1 && <button onClick={resetAll} className="text-xs font-medium text-[#206295] underline underline-offset-2" data-testid="chip-clear-all">Clear all</button>}
          </div>
        )}
      </div>
    </>
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
