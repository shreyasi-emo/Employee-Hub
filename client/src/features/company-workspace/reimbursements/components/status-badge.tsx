import { Badge } from "@/components/ui/badge";
import { statusClass, statusLabel } from "@/lib/status";

/** The reimbursement status chip. Lives here rather than in the page because
 *  My Requests renders it too — previously it reached across into the
 *  reimbursements *page* to import it. */
export function StatusBadge({ status }: { status: string }) {
  return <Badge className={`text-xs ${statusClass(status)}`}>{statusLabel(status)}</Badge>;
}
