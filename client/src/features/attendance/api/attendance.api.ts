// Attendance data access. Query keys stay literal URLs — that is this app's
// convention (lib/queryClient joins the key to form the request), so these hooks
// are thin wrappers, not a new abstraction layer.
//
// Only /api/attendance* and /api/approvals/feed live here. Cross-domain reads the
// views also need (employees, leave, holidays, departments) stay as plain useQuery
// at the call site until those features own them.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// ---- reads ----

export const useAttendanceRange = (from: string, to: string) =>
  useQuery<any[]>({ queryKey: [`/api/attendance/range?from=${from}&to=${to}`] });


export const useMyAttendanceMonth = (month: number, year: number) =>
  useQuery<any[]>({ queryKey: [`/api/attendance?month=${month}&year=${year}`] });

export const useAttendanceReport = (from: string, to: string) =>
  useQuery<any>({ queryKey: [`/api/attendance/report?from=${from}&to=${to}`] });

export const useTodayAttendanceList = () =>
  useQuery<any[]>({ queryKey: ["/api/attendance/today-list"] });

export const useWfhPending = () =>
  useQuery<any[]>({ queryKey: ["/api/attendance/wfh-pending"] });

export const useApprovalsFeed = () =>
  useQuery<any[]>({ queryKey: ["/api/approvals/feed"] });

// Attendance-override (regularization) requests — own list for employees, pending queue for approvers.
export const useRegularizations = (status?: string) =>
  useQuery<any[]>({ queryKey: [status ? `/api/regularizations?status=${status}` : "/api/regularizations"] });

export const fetchAttendanceStreak = (employeeId: string) =>
  apiRequest("GET", `/api/attendance/streak?employeeId=${employeeId}`);

// ---- cache invalidation ----

/** Refresh every attendance query (range/month) so graph, cards and lists stay in sync. */
export function useInvalidateAttendance() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({
    predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/attendance"),
  });
}

/** Attendance + leave together — used by the self view, where ending a leave
 *  changes both. */
export function useInvalidateAttendanceAndLeave() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({
    predicate: (q) => typeof q.queryKey[0] === "string"
      && ((q.queryKey[0] as string).startsWith("/api/attendance") || (q.queryKey[0] as string).startsWith("/api/leave")),
  });
}

// ---- writes ----

/** HR override of a single day's attendance. */
export function useOverrideAttendance(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/attendance", data),
    onSuccess: () => {
      // Refresh every attendance query (range/month) + leave so graph, cards and lists stay in sync
      qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/attendance") });
      qc.invalidateQueries({ queryKey: ["/api/leave-requests"] });
      opts.onSuccess?.();
    },
    onError: opts.onError,
  });
}

/** Refresh attendance + regularization queries together (an override write changes both). */
function useInvalidateAttendanceAndRegs() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({
    predicate: (q) => typeof q.queryKey[0] === "string"
      && ((q.queryKey[0] as string).startsWith("/api/attendance") || (q.queryKey[0] as string).startsWith("/api/regularizations")),
  });
}

/** Employee requests an attendance override for a PAST date (mandatory reason). Goes to HR/manager. */
export function useRequestOverride(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const invalidate = useInvalidateAttendanceAndRegs();
  return useMutation({
    mutationFn: (payload: any) => apiRequest("POST", "/api/regularizations", payload),
    onSuccess: () => { invalidate(); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}

/** HR/manager decision on a pending attendance-override request — approve writes the corrected day. */
export function useDecideOverride(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const invalidate = useInvalidateAttendanceAndRegs();
  return useMutation({
    mutationFn: ({ id, ...body }: any) => apiRequest("PUT", `/api/regularizations/${id}`, body),
    onSuccess: () => { invalidate(); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}

/** Manager/HR decision on a pending WFH request. */
export function useDecideWfh(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const invalidate = useInvalidateAttendance();
  return useMutation({
    mutationFn: (p: any) => apiRequest("PATCH", "/api/attendance/wfh", p),
    onSuccess: () => { invalidate(); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}

export function useStartOnDuty(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const invalidate = useInvalidateAttendance();
  return useMutation({
    mutationFn: (payload: any) => apiRequest("POST", "/api/attendance/on-duty", payload),
    onSuccess: () => { invalidate(); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}

export function useEndOnDuty(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const invalidate = useInvalidateAttendanceAndLeave();
  return useMutation({
    mutationFn: () => apiRequest("POST", "/api/attendance/on-duty/end", {}),
    onSuccess: () => { invalidate(); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}

export function useApplyWfh(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const invalidate = useInvalidateAttendance();
  return useMutation({
    mutationFn: (payload: any) => apiRequest("POST", "/api/attendance/wfh", payload),
    onSuccess: () => { invalidate(); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}

/** End an ongoing/upcoming leave early — un-taken days return to balance.
 *  Lives here because the self view's calendar owns the action. */
export function useEndLeave(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const invalidate = useInvalidateAttendanceAndLeave();
  return useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/leave-requests/${id}/end`, {}),
    onSuccess: () => { invalidate(); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}
