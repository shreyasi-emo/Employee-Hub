import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { notifAvatarColor, notifVisual, notifEmployeeName } from "../lib/notification-visuals";

export function NotificationBell() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);

  const { data: notifs = [] } = useQuery<any[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 15000,
  });

  const unread = notifs.filter((n: any) => !n.readAt).length;

  const markRead = useMutation({
    mutationFn: (id: string) => apiRequest("PUT", `/api/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const markAll = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/notifications/read-all"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="btn-glass relative h-10 w-10 rounded-[16px] flex items-center justify-center text-muted-foreground hover:text-muted-foreground" data-testid="button-notifications">
          <Bell style={{ width: 22, height: 22 }} />
          {unread > 0 && (
            <Badge className="no-default-hover-elevate !absolute -bottom-1 -right-1 h-[18px] min-w-[18px] px-1 rounded-full text-[10px] leading-none flex items-center justify-center bg-destructive text-destructive-foreground border-2 border-background shadow-sm" data-testid="badge-notification-count">
              {unread > 9 ? "9+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[368px] p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h4 className="text-sm font-semibold">Notifications</h4>
          {unread > 0 && (
            <button
              onClick={() => markAll.mutate()}
              className="text-xs text-[#206295] hover:underline flex items-center gap-1"
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="h-3 w-3" /> Mark all read
            </button>
          )}
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {notifs.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No notifications
            </div>
          ) : (
            <div className="list-divider">
              {notifs.map((n: any) => {
                const v = notifVisual(n.type);
                const empName = notifEmployeeName(n);
                const Icon = v.icon;
                const ac = empName ? notifAvatarColor(empName) : "";
                return (
                <div
                  key={n.id}
                  title={[n.title, n.body].filter(Boolean).join("\n")}
                  className={`group relative flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/40 ${!n.readAt ? "bg-[#206295]/[0.04]" : ""}`}
                  onClick={() => {
                    if (!n.readAt) markRead.mutate(n.id);
                    setOpen(false);
                    if (n.link) navigate(n.link);
                  }}
                  data-testid={`notification-${n.id}`}
                >
                  {empName ? (
                    <Avatar className="h-9 w-9 flex-shrink-0">
                      <AvatarFallback className="text-xs font-semibold" style={{ backgroundColor: `${ac}26`, color: ac }}>
                        {empName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${v.cls}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-sm font-semibold text-foreground leading-snug">{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 group-hover:line-clamp-none leading-snug">{n.body}</p>}
                    <p className="text-[11px] text-muted-foreground/70 mt-1">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  {!n.readAt && <span className="absolute top-3 right-4 h-2 w-2 rounded-full bg-[#206295]" />}
                </div>
                ); })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
