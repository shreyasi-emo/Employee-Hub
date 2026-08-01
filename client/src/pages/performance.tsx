import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, isHR, isAdmin } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/datetime-field";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Target, TrendingUp, BarChart3, Settings2, Users, Plus, Edit, CheckCircle2,
  AlertTriangle, Clock, XCircle, ChevronDown, ChevronUp, RefreshCw, Lock,
  Unlock, Star, Filter,
} from "lucide-react";
import { format } from "date-fns";

// ---- Helpers ----
const GOAL_CATEGORIES = ["business", "technical", "operations", "people", "culture"];
const METRIC_TYPES = ["output", "outcome", "activity", "okr"];
const GOAL_STATUSES: Record<string, { label: string; color: string; icon: any }> = {
  not_started: { label: "Not Started", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", icon: Clock },
  on_track: { label: "On Track", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", icon: CheckCircle2 },
  at_risk: { label: "At Risk", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300", icon: AlertTriangle },
  off_track: { label: "Off Track", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", icon: XCircle },
  completed: { label: "Completed", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", icon: CheckCircle2 },
};
const CYCLE_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  locked: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  archived: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};
const REVIEW_STATUS_COLORS: Record<string, string> = {
  not_started: "bg-gray-100 text-gray-600",
  self_submitted: "bg-blue-100 text-blue-700",
  manager_submitted: "bg-purple-100 text-purple-700",
  hr_locked: "bg-orange-100 text-orange-700",
  finalized: "bg-green-100 text-green-700",
};

function statusBadge(status: string, map: Record<string, string>) {
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] || "bg-gray-100 text-gray-600"}`}>{status?.replace(/_/g, " ")}</span>;
}

// ---- Goal Dialog ----
function GoalDialog({ open, onClose, cycleId, goal, employees }: {
  open: boolean; onClose: () => void; cycleId: string; goal?: any; employees: any[];
}) {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!goal;

  const [form, setForm] = useState({
    title: goal?.title || "",
    description: goal?.description || "",
    category: goal?.category || "business",
    metricType: goal?.metricType || "output",
    targetValue: goal?.targetValue || "",
    unit: goal?.unit || "",
    weight: goal?.weight?.toString() || "0",
    dueDate: goal?.dueDate || "",
    status: goal?.status || "not_started",
    employeeId: goal?.employeeId || user?.employeeId || "",
  });

  const mutation = useMutation({
    mutationFn: (data: any) => isEdit
      ? apiRequest("PATCH", `/api/performance/goals/${goal.id}`, data)
      : apiRequest("POST", "/api/performance/goals", { ...data, cycleId }),
    onSuccess: () => {
      qc.invalidateQueries({ predicate: q => (q.queryKey[0] as string)?.startsWith("/api/performance/goals") });
      toast({ title: isEdit ? "Goal updated" : "Goal created" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = () => {
    const data: any = { ...form, weight: parseInt(form.weight) || 0 };
    if (!data.dueDate) delete data.dueDate;
    if (!data.startDate) delete data.startDate;
    mutation.mutate(data);
  };

  const canAssignToOthers = isHR(user!) || user?.role === "manager";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Goal" : "New Goal"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {canAssignToOthers && !isEdit && (
            <div>
              <Label>Assign To</Label>
              <Select value={form.employeeId} onValueChange={v => setForm(f => ({ ...f, employeeId: v }))}>
                <SelectTrigger data-testid="select-goal-employee"><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Title *</Label>
            <Input data-testid="input-goal-title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Goal title" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea data-testid="input-goal-description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Describe the goal..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger data-testid="select-goal-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GOAL_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Metric Type</Label>
              <Select value={form.metricType} onValueChange={v => setForm(f => ({ ...f, metricType: v }))}>
                <SelectTrigger data-testid="select-goal-metric"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METRIC_TYPES.map(m => <SelectItem key={m} value={m}>{m.toUpperCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Target Value</Label>
              <Input data-testid="input-goal-target" value={form.targetValue} onChange={e => setForm(f => ({ ...f, targetValue: e.target.value }))} placeholder="e.g. 100" />
            </div>
            <div>
              <Label>Unit</Label>
              <Input data-testid="input-goal-unit" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="e.g. %, INR" />
            </div>
            <div>
              <Label>Weight (%)</Label>
              <Input data-testid="input-goal-weight" type="number" min="0" max="100" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Due Date</Label>
              <DateInput testId="input-goal-due" value={form.dueDate} onChange={v => setForm(f => ({ ...f, dueDate: v }))} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger data-testid="select-goal-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(GOAL_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending || !form.title} data-testid="button-save-goal">
            {mutation.isPending ? "Saving..." : isEdit ? "Update Goal" : "Create Goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Progress Dialog ----
function ProgressDialog({ open, onClose, goal }: { open: boolean; onClose: () => void; goal: any }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ progressValue: "", note: "" });

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/performance/goals/${goal.id}/progress`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/performance/goals/${goal.id}/progress`] });
      qc.invalidateQueries({ predicate: q => (q.queryKey[0] as string)?.startsWith("/api/performance/goals") });
      toast({ title: "Progress recorded" });
      onClose();
    },
  });

  const { data: history = [] } = useQuery<any[]>({
    queryKey: [`/api/performance/goals/${goal?.id}/progress`],
    enabled: open && !!goal?.id,
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Update Progress — {goal?.title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Current Value</Label>
            <Input data-testid="input-progress-value" value={form.progressValue} onChange={e => setForm(f => ({ ...f, progressValue: e.target.value }))} placeholder={`Target: ${goal?.targetValue} ${goal?.unit || ""}`} />
          </div>
          <div>
            <Label>Note</Label>
            <Textarea data-testid="input-progress-note" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2} placeholder="Add a note..." />
          </div>
          {history.length > 0 && (
            <div>
              <Label>History</Label>
              <div className="mt-1 space-y-1 max-h-32 overflow-y-auto">
                {history.slice(0, 5).map((h: any) => (
                  <div key={h.id} className="text-xs text-muted-foreground flex justify-between border-b pb-1">
                    <span>{h.progressValue} {goal?.unit}</span>
                    <span>{h.note}</span>
                    <span>{format(new Date(h.createdAt), "dd MMM")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate(form)} disabled={mutation.isPending || !form.progressValue} data-testid="button-submit-progress">
            {mutation.isPending ? "Saving..." : "Record Progress"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Goal Card ----
function GoalCard({ goal, onEdit, onProgress, onApprove, canManage }: {
  goal: any; onEdit: () => void; onProgress: () => void; onApprove: () => void; canManage: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const statusInfo = GOAL_STATUSES[goal.status] || GOAL_STATUSES.not_started;
  const StatusIcon = statusInfo.icon;

  return (
    <Card className="group" data-testid={`card-goal-${goal.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm text-foreground truncate">{goal.title}</span>
              <Badge variant="outline" className="text-xs">{goal.category}</Badge>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${statusInfo.color}`}>
                <StatusIcon className="h-3 w-3" />{statusInfo.label}
              </span>
              {goal.isApproved && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">Approved</span>}
              {goal.isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
            </div>
            <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground flex-wrap">
              <span>Weight: <strong>{goal.weight}%</strong></span>
              {goal.targetValue && <span>Target: <strong>{goal.targetValue} {goal.unit}</strong></span>}
              {goal.dueDate && <span>Due: <strong>{format(new Date(goal.dueDate), "dd MMM yyyy")}</strong></span>}
              <span className="capitalize">{goal.metricType}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(e => !e)} data-testid={`button-expand-goal-${goal.id}`}>
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onProgress} title="Update progress" data-testid={`button-progress-${goal.id}`}>
              <TrendingUp className="h-3.5 w-3.5" />
            </Button>
            {canManage && !goal.isLocked && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} data-testid={`button-edit-goal-${goal.id}`}>
                <Edit className="h-3.5 w-3.5" />
              </Button>
            )}
            {canManage && !goal.isApproved && !goal.isLocked && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={onApprove} title="Approve goal" data-testid={`button-approve-goal-${goal.id}`}>
                <CheckCircle2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
        {expanded && goal.description && (
          <p className="mt-2 text-sm text-muted-foreground border-t pt-2">{goal.description}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ---- My Goals Tab ----
function MyGoalsTab({ cycleId, employees }: { cycleId: string; employees: any[] }) {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editGoal, setEditGoal] = useState<any>(null);
  const [progressGoal, setProgressGoal] = useState<any>(null);

  const queryKey = `/api/performance/goals?cycleId=${cycleId}&employeeId=${user?.employeeId || ""}`;
  const { data: myGoals = [], isLoading } = useQuery<any[]>({ queryKey: [queryKey] });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/performance/goals/${id}`, { isApproved: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [queryKey] }); toast({ title: "Goal approved" }); },
  });

  const totalWeight = myGoals.reduce((s, g) => s + (g.weight || 0), 0);

  if (isLoading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{myGoals.length} goals</span>
          <span className={`text-sm font-medium ${totalWeight === 100 ? "text-green-600" : "text-yellow-600"}`}>
            Total weight: {totalWeight}%
          </span>
        </div>
        {!isLoading && (
          <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-add-goal">
            <Plus className="h-4 w-4 mr-1" /> Add Goal
          </Button>
        )}
      </div>

      {myGoals.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Target className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No goals yet for this cycle.</p>
          <Button className="mt-3" size="sm" onClick={() => setShowCreate(true)}>Set your first goal</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {myGoals.map(g => (
            <GoalCard
              key={g.id}
              goal={g}
              onEdit={() => setEditGoal(g)}
              onProgress={() => setProgressGoal(g)}
              onApprove={() => approveMutation.mutate(g.id)}
              canManage={isHR(user!) || user?.role === "manager"}
            />
          ))}
        </div>
      )}

      {showCreate && <GoalDialog open cycleId={cycleId} employees={employees} onClose={() => setShowCreate(false)} />}
      {editGoal && <GoalDialog open cycleId={cycleId} goal={editGoal} employees={employees} onClose={() => setEditGoal(null)} />}
      {progressGoal && <ProgressDialog open goal={progressGoal} onClose={() => setProgressGoal(null)} />}
    </div>
  );
}

