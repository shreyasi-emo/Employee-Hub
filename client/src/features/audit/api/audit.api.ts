import { useQuery } from "@tanstack/react-query";

/** Admin-only: the full audit trail. `enabled` gates the fetch so non-admins
 *  never issue the request. */
export const useAuditLogs = (enabled: boolean) =>
  useQuery<any[]>({ queryKey: ["/api/audit-logs"], enabled });
