import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export const useAnnouncements = () =>
  useQuery<any[]>({ queryKey: ["/api/announcements"] });

export function useCreateAnnouncement(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/announcements", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/announcements"] }); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}

export function useDeleteAnnouncement(opts: { onSuccess?: () => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/announcements/${id}`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/announcements"] }); opts.onSuccess?.(); },
  });
}
