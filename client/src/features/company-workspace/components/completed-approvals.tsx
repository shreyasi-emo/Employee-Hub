import { useState } from "react";
import { money, fmtDate } from "../shared/approval-format";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { statusClass, statusLabel } from "@/lib/status";
import { DataTable } from "@/components/shared/data-table";
import { ApprovalToolbar } from "./approval-toolbar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Row = { key: string; icon: any; cat: string; title: string; sub: string; amount: number; date: any; status: string };

// Decided-approval history across every category the viewer approves. A single scannable table
// (Category · Reference · Requester · Amount · Date · Status) with search + category filter, so it's
// easy to grasp at a glance. Uses the shared ApprovalToolbar + DataTable (which paginates itself).
export function CompletedApprovals({ rows }: { rows: Row[] }) {
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");
  const [page, setPage] = useState(1);

  if (rows.length === 0) {
    return <div className="card-surface rounded-2xl py-16 text-center"><Check className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-sm text-muted-foreground">No completed approvals yet.</p></div>;
  }

  const order = ["Reimbursements", "Office Purchases", "Procurement", "Travel"];
  const cats = [...order.filter((c) => rows.some((r) => r.cat === c)), ...Array.from(new Set(rows.map((r) => r.cat))).filter((c) => !order.includes(c))];
  const q = search.trim().toLowerCase();
  const filtered = rows.filter((r) => (cat === "all" || r.cat === cat) && (!q || `${r.title} ${r.sub} ${r.cat} ${statusLabel(r.status)}`.toLowerCase().includes(q)));
  const PAGE = 12;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const curPage = Math.min(page, totalPages);
  const paged = filtered.slice((curPage - 1) * PAGE, curPage * PAGE);

  return (
    <div className="space-y-4">
      <ApprovalToolbar
        search={search}
        onSearch={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search completed…"
        page={curPage} totalPages={totalPages} onPage={setPage} total={filtered.length} pageSize={PAGE}
        filters={
          <Select value={cat} onValueChange={(v) => { setCat(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[180px] text-xs flex-shrink-0" data-testid="completed-cat"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />
      <div className="card-surface rounded-2xl overflow-hidden">
        <DataTable
          columns={[
            { key: "cat", header: "Category", render: (r: Row) => <span className="inline-flex items-center gap-2"><span className="h-6 w-6 rounded-lg bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0"><r.icon className="h-3.5 w-3.5" /></span><span className="text-foreground">{r.cat}</span></span> },
            { key: "title", header: "Reference", cellClassName: "font-medium text-foreground" },
            { key: "sub", header: "Requester", cellClassName: "text-muted-foreground", render: (r: Row) => r.sub || "—" },
            { key: "amount", header: "Amount", align: "right", cellClassName: "font-semibold text-foreground", render: (r: Row) => (r.amount > 0 ? money(r.amount) : "—") },
            { key: "date", header: "Date", cellClassName: "text-muted-foreground", render: (r: Row) => (r.date ? fmtDate(r.date) : "—") },
            { key: "status", header: "Status", render: (r: Row) => <Badge className={`text-xs ${statusClass(r.status)}`}>{statusLabel(r.status)}</Badge> },
          ]}
          rows={paged}
          getRowKey={(r: Row) => r.key}
          emptyText="No completed approvals match your filters."
          testIdPrefix="completed"
          paginate={false}
        />
      </div>
    </div>
  );
}
