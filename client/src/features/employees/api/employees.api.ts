import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// ---- directory reads ----

/** Server-side status + search filter. Department is filtered client-side so the
 *  full set stays available for the tab counts — hence the empty departmentId. */
export const useEmployeeDirectory = (statusFilter: string, search: string) =>
  useQuery<any[]>({
    queryKey: [`/api/employees?status=${statusFilter !== "all" ? statusFilter : ""}&search=${search}&departmentId=`],
  });

/** Unfiltered set, used for org-wide counts, manager pickers and the joiners report. */
export const useAllEmployees = () =>
  useQuery<any[]>({ queryKey: ["/api/employees?status=&search=&departmentId="] });

export const useDepartments = () => useQuery<any[]>({ queryKey: ["/api/departments"] });
export const useDesignations = () => useQuery<any[]>({ queryKey: ["/api/designations"] });

// ---- single employee (profile) reads ----

export const useEmployee = (empId: string | undefined) =>
  useQuery<any>({ queryKey: [`/api/employees/${empId}`], enabled: !!empId });

export const useEmployeeAuditLogs = (empId: string | undefined, enabled: boolean) =>
  useQuery<any[]>({ queryKey: [`/api/audit-logs?entityType=employee&entityId=${empId}`], enabled: !!empId && enabled });

export const useEmployeeHistory = (empId: string) =>
  useQuery<any[]>({ queryKey: [`/api/employees/${empId}/history`], enabled: !!empId });

// ---- writes ----

/** Any employee list/filter combination refetches, plus the dashboard headcount. */
function useInvalidateEmployees() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/employees") });
    qc.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
  };
}

export function useSaveEmployee(employeeId: string | undefined, opts: { onSuccess?: (data: any) => void; onError?: (e: any) => void } = {}) {
  const invalidate = useInvalidateEmployees();
  return useMutation({
    mutationFn: (payload: any) =>
      employeeId ? apiRequest("PUT", `/api/employees/${employeeId}`, payload) : apiRequest("POST", "/api/employees", payload),
    onSuccess: (data: any) => { invalidate(); opts.onSuccess?.(data); },
    onError: opts.onError,
  });
}

export function useUpdateEmploymentStatus(empId: string | undefined, opts: { onSuccess?: () => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: string) => apiRequest("PUT", `/api/employees/${empId}`, { employmentStatus: status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/employees/${empId}`] });
      qc.invalidateQueries({ queryKey: ["/api/employees"] });
      opts.onSuccess?.();
    },
  });
}

/** Create a department/designation inline from the employee form's "+ Add New". */
export function useCreateDepartment() {
  const qc = useQueryClient();
  return async (name: string, code: string) => {
    const dept: any = await apiRequest("POST", "/api/departments", { name, code });
    await qc.invalidateQueries({ queryKey: ["/api/departments"] });
    return dept.id as string;
  };
}

export function useCreateDesignation() {
  const qc = useQueryClient();
  return async (name: string) => {
    const desig: any = await apiRequest("POST", "/api/designations", { name });
    await qc.invalidateQueries({ queryKey: ["/api/designations"] });
    return desig.id as string;
  };
}

/** Bulk field update — sequential PUTs, matching the original behaviour. */
export function useBulkUpdateEmployees() {
  const qc = useQueryClient();
  return async (ids: string[], field: string, value: string) => {
    for (const id of ids) await apiRequest("PUT", `/api/employees/${id}`, { [field]: value });
    await qc.invalidateQueries({ queryKey: ["/api/employees"] });
  };
}

/** CSV import — one POST per row, tallying successes and skips. */
export function useImportEmployees() {
  const qc = useQueryClient();
  return async (payloads: any[]) => {
    let ok = 0, fail = 0;
    for (const payload of payloads) {
      if (!payload.firstName || !payload.lastName || !payload.email) { fail++; continue; }
      try { await apiRequest("POST", "/api/employees", payload); ok++; } catch { fail++; }
    }
    await qc.invalidateQueries({ queryKey: ["/api/employees"] });
    return { ok, fail };
  };
}

/** The bare, unparameterised employee list. Distinct endpoint from
 *  useAllEmployees() — several features share this exact cache key, so the
 *  profile page must keep using it rather than the filtered variant. */
export const useEmployeesList = () => useQuery<any[]>({ queryKey: ["/api/employees"] });
