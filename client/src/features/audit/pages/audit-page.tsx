import { useState } from "react";
import { useAuth, isAdmin } from "@/lib/auth";
import { useAuditLogs } from "../api/audit.api";
import {
  AuditHeader, AuditFilterBar, AuditStats, AuditLoading, AuditEmpty,
  AuditLogList, AuditAccessDenied,
} from "../components/audit-sections";

export default function AuditPage() {
  const { data: auth } = useAuth();
  const canView = isAdmin(auth?.user!);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");

  const { data: auditLogs = [], isLoading } = useAuditLogs(canView);

  if (!canView) return <AuditAccessDenied />;

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
    <div className="p-6 space-y-6 max-w-[92rem] mx-auto">
      <AuditHeader total={auditLogs.length} />

      <AuditFilterBar
        search={search} onSearch={setSearch}
        entityFilter={entityFilter} onEntityFilter={setEntityFilter} entityTypes={entityTypes}
        actionFilter={actionFilter} onActionFilter={setActionFilter}
      />

      <AuditStats auditLogs={auditLogs} filteredCount={filtered.length} />

      {isLoading ? <AuditLoading /> : filtered.length === 0 ? <AuditEmpty /> : <AuditLogList logs={filtered} />}
    </div>
  );
}