// ---- Team Goals Tab ----
function TeamGoalsTab({ cycleId, employees }: { cycleId: string; employees: any[] }) {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filterEmp, setFilterEmp] = useState("all");
  const [editGoal, setEditGoal] = useState<any>(null);
  const [progressGoal, setProgressGoal] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);

  const queryKey = `/api/performance/goals?cycleId=${cycleId}`;
  const { data: allGoals = [], isLoading } = useQuery<any[]>({ queryKey: [queryKey] });

  const filtered = filterEmp === "all" ? allGoals : allGoals.filter(g => g.employeeId === filterEmp);

  const grouped = filtered.reduce((acc: Record<string, any[]>, g) => {
    if (!acc[g.employeeId]) acc[g.employeeId] = [];
    acc[g.employeeId].push(g);
    return acc;
  }, {});

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/performance/goals/${id}`, { isApproved: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [queryKey] }); toast({ title: "Goal approved" }); },
  });

  if (isLoading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterEmp} onValueChange={setFilterEmp}>
            <SelectTrigger className="w-48 h-8 text-xs" data-testid="select-team-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">{filtered.length} goals</span>
        </div>
        {isHR(user!) && (
          <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-assign-goal">
            <Plus className="h-4 w-4 mr-1" /> Assign Goal
          </Button>
        )}
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No goals found for the selected filter.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([empId, empGoals]) => {
          const emp = employees.find(e => e.id === empId);
          const totalWeight = empGoals.reduce((s, g) => s + (g.weight || 0), 0);
          return (
            <div key={empId} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {emp ? `${emp.firstName} ${emp.lastName}` : "Unknown"}
                </span>
                <span className={`text-xs ${totalWeight === 100 ? "text-green-600" : "text-yellow-600"}`}>
                  ({totalWeight}% weight)
                </span>
                <span className="text-xs text-muted-foreground">{empGoals.length} goals</span>
              </div>
              {empGoals.map(g => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  onEdit={() => setEditGoal(g)}
                  onProgress={() => setProgressGoal(g)}
                  onApprove={() => approveMutation.mutate(g.id)}
                  canManage={isHR(user!) || user?.role === "manager"}
                />
              ))}
            </div>
          );
        })
      )}
      {showCreate && <GoalDialog open cycleId={cycleId} employees={employees} onClose={() => setShowCreate(false)} />}
      {editGoal && <GoalDialog open cycleId={cycleId} goal={editGoal} employees={employees} onClose={() => setEditGoal(null)} />}
      {progressGoal && <ProgressDialog open goal={progressGoal} onClose={() => setProgressGoal(null)} />}
    </div>
  );
}

// ---- Review Form Tab ----
function ReviewsTab({ cycleId, cycle, employees }: { cycleId: string; cycle: any; employees: any[] }) {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedEmpId, setSelectedEmpId] = useState(user?.employeeId || "");
  const [selfForm, setSelfForm] = useState({ summary: "", rating: "", goalComments: "" });
  const [managerForm, setManagerForm] = useState({ summary: "", rating: "", goalComments: "", recommendedActions: "" });
  const [showUnlock, setShowUnlock] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");

  const reviewKey = `/api/performance/reviews/${cycleId}/${selectedEmpId}`;
  const { data: review, isLoading: reviewLoading } = useQuery<any>({
    queryKey: [reviewKey],
    enabled: !!selectedEmpId && !!cycleId,
  });

  const submitMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/performance/reviews/${cycleId}/${selectedEmpId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [reviewKey] });
      toast({ title: "Review saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isLocked = review?.status === "hr_locked" || review?.status === "finalized";
  const isMine = user?.employeeId === selectedEmpId;
  const canDoManagerReview = (isHR(user!) || user?.role === "manager") && cycle?.managerReviewEnabled;
  const canLock = isHR(user!);
  const canSelf = isMine && cycle?.selfReviewEnabled;

  const ratingOptions = ["1", "2", "3", "4", "5"];

  return (
    <div className="space-y-4">
      {(isHR(user!) || user?.role === "manager") && (
        <div className="flex items-center gap-2">
          <Label className="text-sm shrink-0">Reviewing:</Label>
          <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
            <SelectTrigger className="w-60" data-testid="select-review-employee"><SelectValue placeholder="Select employee" /></SelectTrigger>
            <SelectContent>
              {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {!selectedEmpId ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Select an employee to view their review</div>
      ) : reviewLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            {statusBadge(review?.status || "not_started", REVIEW_STATUS_COLORS)}
            {isLocked && canLock && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowUnlock(true)} data-testid="button-unlock-review">
                <Unlock className="h-3 w-3 mr-1" /> Unlock
              </Button>
            )}
          </div>

          {/* Self Review */}
          {cycle?.selfReviewEnabled && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500" /> Self Review
                  {review?.selfReview && <span className="text-xs text-green-600 font-normal">Submitted</span>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Summary</Label>
                  <Textarea
                    data-testid="input-self-summary"
                    rows={3}
                    defaultValue={review?.selfReview?.summary || ""}
                    onChange={e => setSelfForm(f => ({ ...f, summary: e.target.value }))}
                    disabled={isLocked && !canLock}
                    placeholder="Summarize your achievements this cycle..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Self Rating (1-5)</Label>
                    <Select defaultValue={review?.selfReview?.rating || ""} onValueChange={v => setSelfForm(f => ({ ...f, rating: v }))}>
                      <SelectTrigger data-testid="select-self-rating"><SelectValue placeholder="Select rating" /></SelectTrigger>
                      <SelectContent>
                        {ratingOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Goal Comments</Label>
                    <Input
                      data-testid="input-self-goal-comments"
                      defaultValue={review?.selfReview?.goalComments || ""}
                      onChange={e => setSelfForm(f => ({ ...f, goalComments: e.target.value }))}
                      disabled={isLocked && !canLock}
                      placeholder="Comments on goal progress..."
                    />
                  </div>
                </div>
                {(canSelf || (isAdmin(user!) && isLocked)) && (
                  <Button size="sm" onClick={() => submitMutation.mutate({ selfReview: { ...selfForm, submittedAt: new Date() } })} disabled={submitMutation.isPending} data-testid="button-submit-self-review">
                    {submitMutation.isPending ? "Saving..." : "Submit Self Review"}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Manager Review */}
          {cycle?.managerReviewEnabled && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" /> Manager Review
                  {review?.managerReview && <span className="text-xs text-green-600 font-normal">Submitted</span>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Summary</Label>
                  <Textarea
                    data-testid="input-manager-summary"
                    rows={3}
                    defaultValue={review?.managerReview?.summary || ""}
                    onChange={e => setManagerForm(f => ({ ...f, summary: e.target.value }))}
                    disabled={isLocked && !canLock}
                    placeholder="Manager's overall assessment..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Rating (1-5)</Label>
                    <Select defaultValue={review?.managerReview?.rating || ""} onValueChange={v => setManagerForm(f => ({ ...f, rating: v }))}>
                      <SelectTrigger data-testid="select-manager-rating"><SelectValue placeholder="Select rating" /></SelectTrigger>
                      <SelectContent>
                        {ratingOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Recommended Actions</Label>
                    <Input
                      data-testid="input-manager-actions"
                      defaultValue={review?.managerReview?.recommendedActions || ""}
                      onChange={e => setManagerForm(f => ({ ...f, recommendedActions: e.target.value }))}
                      disabled={isLocked && !canLock}
                      placeholder="e.g. Promotion, Training..."
                    />
                  </div>
                </div>
                {canDoManagerReview && (
                  <Button size="sm" onClick={() => submitMutation.mutate({ managerReview: { ...managerForm, submittedAt: new Date() } })} disabled={submitMutation.isPending} data-testid="button-submit-manager-review">
                    {submitMutation.isPending ? "Saving..." : "Submit Manager Review"}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Final Outcome (HR) */}
          {canLock && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Lock className="h-4 w-4 text-orange-500" /> Final Outcome (HR)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Final Rating</Label>
                    <Select defaultValue={review?.finalOutcome?.finalRating || ""} onValueChange={v => {}}>
                      <SelectTrigger data-testid="select-final-rating"><SelectValue placeholder="Final rating" /></SelectTrigger>
                      <SelectContent>
                        {ratingOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Promotion Flag</Label>
                    <Select defaultValue={review?.finalOutcome?.promotionRecommendation || "no"} onValueChange={v => {}}>
                      <SelectTrigger data-testid="select-promotion"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="consider">Consider</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Compensation Flag</Label>
                    <Select defaultValue={review?.finalOutcome?.compensationFlag || "no"} onValueChange={v => {}}>
                      <SelectTrigger data-testid="select-compensation"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => submitMutation.mutate({ status: "hr_locked" })} disabled={submitMutation.isPending} data-testid="button-lock-review">
                    <Lock className="h-3.5 w-3.5 mr-1" /> Lock Review
                  </Button>
                  <Button size="sm" onClick={() => submitMutation.mutate({ status: "finalized" })} disabled={submitMutation.isPending} data-testid="button-finalize-review">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Finalize
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Unlock Dialog */}
      <Dialog open={showUnlock} onOpenChange={setShowUnlock}>
        <DialogContent>
          <DialogHeader><DialogTitle>Unlock Review</DialogTitle></DialogHeader>
          <div>
            <Label>Reason for unlocking *</Label>
            <Textarea data-testid="input-unlock-reason" value={unlockReason} onChange={e => setUnlockReason(e.target.value)} rows={2} placeholder="State reason for unlocking..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnlock(false)}>Cancel</Button>
            <Button onClick={() => {
              submitMutation.mutate({ status: "manager_submitted", unlock: true, reason: unlockReason });
              setShowUnlock(false);
            }} disabled={!unlockReason} data-testid="button-confirm-unlock">Unlock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Cycles Tab (HR) ----
function CyclesTab({ onSelectCycle }: { onSelectCycle: (id: string) => void }) {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "", selfReviewEnabled: true, managerReviewEnabled: true, calibrationEnabled: false, goalWeightEnforced: false });

  const { data: cycles = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/performance/cycles"] });
  const { data: ratingScales = [] } = useQuery<any[]>({ queryKey: ["/api/performance/rating-scales"] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/performance/cycles", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/performance/cycles"] });
      toast({ title: "Cycle created" });
      setShowCreate(false);
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/performance/cycles/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/performance/cycles"] }),
  });

  const statusTransitions: Record<string, string[]> = {
    draft: ["active"],
    active: ["locked"],
    locked: ["archived"],
    archived: [],
  };

  if (isLoading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{cycles.length} cycles</span>
        {isHR(user!) && (
          <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-create-cycle">
            <Plus className="h-4 w-4 mr-1" /> New Cycle
          </Button>
        )}
      </div>

      {cycles.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Settings2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No performance cycles yet.</p>
          {isHR(user!) && <Button size="sm" className="mt-3" onClick={() => setShowCreate(true)}>Create First Cycle</Button>}
        </div>
      ) : (
        <div className="space-y-3">
          {cycles.map(c => (
            <Card key={c.id} className="cursor-pointer hover:shadow-md transition-shadow" data-testid={`card-cycle-${c.id}`} onClick={() => onSelectCycle(c.id)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{c.name}</span>
                    {statusBadge(c.status, CYCLE_STATUS_COLORS)}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span>{format(new Date(c.startDate), "dd MMM yyyy")} → {format(new Date(c.endDate), "dd MMM yyyy")}</span>
                    <span>{c.selfReviewEnabled ? "Self ✓" : ""} {c.managerReviewEnabled ? "Manager ✓" : ""} {c.calibrationEnabled ? "Calibration ✓" : ""}</span>
                  </div>
                </div>
                {isHR(user!) && (
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    {(statusTransitions[c.status] || []).map(nextStatus => (
                      <Button
                        key={nextStatus}
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs capitalize"
                        onClick={() => updateStatus.mutate({ id: c.id, status: nextStatus })}
                        data-testid={`button-cycle-${nextStatus}`}
                      >
                        {nextStatus === "active" ? <><RefreshCw className="h-3 w-3 mr-1" />Activate</> : nextStatus === "locked" ? <><Lock className="h-3 w-3 mr-1" />Lock</> : <><CheckCircle2 className="h-3 w-3 mr-1" />Archive</>}
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create Performance Cycle</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Cycle Name *</Label>
              <Input data-testid="input-cycle-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. H1 2026" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date *</Label>
                <DateInput testId="input-cycle-start" value={form.startDate} onChange={v => setForm(f => ({ ...f, startDate: v }))} />
              </div>
              <div>
                <Label>End Date *</Label>
                <DateInput testId="input-cycle-end" value={form.endDate} onChange={v => setForm(f => ({ ...f, endDate: v }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Features</Label>
              {[
                { key: "selfReviewEnabled", label: "Self Review" },
                { key: "managerReviewEnabled", label: "Manager Review" },
                { key: "calibrationEnabled", label: "Calibration" },
                { key: "goalWeightEnforced", label: "Enforce Goal Weights (sum=100%)" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                    data-testid={`checkbox-${key}`}
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending || !form.name || !form.startDate || !form.endDate} data-testid="button-confirm-create-cycle">
              {createMutation.isPending ? "Creating..." : "Create Cycle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Calibration Tab ----
function CalibrationTab({ cycleId, employees }: { cycleId: string; employees: any[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedDept, setSelectedDept] = useState("all");

  const { data: sessions = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/performance/calibration/${cycleId}`],
    enabled: !!cycleId,
  });
  const { data: allReviews = [] } = useQuery<any[]>({
    queryKey: [`/api/performance/reviews/${cycleId}`],
    enabled: !!cycleId,
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/performance/calibration/${cycleId}`, { participants: [], adjustments: [] }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/performance/calibration/${cycleId}`] }),
  });

  const lockMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/performance/calibration/${id}`, { status: "locked" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/performance/calibration/${cycleId}`] });
      toast({ title: "Calibration session locked" });
    },
  });

  // Rating distribution from reviews
  const dist = allReviews.reduce((acc: Record<string, number>, r: any) => {
    const rating = r.finalOutcome?.finalRating || r.managerReview?.rating;
    if (rating) acc[rating] = (acc[rating] || 0) + 1;
    return acc;
  }, {});

  const maxCount = Math.max(...Object.values(dist), 1);

  return (
    <div className="space-y-4">
      {/* Rating Distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Rating Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(dist).length === 0 ? (
            <p className="text-sm text-muted-foreground">No manager reviews submitted yet.</p>
          ) : (
            <div className="space-y-2">
              {["1", "2", "3", "4", "5"].map(rating => {
                const count = dist[rating] || 0;
                const pct = Math.round((count / (allReviews.length || 1)) * 100);
                return (
                  <div key={rating} className="flex items-center gap-3">
                    <span className="text-xs w-16 text-muted-foreground">Rating {rating}</span>
                    <Progress value={(count / maxCount) * 100} className="h-3 flex-1" />
                    <span className="text-xs w-16 text-right">{count} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-Employee Adjustments */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Calibration Sessions</span>
        <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending} data-testid="button-new-calibration">
          <Plus className="h-4 w-4 mr-1" /> New Session
        </Button>
      </div>

      {isLoading ? <Skeleton className="h-32 w-full" /> : sessions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">No calibration sessions yet. Create one to start adjusting ratings.</div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => (
            <Card key={s.id} data-testid={`card-calibration-${s.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Session</span>
                      {statusBadge(s.status, { open: "bg-green-100 text-green-700", locked: "bg-orange-100 text-orange-700" })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(s.adjustments as any[])?.length || 0} adjustments
                    </p>
                  </div>
                  {s.status === "open" && (
                    <Button size="sm" variant="outline" onClick={() => lockMutation.mutate(s.id)} disabled={lockMutation.isPending} data-testid={`button-lock-calibration-${s.id}`}>
                      <Lock className="h-3.5 w-3.5 mr-1" /> Lock Session
                    </Button>
                  )}
                </div>
                {/* Show employees with their current vs proposed ratings */}
                <div className="mt-3 space-y-1">
                  {allReviews.slice(0, 5).map((r: any) => {
                    const emp = employees.find(e => e.id === r.employeeId);
                    const currentRating = r.managerReview?.rating || "—";
                    return (
                      <div key={r.id} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                        <span>{emp ? `${emp.firstName} ${emp.lastName}` : "Unknown"}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Manager: {currentRating}</span>
                          {r.finalOutcome?.finalRating && <span className="font-medium text-green-600">Final: {r.finalOutcome.finalRating}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Reports Tab ----
function ReportsTab({ cycleId }: { cycleId: string }) {
  const { data: report, isLoading } = useQuery<any>({
    queryKey: [`/api/performance/reports/distribution/${cycleId}`],
    enabled: !!cycleId,
  });

  if (isLoading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  const stats = report?.goalStats;
  const dist = report?.ratingDistribution || {};
  const maxCount = Math.max(...Object.values(dist) as number[], 1);

  return (
    <div className="space-y-4">
      {/* Goal Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Goals", value: stats?.total || 0, icon: Target, color: "text-blue-500" },
          { label: "Completed", value: stats?.completed || 0, icon: CheckCircle2, color: "text-green-500" },
          { label: "On Track", value: stats?.onTrack || 0, icon: TrendingUp, color: "text-emerald-500" },
          { label: "At Risk / Off Track", value: (stats?.atRisk || 0) + (stats?.offTrack || 0), icon: AlertTriangle, color: "text-red-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`h-6 w-6 ${color}`} />
              <div>
                <p className="text-xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Rating Distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Final Rating Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(dist).length === 0 ? (
            <p className="text-sm text-muted-foreground">No finalized reviews yet.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(dist).map(([rating, count]: [string, any]) => (
                <div key={rating} className="flex items-center gap-3">
                  <span className="text-xs w-16 text-muted-foreground">Rating {rating}</span>
                  <Progress value={(count / maxCount) * 100} className="h-3 flex-1" />
                  <span className="text-xs w-8 text-right">{count}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            <strong>{report?.totalReviews || 0}</strong> reviews in this cycle.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---- Main Page ----
export default function PerformancePage() {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const [selectedCycleId, setSelectedCycleId] = useState<string>("");
  const [activeTab, setActiveTab] = useState("my-goals");

  const { data: cycles = [], isLoading: cyclesLoading } = useQuery<any[]>({ queryKey: ["/api/performance/cycles"] });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });

  const activeCycles = cycles.filter(c => c.status === "active");
  const effectiveCycleId = selectedCycleId || activeCycles[0]?.id || cycles[0]?.id || "";
  const selectedCycle = cycles.find(c => c.id === effectiveCycleId);

  const hrTabs = ["cycles", "reports", "calibration"];
  const allTabs = isHR(user!)
    ? ["my-goals", "team-goals", "reviews", "cycles", "calibration", "reports"]
    : user?.role === "manager"
    ? ["my-goals", "team-goals", "reviews"]
    : ["my-goals", "reviews"];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Performance</h1>
          <p className="text-sm text-muted-foreground">Manage KPIs, reviews, and performance cycles</p>
        </div>
        {cycles.length > 0 && (
          <Select value={effectiveCycleId} onValueChange={setSelectedCycleId}>
            <SelectTrigger className="w-48" data-testid="select-cycle">
              <SelectValue placeholder="Select cycle" />
            </SelectTrigger>
            <SelectContent>
              {cycles.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} ({c.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {cyclesLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto gap-1" data-testid="performance-tabs">
            {allTabs.map(tab => (
              <TabsTrigger key={tab} value={tab} className="text-xs capitalize" data-testid={`tab-${tab}`}>
                {tab === "my-goals" ? <><Target className="h-3.5 w-3.5 mr-1" />My Goals</> :
                 tab === "team-goals" ? <><Users className="h-3.5 w-3.5 mr-1" />Team Goals</> :
                 tab === "reviews" ? <><Star className="h-3.5 w-3.5 mr-1" />Reviews</> :
                 tab === "cycles" ? <><Settings2 className="h-3.5 w-3.5 mr-1" />Cycles</> :
                 tab === "calibration" ? <><BarChart3 className="h-3.5 w-3.5 mr-1" />Calibration</> :
                 <><TrendingUp className="h-3.5 w-3.5 mr-1" />Reports</>}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="mt-4">
            <TabsContent value="my-goals">
              {effectiveCycleId ? (
                <MyGoalsTab cycleId={effectiveCycleId} employees={employees} />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Target className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No active cycle found.</p>
                  {isHR(user!) && <Button size="sm" className="mt-3" onClick={() => setActiveTab("cycles")}>Create a Cycle</Button>}
                </div>
              )}
            </TabsContent>

            <TabsContent value="team-goals">
              {effectiveCycleId ? (
                <TeamGoalsTab cycleId={effectiveCycleId} employees={employees} />
              ) : (
                <div className="text-center py-12 text-muted-foreground text-sm">No active cycle found.</div>
              )}
            </TabsContent>

            <TabsContent value="reviews">
              {effectiveCycleId ? (
                <ReviewsTab cycleId={effectiveCycleId} cycle={selectedCycle} employees={employees} />
              ) : (
                <div className="text-center py-12 text-muted-foreground text-sm">No active cycle found.</div>
              )}
            </TabsContent>

            <TabsContent value="cycles">
              <CyclesTab onSelectCycle={id => { setSelectedCycleId(id); setActiveTab("my-goals"); }} />
            </TabsContent>

            <TabsContent value="calibration">
              {effectiveCycleId ? (
                <CalibrationTab cycleId={effectiveCycleId} employees={employees} />
              ) : (
                <div className="text-center py-12 text-muted-foreground text-sm">Select a cycle first.</div>
              )}
            </TabsContent>

            <TabsContent value="reports">
              {effectiveCycleId ? (
                <ReportsTab cycleId={effectiveCycleId} />
              ) : (
                <div className="text-center py-12 text-muted-foreground text-sm">Select a cycle first.</div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      )}
    </div>
  );
}
