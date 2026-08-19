import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export const useReferenceDocs = () =>
  useQuery<any[]>({ queryKey: ["/api/reference-docs"] });

export function useUploadReferenceDoc(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/reference-docs", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/reference-docs"] }); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}

export function useDeleteReferenceDoc(opts: { onSuccess?: () => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/reference-docs/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/reference-docs"] }); opts.onSuccess?.(); },
  });
}
