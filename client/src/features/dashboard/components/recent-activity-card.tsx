import { CARD_STYLE } from "../lib/dashboard-visuals";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell } from "lucide-react";
import { format } from "date-fns";

// "Recent Activity" — the current user's notification feed (approvals, decisions, reminders…).
export function RecentActivityCard() {
  const { data: notifications = [] } = useQuery<any[]>({ queryKey: ["/api/notifications"] });
  const items = (notifications as any[]).slice(0, 15);
  return (
    <Card className="border-0 h-[26rem] flex flex-col" style={CARD_STYLE}>
      <CardHeader className="pt-4 pb-2 flex flex-row items-center justify-between gap-1 space-y-0">
        <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 flex-1 min-h-0">
        {items.length === 0 ? (
          <div className="h-full flex items-center justify-center"><p className="text-sm text-muted-foreground">Nothing recent</p></div>
        ) : (
          <ScrollArea className="h-full -mr-2">
            <div className="list-divider pr-2">
              {items.map((n: any) => (
                <div key={n.id} className="flex gap-2.5 py-2.5">
                  <span className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5"><Bell className="h-3.5 w-3.5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-foreground leading-snug">{n.title}</p>
                    {n.body && <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>}
                    {n.createdAt && <p className="text-[10px] text-muted-foreground/80 mt-0.5">{format(new Date(n.createdAt), "d MMM, h:mm a")}</p>}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
