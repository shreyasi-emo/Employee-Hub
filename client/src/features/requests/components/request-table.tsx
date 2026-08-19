import { formatDate, money, amountOf, titleOf, subOf } from "../shared/request-format";
import { submittedInfo } from "../shared/submitted-info";
import { SubmittedLabel } from "./request-ui";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "../reimbursements/components/status-badge";
import { statusClass, statusLabel } from "@/lib/status";

// Clean table view of requests for the current tab.
export function RequestTable({ type, items, onOpen }: { type: string; items: any[]; onOpen: (it: any) => void }) {
  return (
    <div className="card-surface rounded-[16px]">
      <DataTable
        columns={[
          { key: "request", header: "Request", cellClassName: "font-medium text-foreground", render: (it: any) => titleOf(type, it) },
          { key: "details", header: "Details", cellClassName: "text-muted-foreground max-w-[18rem] truncate", render: (it: any) => subOf(type, it) || "—" },
          { key: "status", header: "Status", render: (it: any) => type === "reimbursement" ? <StatusBadge status={it.status} /> : <Badge className={`text-xs ${statusClass(it.status)}`}>{statusLabel(it.status)}</Badge> },
          { key: "amount", header: "Amount", align: "right", cellClassName: "font-semibold text-foreground", render: (it: any) => amountOf(type, it) ? money(amountOf(type, it)) : "—" },
          { key: "submitted", header: "Submitted on", cellClassName: "text-muted-foreground", render: (it: any) => { const sub = submittedInfo(type, it); return <div className="flex flex-col"><SubmittedLabel info={sub} className="text-[10px] uppercase tracking-wide text-muted-foreground" /><span>{formatDate(sub.date)}</span></div>; } },
          { key: "updated", header: "Last Updated", cellClassName: "text-muted-foreground", render: (it: any) => it.updatedAt ? formatDate(it.updatedAt) : "—" },
        ]}
        rows={items}
        getRowKey={(it: any) => it.id}
        onRowClick={(it: any) => onOpen(it)}
        rowClassName={(it: any) => it.status === "changes_requested" ? "bg-[#FF6F62]/[0.06]" : ""}
        testIdPrefix={`row-${type}`}
      />
    </div>
  );
}
