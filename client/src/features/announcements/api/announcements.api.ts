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

// Toggle a basic reaction on a community post.
export function useReactToPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, emoji }: { id: string; emoji: string }) => apiRequest("POST", `/api/announcements/${id}/react`, { emoji }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/announcements"] }),
  });
}

// Community posting permission — HR/Admin manage who else may post.
export const useCommunityContributors = (enabled: boolean) =>
  useQuery<any[]>({ queryKey: ["/api/community/contributors"], enabled });

export function useSetContributor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, canPost }: { userId: string; canPost: boolean }) => apiRequest("PATCH", `/api/community/contributors/${userId}`, { canPost }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/community/contributors"] }),
  });
}
