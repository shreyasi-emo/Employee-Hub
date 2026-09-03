import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, getRoleLabel, ALL_ROLES } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { useToast } from "@/hooks/use-toast";
import { Search } from "lucide-react";

// Brand palette only — teal (active), blue (invited/awaiting), coral (suspended), slate (exited).
const statusColors: Record<string, string> = {
  active: "bg-[#4BDCD9]/25 text-[#0E7C7B]",
  invited: "bg-[#206295]/12 text-[#206295]",
  suspended: "bg-[#FF6F62]/20 text-[#C4402F]",
  exited: "bg-muted text-muted-foreground",
};

export function UsersSection() {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: users = [] } = useQuery<any[]>({ queryKey: ["/api/users"] });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // super_admin only offered to a super_admin (the API rejects anyone else assigning it).
  const assignableRoles = ALL_ROLES.filter((r) => r !== "super_admin" || user?.role === "super_admin");

  const updateUser = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PUT", `/api/users/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/users"] }); toast({ title: "User updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (users as any[])
      .map((u) => {
        const emp = (employees as any[]).find((e) => e.id === u.employeeId);
        return { ...u, emp, status: u.accountStatus || (u.isActive ? "active" : "suspended"), _name: emp ? `${emp.firstName} ${emp.lastName}` : "", _email: emp?.email || "" };
      })
      .filter((u) =>
        (roleFilter === "all" || u.role === roleFilter) &&
        (statusFilter === "all" || u.status === statusFilter) &&
        (!q || `${u.username} ${u._name} ${u._email}`.toLowerCase().includes(q)))
      .sort((a, b) => a.username.localeCompare(b.username));
  }, [users, employees, search, roleFilter, statusFilter]);

  const columns: DataTableColumn<any>[] = [
    {
      key: "empno", header: "Emp No.", headClassName: "w-24",
      render: (u) => <span className="text-xs text-muted-foreground tabular-nums">{u.emp?.employeeCode || "—"}</span>,
    },
    {
      key: "user", header: "User",
      render: (u) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar className="h-8 w-8 flex-shrink-0"><AvatarFallback className="text-xs bg-[#206295]/10 text-[#206295]">{u.username.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
          <span className="text-sm font-medium text-foreground inline-flex items-center gap-1.5 truncate">{u.username}{u.id === user?.id && <Badge variant="outline" className="text-[10px] flex-shrink-0">You</Badge>}</span>
        </div>
      ),
    },
    {
      key: "employee", header: "Employee",
      render: (u) => u.emp
        ? <div className="min-w-0"><p className="text-sm text-foreground truncate">{u._name}</p><p className="text-xs text-muted-foreground truncate">{u._email}</p></div>
        : <span className="text-muted-foreground/50">—</span>,
    },
    {
      key: "role", header: "Role",
      render: (u) => (
        <Select value={u.role} onValueChange={(v) => updateUser.mutate({ id: u.id, role: v })} disabled={u.id === user?.id}>
          <SelectTrigger className="w-36 h-8 text-xs" data-testid={`select-role-${u.id}`}><SelectValue /></SelectTrigger>
          <SelectContent>{assignableRoles.map((r) => <SelectItem key={r} value={r} className="text-xs">{getRoleLabel(r as any)}</SelectItem>)}</SelectContent>
        </Select>
      ),
    },
    {
      key: "status", header: "Status",
      render: (u) => <Badge className={`text-xs ${statusColors[u.status] || statusColors.exited}`} data-testid={`badge-status-${u.id}`}><span className="capitalize">{u.status}</span></Badge>,
    },
    {
      key: "actions", header: "", align: "right",
      render: (u) => u.id === user?.id ? <span className="text-muted-foreground/40 text-xs">—</span> : (
        <div className="flex items-center justify-end">
          <Button size="sm" variant={u.isActive ? "outline" : "default"} className="h-7 text-xs px-2.5" onClick={() => updateUser.mutate({ id: u.id, isActive: !u.isActive })} data-testid={`button-toggle-user-${u.id}`}>{u.isActive ? "Disable" : "Enable"}</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Search + role + status filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by username, name or email…" className="pl-9" data-testid="input-search-users" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-44" data-testid="select-role-filter"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Roles</SelectItem>{ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{getRoleLabel(r as any)}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="select-status-filter"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="invited">Invited</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="exited">Exited</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-0"><CardContent className="p-0">
        <DataTable columns={columns} rows={rows} getRowKey={(u) => u.id} emptyText="No users match those filters." testIdPrefix="user-row" />
      </CardContent></Card>
    </div>
  );
}
