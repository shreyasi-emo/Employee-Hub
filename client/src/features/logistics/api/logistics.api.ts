import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export const useMovements = () =>
  useQuery<any[]>({ queryKey: ["/api/logistics/movements"] });

export const useLogisticsLocations = () =>
  useQuery<any[]>({ queryKey: ["/api/logistics/locations"] });

// ===== Logistics Requests (Inboard / Outboard) =====
export const useLogisticsRequests = () =>
  useQuery<any[]>({ queryKey: ["/api/logistics/requests"] });

// Live single request — keeps the detail dialog in sync as logistics works through the stages.
export const useLogisticsRequest = (id?: string) =>
  useQuery<any>({ queryKey: [`/api/logistics/requests/${id}`], enabled: !!id });

// Invalidate both the list and any open single-request view.
const invalidateLogistics = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/logistics/requests") });

export function useCreateLogisticsRequest(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/logistics/requests", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/logistics/requests"] }); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}

/** Handler/finance transitions along the flow. The op string is the server's route segment. */
export type LogisticsOp = "start" | "dispatch" | "deliver" | "complete" | "cancel" | "plant-verify" | "finance-verify" | "refresh-tracking";
export function useLogisticsRequestAction(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, op, body }: { id: string; op: LogisticsOp; body?: any }) =>
      apiRequest("POST", `/api/logistics/requests/${id}/${op}`, body || {}),
    onSuccess: () => { invalidateLogistics(qc); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}

/** Logistics edits the processing fields (carrier, vehicle, tracking no., customer, verification, discrepancy). */
export function useUpdateLogisticsRequest(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/logistics/requests/${id}`, data),
    onSuccess: () => { invalidateLogistics(qc); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}

/** Upload / remove a typed logistics document. */
export function useLogisticsDoc(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; add: { type: string; financeOnly?: boolean; file: any } } | { id: string; removeIndex: number }) =>
      "removeIndex" in v
        ? apiRequest("DELETE", `/api/logistics/requests/${v.id}/documents/${v.removeIndex}`, {})
        : apiRequest("POST", `/api/logistics/requests/${v.id}/documents`, v.add),
    onSuccess: () => { invalidateLogistics(qc); opts.onSuccess?.(); },
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

/** Workflow transitions: accept | escalate | reject | dispatch | in-transit | deliver.
 *  The op string is the server's route segment. */
export function useMovementAction(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, op }: { id: string; op: string }) => apiRequest("POST", `/api/logistics/movements/${id}/${op}`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/logistics/movements"] }); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}
