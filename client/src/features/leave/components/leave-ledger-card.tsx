import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { leaveTypeColor } from "../lib/leave-model";
import { format } from "date-fns";

/** Credit/debit history with a running balance — a neat, house-styled table. */
export function LeaveLedgerCard({ ledger, leaveTypes }: { ledger: any[]; leaveTypes: any[] }) {
  const lt = (id: string) => (leaveTypes || []).find((l: any) => l.id === id);

  const columns: DataTableColumn<any>[] = [
    { key: "date", header: "Date", render: (r) => <span className="whitespace-nowrap text-foreground/80">{format(new Date(r.createdAt), "MMM d, yyyy")}</span> },
    {
      key: "type", header: "Leave Type",
      render: (r) => { const t = lt(r.leaveTypeId); return t ? <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: leaveTypeColor(t) }} />{t.name}</span> : <span className="text-muted-foreground/50">—</span>; },
    },
    {
      key: "transaction", header: "Transaction",
      render: (r) => { const pos = r.transactionType !== "debit"; return <Badge className={pos ? "bg-[#206295]/15 text-[#206295]" : "bg-[#FF6F62]/20 text-[#C4402F]"}><span className="capitalize">{String(r.transactionType).replace(/_/g, " ")}</span></Badge>; },
    },
    {
      key: "days", header: "Days", align: "right",
      render: (r) => { const pos = r.transactionType !== "debit"; return <span className="font-semibold" style={{ color: pos ? "#206295" : "#C4402F" }}>{pos ? "+" : "−"}{Math.abs(parseFloat(r.days))}</span>; },
    },
    { key: "balance", header: "Balance", align: "right", render: (r) => <span className="tabular-nums font-medium text-foreground">{parseFloat(r.balanceAfter)}</span> },
    {
      key: "notes", header: "Notes", cellClassName: "max-w-[18rem]",
      render: (r) => r.notes ? <span className="text-muted-foreground line-clamp-1" title={r.notes}>{r.notes}</span> : <span className="text-muted-foreground/40">—</span>,
    },
  ];

  return (
    <Card className="border-0">
      <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Leave Ledger</CardTitle></CardHeader>
      <DataTable columns={columns} rows={ledger} getRowKey={(r) => r.id} emptyText="No ledger entries" testIdPrefix="ledger" />
    </Card>
  );
}
