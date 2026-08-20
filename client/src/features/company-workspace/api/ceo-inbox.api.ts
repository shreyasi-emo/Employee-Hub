import { useQuery } from "@tanstack/react-query";

/**
 * How many items are sitting in the CEO Inbox awaiting a decision — the number on
 * the sidebar badge. Mirrors what /workspace/approvals actually shows:
 * finance-approved reimbursements, plus office purchases and procurement in
 * pending_approval or under_review.
 *
 * Super-admin only (they own that tab), so the three queries stay disabled for
 * everyone else. Polls every 60s.
 *
 * Lives in features/requests because it is request-queue logic; the sidebar only
 * renders the number.
 */
export function useCeoInboxCount(enabled: boolean) {
  const { data: reimb = [] } = useQuery<any[]>({ queryKey: ["/api/reimbursements?summary=true"], enabled, refetchInterval: 60000 });
  const { data: ops = [] } = useQuery<any[]>({ queryKey: ["/api/office-purchases"], enabled, refetchInterval: 60000 });
  const { data: procs = [] } = useQuery<any[]>({ queryKey: ["/api/procurement"], enabled, refetchInterval: 60000 });

  if (!enabled) return 0;
  const awaitingCeo = (o: any) => ["pending_approval", "under_review"].includes(o.status);
  return (reimb as any[]).filter((r) => r.status === "finance_approved").length
    + (ops as any[]).filter(awaitingCeo).length
    + (procs as any[]).filter(awaitingCeo).length;
}
