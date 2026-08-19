import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export const useMovements = () =>
  useQuery<any[]>({ queryKey: ["/api/logistics/movements"] });

export const useLogisticsLocations = () =>
  useQuery<any[]>({ queryKey: ["/api/logistics/locations"] });

export function useCreateMovement(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/logistics/movements", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/logistics/movements"] }); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}

/** Workflow transitions: accept · escalate · reject · dispatch · in-transit · deliver.
 *  The op string is the server's route segment. */
export function useMovementAction(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, op }: { id: string; op: string }) => apiRequest("POST", `/api/logistics/movements/${id}/${op}`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/logistics/movements"] }); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}
