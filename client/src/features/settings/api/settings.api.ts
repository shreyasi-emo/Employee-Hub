import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

/** The signed-in user's own employee record (only fetched when one is linked). */
export const useMyEmployeeRecord = (enabled: boolean) =>
  useQuery<any>({ queryKey: ["/api/employees/me"], enabled });

export function useChangePassword(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      apiRequest("PUT", "/api/auth/change-password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      }),
    onSuccess: opts.onSuccess,
    onError: opts.onError,
  });
}

/** Self-service profile edit. Invalidates auth/me too, since the header and
 *  sidebar read the employee record from there. */
export function useUpdateMyProfile(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiRequest("PUT", "/api/employees/me", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/employees/me"] });
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      opts.onSuccess?.();
    },
    onError: opts.onError,
  });
}
