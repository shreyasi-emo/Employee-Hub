import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export const useMovements = () =>
  useQuery<any[]>({ queryKey: ["/api/logistics/movements"] });

export const useLogisticsLocations = () =>
  useQuery<any[]>({ queryKey: ["/api/logistics/locations"] });

// ===== Logistics Requests (Inboard / Outboard) =====
export const useLogisticsRequests = () =>
  useQuery<any[]>({ queryKey: ["/api/logistics/requests"] });

export function useCreateLogisticsRequest(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/logistics/requests", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/logistics/requests"] }); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}

/** Handler transitions: start · complete (needs proof) · cancel. */
export function useLogisticsRequestAction(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, op, body }: { id: string; op: "start" | "complete" | "cancel"; body?: any }) =>
      apiRequest("POST", `/api/logistics/requests/${id}/${op}`, body || {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/logistics/requests"] }); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}

export function useSaveLocation(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: any }) =>
      id ? apiRequest("PATCH", `/api/logistics/locations/${id}`, data) : apiRequest("POST", "/api/logistics/locations", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/logistics/locations"] }); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}

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
