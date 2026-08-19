import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export const useHolidays = (year: number, location: string) =>
  useQuery<any[]>({ queryKey: [`/api/holidays?year=${year}&location=${location}`] });

/** Every holiday query (any year/location combination) refetches after a write,
 *  since the dashboard and attendance calendars read their own year slices. */
function useInvalidateHolidays() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({
    predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/holidays"),
  });
}

export function useSaveHoliday(holidayId: string | undefined, opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const invalidate = useInvalidateHolidays();
  return useMutation({
    mutationFn: (payload: any) =>
      holidayId ? apiRequest("PUT", `/api/holidays/${holidayId}`, payload) : apiRequest("POST", "/api/holidays", payload),
    onSuccess: () => { invalidate(); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}

export function useDeleteHoliday(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const invalidate = useInvalidateHolidays();
  return useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/holidays/${id}`, {}),
    onSuccess: () => { invalidate(); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}
