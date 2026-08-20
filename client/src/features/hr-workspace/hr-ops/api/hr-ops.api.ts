import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// HR Ops runs on /api/workspace/hr-tasks and /api/workspace/tickets.
// Its tickets are the HR helpdesk (admin_tickets), NOT the employee support tickets on
// Company Workspace, which write to /api/my-requests/tickets. Two systems, similar forms.

const HR_TASKS = "/api/workspace/hr-tasks";
const TICKETS = "/api/workspace/tickets";

type Opts = { onSuccess?: () => void; onError?: (e: any) => void };

export function useCreateHrTask(opts: Opts = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiRequest("POST", HR_TASKS, { ...data, status: "pending", dueDate: data.dueDate || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [HR_TASKS] }); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}

export function useCreateHelpdeskTicket(opts: Opts = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiRequest("POST", TICKETS, { ...data, status: "open" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [TICKETS] }); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}
