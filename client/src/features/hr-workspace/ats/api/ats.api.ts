import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// Recruitment: job requisitions, candidates, and the applications that join them.
const REQUISITIONS = "/api/workspace/requisitions";
const CANDIDATES = "/api/workspace/candidates";
const APPLICATIONS = "/api/workspace/applications";

type Opts = { onSuccess?: () => void; onError?: (e: any) => void };

export function useCreateRequisition(opts: Opts = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiRequest("POST", REQUISITIONS, {
      ...data,
      noOfPositions: Number(data.noOfPositions),
      salaryMin: data.salaryMin ? Number(data.salaryMin) : null,
      salaryMax: data.salaryMax ? Number(data.salaryMax) : null,
      status: "draft",
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [REQUISITIONS] }); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}

export function useCreateCandidate(opts: Opts = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiRequest("POST", CANDIDATES, {
      ...data,
      experienceYears: data.experienceYears ? Number(data.experienceYears) : null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [CANDIDATES] }); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}

/** A new application always enters at the first pipeline stage. */
export function useCreateApplication(firstStageId: string | undefined, opts: Opts = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiRequest("POST", APPLICATIONS, { ...data, status: "active", pipelineStageId: firstStageId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [APPLICATIONS] }); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}
