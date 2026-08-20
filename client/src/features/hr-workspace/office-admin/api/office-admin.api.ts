import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// Office Admin runs on the /api/workspace/* tables — vendors, purchase requests and payments.
// This is NOT the employee purchase flow on Company Workspace, which writes to
// /api/office-purchases and /api/procurement. Two systems, similar names.

const VENDORS = "/api/workspace/vendors";
const PURCHASE_REQUESTS = "/api/workspace/purchase-requests";
const PAYMENTS = "/api/workspace/payments";

type Opts = { onSuccess?: () => void; onError?: (e: any) => void };

export const useVendors = () => useQuery<any[]>({ queryKey: [VENDORS] });

export function useCreateVendor(opts: Opts = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiRequest("POST", VENDORS, { ...data, isActive: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [VENDORS] }); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}

export function useCreatePurchaseRequest(opts: Opts = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiRequest("POST", PURCHASE_REQUESTS, {
      category: data.category,
      items: [],
      estimatedCost: data.estimatedCost ? String(data.estimatedCost) : null,
      neededByDate: data.neededByDate || null,
      notes: data.notes || null,
      status: "draft",
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [PURCHASE_REQUESTS] }); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}

export function useCreatePayment(opts: Opts = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiRequest("POST", PAYMENTS, { ...data, amount: Number(data.amount), status: "requested" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [PAYMENTS] }); opts.onSuccess?.(); },
    onError: opts.onError,
  });
}
