import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// Incharge: slots + roster for a day. Employee: own upcoming shifts + selectable open slots.
export const useOpsShiftDay = (date: string) =>
  useQuery<{ date: string; slots: any[]; roster: any[] }>({ queryKey: [`/api/ops-shifts?date=${date}`], enabled: !!date });

export const useMyOpsShifts = () =>
  useQuery<{ assignments: any[]; openSlots: any[] }>({ queryKey: ["/api/ops-shifts/my"] });

const invalidate = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/ops-shifts") });

function useOpsMutation<V>(fn: (v: V) => Promise<any>, opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => { invalidate(qc); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}

export const useCreateOpsSlot = (o?: any) => useOpsMutation((data: any) => apiRequest("POST", "/api/ops-shifts", data), o);
export const useUpdateOpsSlot = (o?: any) => useOpsMutation(({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/ops-shifts/${id}`, data), o);
export const useDeleteOpsSlot = (o?: any) => useOpsMutation((id: string) => apiRequest("DELETE", `/api/ops-shifts/${id}`, {}), o);
export const useAssignOpsShift = (o?: any) => useOpsMutation(({ slotId, employeeId }: { slotId: string; employeeId: string }) => apiRequest("POST", `/api/ops-shifts/${slotId}/assign`, { employeeId }), o);
export const useUnassignOpsShift = (o?: any) => useOpsMutation((assignmentId: string) => apiRequest("POST", `/api/ops-shifts/assignments/${assignmentId}/unassign`, {}), o);
export const useAutoAssignOpsShifts = (o?: any) => useOpsMutation((date: string) => apiRequest("POST", "/api/ops-shifts/auto-assign", { date }), o);
export const useSelectOpsSlot = (o?: any) => useOpsMutation((slotId: string) => apiRequest("POST", `/api/ops-shifts/${slotId}/select`, {}), o);
export const useReleaseOpsSlot = (o?: any) => useOpsMutation((assignmentId: string) => apiRequest("POST", `/api/ops-shifts/assignments/${assignmentId}/release`, {}), o);
