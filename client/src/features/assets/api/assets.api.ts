import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

/** Server-side filtered list. Empty string means "no filter" — matches the
 *  original query-key shape exactly, so the cache keys are unchanged. */
export const useAssets = (categoryFilter: string, statusFilter: string) =>
  useQuery<any[]>({
    queryKey: [`/api/assets?category=${categoryFilter !== "all" ? categoryFilter : ""}&status=${statusFilter !== "all" ? statusFilter : ""}`],
  });

function useInvalidateAssets() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["/api/assets"] });
}

export function useCreateAsset(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const invalidate = useInvalidateAssets();
  return useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/assets", data),
    onSuccess: () => { invalidate(); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}

export function useUpdateAsset(id: string, opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const invalidate = useInvalidateAssets();
  return useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/assets/${id}`, data),
    onSuccess: () => { invalidate(); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}

export function useDeleteAsset(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const invalidate = useInvalidateAssets();
  return useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/assets/${id}`),
    onSuccess: () => { invalidate(); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}
