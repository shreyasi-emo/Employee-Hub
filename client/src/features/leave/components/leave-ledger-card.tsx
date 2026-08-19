import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

/** Credit/debit history with a running balance. */
export function LeaveLedgerCard({ ledger, leaveTypes }: { ledger: any[]; leaveTypes: any[] }) {
  return (
    <Card className="border-0">
      <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Leave Ledger</CardTitle></CardHeader>
      <CardContent>
        {ledger.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">No ledger entries</div>
        ) : (
          <div className="list-divider">
            {ledger.map((entry: any) => {
              const lt = leaveTypes.find((l: any) => l.id === entry.leaveTypeId);
              const isPositive = entry.transactionType !== "debit";
              const accent = isPositive ? "#206295" : "#FF6F62";
              return (
                <div key={entry.id} className="flex items-center gap-3 py-2.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: accent }} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-foreground capitalize">{entry.transactionType}</span>
                      {lt && <span className="text-xs text-muted-foreground">· {lt.name}</span>}
                    </div>
                    {entry.notes && <p className="text-xs text-muted-foreground">{entry.notes}</p>}
                    <p className="text-xs text-muted-foreground">{format(new Date(entry.createdAt), "MMM d, yyyy")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold" style={{ color: accent }}>{isPositive ? "+" : "-"}{Math.abs(parseFloat(entry.days))}d</p>
                    <p className="text-xs text-muted-foreground">Bal: {parseFloat(entry.balanceAfter)}d</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
