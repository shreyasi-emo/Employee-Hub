// Vehicle fleet + booking data access. Query keys stay literal URLs (this app's
// convention), so these hooks are thin wrappers rather than a new layer.
//
// Cross-domain reads the screen also needs (employees, departments) stay as plain
// useQuery at the call site — those belong to other features.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// ---- reads ----

export const useVehicles = () => useQuery<any[]>({ queryKey: ["/api/vehicles"] });

export const useVehicleBookings = () => useQuery<any[]>({ queryKey: ["/api/vehicles/bookings"] });

// ---- cache invalidation ----

function useInvalidateBookings() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["/api/vehicles/bookings"] });
}

function useInvalidateVehicles() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["/api/vehicles"] });
}

// ---- booking writes ----

export function useCreateBooking(opts: { onSuccess?: (data: any) => void; onError?: (e: any) => void } = {}) {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: (payload: any) => apiRequest("POST", "/api/vehicles/book", payload),
    onSuccess: (data: any) => { invalidate(); opts.onSuccess?.(data); },
    onError: opts.onError,
  });
}

export function useUpdateBooking(bookingId: string | undefined, opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: (payload: any) => apiRequest("PATCH", `/api/vehicles/bookings/${bookingId}`, payload),
    onSuccess: () => { invalidate(); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}

export function useCancelBooking(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/vehicles/bookings/${id}/cancel`, {}),
    onSuccess: () => { invalidate(); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}

/** A passenger removing themselves from someone else's trip. */
export function useOptOutOfBooking(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/vehicles/bookings/${id}/opt-out`, {}),
    onSuccess: () => { invalidate(); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}

/** HR approving / rejecting a rental request — `action` is the route segment. */
export function useRentalDecision(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: string; note?: string }) =>
      apiRequest("POST", `/api/vehicles/rentals/${id}/${action}`, note ? { note } : {}),
    onSuccess: () => { invalidate(); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}

// ---- fleet writes (HR) ----

/** Create or update a vehicle. The Name field was removed from the form — the model
 *  identifies the vehicle, so mirror model → name (the DB column is NOT NULL). */
export function useSaveVehicle(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const invalidate = useInvalidateVehicles();
  return useMutation({
    mutationFn: ({ id, ...rest }: any) => {
      const body = { ...rest, name: (rest.model || rest.name || "").trim() || "Vehicle", seatingCapacity: rest.seatingCapacity ? Number(rest.seatingCapacity) : null, fuelType: rest.fuelType || null, transmission: rest.transmission || null, driverUserId: rest.driverUserId || null };
      return id ? apiRequest("PATCH", `/api/vehicles/${id}`, body) : apiRequest("POST", "/api/vehicles", body);
    },
    onSuccess: () => { invalidate(); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}

export function useDeleteVehicle(opts: { onSuccess?: () => void; onError?: (e: any) => void } = {}) {
  const invalidate = useInvalidateVehicles();
  return useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/vehicles/${id}`, {}),
    onSuccess: () => { invalidate(); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}
