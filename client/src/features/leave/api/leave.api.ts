import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// ---- reads ----

export const useLeaveRequests = () =>
  useQuery<any[]>({ queryKey: ["/api/leave-requests"] });

export const useLeaveTypes = () =>
  useQuery<any[]>({ queryKey: ["/api/leave-types"] });

export const useLeaveBalances = (employeeId: string | undefined, year: number) =>
  useQuery<any[]>({
    queryKey: employeeId ? [`/api/leave-balances?employeeId=${employeeId}&year=${year}`] : [],
    enabled: !!employeeId,
  });

export const useLeaveLedger = (employeeId: string | undefined) =>
  useQuery<any[]>({
    queryKey: employeeId ? [`/api/leave-ledger?employeeId=${employeeId}`] : [],
    enabled: !!employeeId,
  });

// ---- writes ----

export function useApplyLeave(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/leave-requests", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/leave-requests"] });
      qc.invalidateQueries({ queryKey: ["/api/leave-balances"] });
      opts.onSuccess?.();
    },
    onError: opts.onError,
  });
}

/** Approve / reject / cancel. Also refreshes attendance, because an approved or
 *  cancelled leave changes what the attendance calendar shows. */
export function useUpdateLeaveStatus(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PUT", `/api/leave-requests/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/leave-requests"] });
      qc.invalidateQueries({ queryKey: ["/api/leave-balances"] });
      // Approved/cancelled leave changes the attendance calendar — refresh it too.
      qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/attendance") });
      opts.onSuccess?.();
    },
    onError: opts.onError,
  });
}

/** End an approved leave early from today (employee back early). Trims the remaining days and
 *  restores balance server-side; refreshes leave + the attendance calendar. */
export function useEndLeaveRequest(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/leave-requests/${id}/end`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/leave-requests"] });
      qc.invalidateQueries({ queryKey: ["/api/leave-balances"] });
      qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/attendance") });
      opts.onSuccess?.();
    },
    onError: opts.onError,
  });
}
