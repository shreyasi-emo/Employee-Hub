import { money, fmtDate } from "../shared/approval-format";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { statusClass, statusLabel } from "@/lib/status";

export function CompletedApprovals({ rows }: { rows: { key: string; icon: any; cat: string; title: string; sub: string; amount: number; date: any; status: string }[] }) {
  if (rows.length === 0) return <div className="card-surface rounded-2xl py-16 text-center"><Check className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-sm text-muted-foreground">No completed approvals yet.</p></div>;
  // Segregate the history by category, same order as the pending cards.
  const order = ["Reimbursements", "Office Purchases", "Procurement", "Travel"];
  const byCat = new Map<string, typeof rows>();
  rows.forEach((r) => { const a = byCat.get(r.cat); if (a) a.push(r); else byCat.set(r.cat, [r]); });
  const cats = [...order.filter((c) => byCat.has(c)), ...[...byCat.keys()].filter((c) => !order.includes(c))];
  return (
    <div className="space-y-6">
      {cats.map((c) => {
        const items = byCat.get(c)!;
        const Icon = items[0].icon;
        return (
          <div key={c} className="space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0"><Icon className="h-3.5 w-3.5" /></span>
              <h3 className="text-sm font-semibold text-foreground">{c}</h3>
              <span className="text-xs text-muted-foreground">{items.length}</span>
            </div>
            {items.map((r) => (
              <div key={r.key} className="card-surface p-4 flex items-center gap-4">
                <span className="h-9 w-9 rounded-xl bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0"><r.icon className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap"><span className="text-[13px] font-semibold text-foreground truncate">{r.title}</span><Badge className={`text-[10px] ${statusClass(r.status)}`}>{statusLabel(r.status)}</Badge></div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{r.sub}{r.date ? ` | ${fmtDate(r.date)}` : ""}</p>
                </div>
                {r.amount > 0 && <span className="text-sm font-bold text-[#206295] tabular-nums flex-shrink-0">{money(r.amount)}</span>}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
