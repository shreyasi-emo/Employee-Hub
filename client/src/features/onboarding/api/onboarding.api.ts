import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

type Opts = { onSuccess?: () => void; onError?: (e: any) => void };

// Template tasks live under several query keys (one per template), so they are invalidated by
// predicate rather than by an exact key.
const invalidateTasks = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.includes("/tasks") });

export function useCreateOnboardingTemplate(opts: Opts = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/onboarding/templates", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/onboarding/templates"] }); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}

export function useCreateOnboardingTask(templateId: string | null, opts: Opts = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/onboarding/templates/${templateId}/tasks`, data),
    onSuccess: () => { invalidateTasks(qc); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}
