import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// Raising a ticket changes the ticket list and the Company Workspace "Open Tickets" figure,
// so both are invalidated. Kept here rather than in the form, matching every other feature.
export function useCreateTicket(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/my-requests/tickets", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/my-requests/tickets"] });
      qc.invalidateQueries({ queryKey: ["/api/my-requests/summary"] });
      opts.onSuccess?.();
    },
    onError: opts.onError,
  });
}
