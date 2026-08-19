import { CARD_STYLE, QUICK_ACTIONS } from "../lib/dashboard-visuals";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";

export function QuickActionsRow() {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Quick Actions</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {QUICK_ACTIONS.map((a) => (
          <a key={a.href} href={a.href} className="block" data-testid={`quick-${a.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <Card className="border-0 card-hover h-full" style={CARD_STYLE}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2.5 rounded-lg flex-shrink-0 ${a.color}`}><a.icon className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{a.label}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{a.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
}
