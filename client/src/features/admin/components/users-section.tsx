import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, getRoleLabel, ALL_ROLES } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Mail, Copy, CheckCircle2 } from "lucide-react";

export function UsersSection() {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: users = [] } = useQuery<any[]>({ queryKey: ["/api/users"] });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const [inviteLinks, setInviteLinks] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Assignable roles — full set from the shared list; super_admin only offered to a super_admin
  // (the API rejects anyone else assigning it, so don't dangle an option that 403s). Mirrors the
  // employee form's role picker so both surfaces can grant every role, logistics included.
  const assignableRoles = ALL_ROLES.filter((r) => r !== "super_admin" || user?.role === "super_admin");

  const updateUser = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PUT", `/api/users/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const sendInvite = useMutation({
    mutationFn: (userId: string) => apiRequest("POST", "/api/auth/invite", { userId }),
    onSuccess: (data: any, userId: string) => {
      const fullUrl = `${window.location.origin}${data.inviteUrl}`;
      setInviteLinks(prev => ({ ...prev, [userId]: fullUrl }));
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Invite link generated", description: "Copy and share with the user." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const copyLink = (userId: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(userId);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Link copied to clipboard" });
  };

  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    invited: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    suspended: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    exited: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  };

  return (
    <div className="space-y-3">
      {users.map((u: any) => {
        const emp = employees.find((e: any) => e.id === u.employeeId);
        const isSelf = u.id === user?.id;
        const inviteUrl = inviteLinks[u.id];
        const status = u.accountStatus || (u.isActive ? "active" : "suspended");
        return (
          <Card key={u.id} data-testid={`user-row-${u.id}`}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {u.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground">{u.username}</p>
                    {isSelf && <Badge variant="outline" className="text-xs">You</Badge>}
                    <Badge className={`text-xs ${statusColors[status]}`} data-testid={`badge-status-${u.id}`}>{status}</Badge>
                  </div>
                  {emp && <p className="text-xs text-muted-foreground">{emp.firstName} {emp.lastName} · {emp.email}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={u.role}
                    onValueChange={v => updateUser.mutate({ id: u.id, role: v })}
                    disabled={isSelf}
                  >
                    <SelectTrigger className="w-36 h-8 text-xs" data-testid={`select-role-${u.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {assignableRoles.map(r => (
                        <SelectItem key={r} value={r} className="text-xs">{getRoleLabel(r as any)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!isSelf && (
                    <>
                      <Button
                        size="sm"
                        variant={u.isActive ? "outline" : "default"}
                        className="h-7 text-xs px-2"
                        onClick={() => updateUser.mutate({ id: u.id, isActive: !u.isActive })}
                        data-testid={`button-toggle-user-${u.id}`}
                      >
                        {u.isActive ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-2"
                        onClick={() => sendInvite.mutate(u.id)}
                        disabled={sendInvite.isPending}
                        data-testid={`button-invite-user-${u.id}`}
                        title="Generate invite link"
                      >
                        <Mail className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {inviteUrl && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-muted/60 border border-border">
                  <p className="text-xs font-mono flex-1 truncate text-muted-foreground" data-testid={`text-invite-link-${u.id}`}>{inviteUrl}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 flex-shrink-0"
                    onClick={() => copyLink(u.id, inviteUrl)}
                    data-testid={`button-copy-invite-${u.id}`}
                  >
                    {copiedId === u.id ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
