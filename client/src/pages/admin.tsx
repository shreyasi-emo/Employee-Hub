import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, isHR, isAdmin, getRoleLabel, ASSIGNABLE_ROLES } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Settings, Building2, Users, DollarSign, Plane, Plus, Edit,
  Save, Shield, ChevronRight, AlertTriangle, Mail, Copy, CheckCircle2,
} from "lucide-react";

function DepartmentSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newDept, setNewDept] = useState({ name: "", code: "" });

  const { data: departments = [] } = useQuery<any[]>({ queryKey: ["/api/departments"] });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/departments", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({ title: "Department created" });
      setShowAdd(false);
      setNewDept({ name: "", code: "" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-dept">
          <Plus className="h-4 w-4 mr-1.5" /> Add Department
        </Button>
      </div>
      {showAdd && (
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3 flex-wrap">
              <Input
                placeholder="Department name"
                value={newDept.name}
                onChange={e => setNewDept(n => ({ ...n, name: e.target.value }))}
                className="flex-1 min-w-32"
                data-testid="input-dept-name"
              />
              <Input
                placeholder="Code (e.g. ENG)"
                value={newDept.code}
                onChange={e => setNewDept(n => ({ ...n, code: e.target.value.toUpperCase() }))}
                className="w-28"
                data-testid="input-dept-code"
              />
              <Button
                size="sm"
                onClick={() => mutation.mutate(newDept)}
                disabled={mutation.isPending || !newDept.name || !newDept.code}
                data-testid="button-save-dept"
              >
                <Save className="h-4 w-4 mr-1.5" /> Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {departments.map((dept: any) => {
          const empCount = employees.filter((e: any) => e.departmentId === dept.id).length;
          return (
            <Card key={dept.id} data-testid={`dept-card-${dept.id}`}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">{dept.name}</p>
                  <p className="text-xs text-muted-foreground">{dept.code} · {empCount} employees</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function DesignationSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newDesig, setNewDesig] = useState({ name: "", grade: "", departmentId: "" });

  const { data: designations = [] } = useQuery<any[]>({ queryKey: ["/api/designations"] });
  const { data: departments = [] } = useQuery<any[]>({ queryKey: ["/api/departments"] });

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/designations", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/designations"] });
      toast({ title: "Designation created" });
      setShowAdd(false);
      setNewDesig({ name: "", grade: "", departmentId: "" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-desig">
          <Plus className="h-4 w-4 mr-1.5" /> Add Designation
        </Button>
      </div>
      {showAdd && (
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3 flex-wrap">
              <Input
                placeholder="Designation name"
                value={newDesig.name}
                onChange={e => setNewDesig(n => ({ ...n, name: e.target.value }))}
                className="flex-1 min-w-32"
                data-testid="input-desig-name"
              />
              <Input
                placeholder="Grade (e.g. L4)"
                value={newDesig.grade}
                onChange={e => setNewDesig(n => ({ ...n, grade: e.target.value }))}
                className="w-28"
              />
              <Select value={newDesig.departmentId} onValueChange={v => setNewDesig(n => ({ ...n, departmentId: v }))}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={() => mutation.mutate(newDesig)}
                disabled={mutation.isPending || !newDesig.name}
                data-testid="button-save-desig"
              >
                <Save className="h-4 w-4 mr-1.5" /> Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {designations.map((d: any) => {
          const dept = departments.find((dept: any) => dept.id === d.departmentId);
          return (
            <Card key={d.id}>
              <CardContent className="p-3 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{d.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.grade && `${d.grade} · `}{dept?.name || "No department"}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function StatutorySection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: configs = [] } = useQuery<any[]>({ queryKey: ["/api/statutory-config"] });
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", "/api/statutory-config", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/statutory-config"] });
      toast({ title: "Config updated" });
      setEditingKey(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-3">
      {configs.map((cfg: any) => (
        <Card key={cfg.key}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{cfg.key.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}</p>
              {cfg.description && <p className="text-xs text-muted-foreground">{cfg.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              {editingKey === cfg.key ? (
                <>
                  <Input
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    className="w-24 h-8 text-sm"
                    data-testid={`input-config-${cfg.key}`}
                  />
                  <Button
                    size="sm"
                    onClick={() => mutation.mutate({ key: cfg.key, value: editValue })}
                    disabled={mutation.isPending}
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingKey(null)}>Cancel</Button>
                </>
              ) : (
                <>
                  <span className="text-sm font-mono text-foreground px-2 py-1 rounded bg-muted">{cfg.value}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => { setEditingKey(cfg.key); setEditValue(cfg.value); }}
                    data-testid={`button-edit-config-${cfg.key}`}
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function LeaveTypesSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: leaveTypes = [] } = useQuery<any[]>({ queryKey: ["/api/leave-types"] });
  const [showAdd, setShowAdd] = useState(false);
  const [newLT, setNewLT] = useState({
    name: "", code: "", color: "#3B82F6", isPaid: true,
    isCarryForward: false, maxDaysPerYear: 12,
  });

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/leave-types", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/leave-types"] });
      toast({ title: "Leave type created" });
      setShowAdd(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-leave-type">
          <Plus className="h-4 w-4 mr-1.5" /> Add Leave Type
        </Button>
      </div>
      {showAdd && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex gap-3 flex-wrap">
              <Input
                placeholder="Leave type name"
                value={newLT.name}
                onChange={e => setNewLT(n => ({ ...n, name: e.target.value }))}
                className="flex-1"
                data-testid="input-leave-type-name"
              />
              <Input
                placeholder="Code (e.g. CL)"
                value={newLT.code}
                onChange={e => setNewLT(n => ({ ...n, code: e.target.value.toUpperCase() }))}
                className="w-24"
              />
              <Input
                type="color"
                value={newLT.color}
                onChange={e => setNewLT(n => ({ ...n, color: e.target.value }))}
                className="w-16 p-1 h-9"
              />
              <Input
                type="number"
                placeholder="Max days/year"
                value={newLT.maxDaysPerYear}
                onChange={e => setNewLT(n => ({ ...n, maxDaysPerYear: parseInt(e.target.value) }))}
                className="w-36"
              />
            </div>
            <div className="flex gap-4 flex-wrap">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={newLT.isPaid} onChange={e => setNewLT(n => ({ ...n, isPaid: e.target.checked }))} />
                Paid
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={newLT.isCarryForward} onChange={e => setNewLT(n => ({ ...n, isCarryForward: e.target.checked }))} />
                Carry Forward
              </label>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => mutation.mutate(newLT)} disabled={mutation.isPending || !newLT.name}>
                Create Leave Type
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="space-y-2">
        {leaveTypes.map((lt: any) => (
          <Card key={lt.id}>
            <CardContent className="p-3 flex items-center gap-3">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: lt.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-foreground">{lt.name}</p>
                  <Badge variant="outline" className="text-xs">{lt.code}</Badge>
                  {lt.isPaid && <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs">Paid</Badge>}
                  {lt.isCarryForward && <Badge variant="secondary" className="text-xs">Carry Forward</Badge>}
                  {lt.isEncashable && <Badge variant="secondary" className="text-xs">Encashable</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">Max {lt.maxDaysPerYear} days/year</p>
              </div>
              {lt.isActive ? (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs">Active</Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-700 text-xs">Inactive</Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function UsersSection() {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: users = [] } = useQuery<any[]>({ queryKey: ["/api/users"] });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const [inviteLinks, setInviteLinks] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
                      {ASSIGNABLE_ROLES.map(r => (
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

export default function AdminPage() {
  const { data: auth } = useAuth();
  const user = auth?.user;

  if (!isHR(user!)) {
    return (
      <div className="p-6 text-center">
        <Shield className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
        <h2 className="text-lg font-semibold">Access Denied</h2>
        <p className="text-sm text-muted-foreground mt-1">You don't have permission to view this page</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Settings</h1>
        <p className="text-sm text-muted-foreground">Configure organization structure and policies</p>
      </div>

      <Tabs defaultValue="departments">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="departments" data-testid="tab-departments">Departments</TabsTrigger>
          <TabsTrigger value="designations" data-testid="tab-designations">Designations</TabsTrigger>
          <TabsTrigger value="leave-types" data-testid="tab-leave-types">Leave Types</TabsTrigger>
          {isAdmin(user!) && (
            <>
              <TabsTrigger value="statutory" data-testid="tab-statutory">Statutory Config</TabsTrigger>
              <TabsTrigger value="users" data-testid="tab-users">Users & Access</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="departments" className="mt-4">
          <DepartmentSection />
        </TabsContent>
        <TabsContent value="designations" className="mt-4">
          <DesignationSection />
        </TabsContent>
        <TabsContent value="leave-types" className="mt-4">
          <LeaveTypesSection />
        </TabsContent>
        {isAdmin(user!) && (
          <>
            <TabsContent value="statutory" className="mt-4">
              <StatutorySection />
            </TabsContent>
            <TabsContent value="users" className="mt-4">
              <UsersSection />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
