import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TemplateFormDialog } from "../components/template-form";
import { TaskFormDialog } from "../components/task-form";
import { DocCollection } from "../components/doc-collection";
import { useAuth, isHR } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, Plus, CheckCircle2, Circle, SkipForward, ChevronRight, Settings } from "lucide-react";
import { format } from "date-fns";

const roleOptions = [
  { value: "hr_admin", label: "HR" },
  { value: "manager", label: "Manager" },
  { value: "super_admin", label: "IT / Admin" },
  { value: "employee", label: "Employee" },
];

function TaskItemRow({ item, tasks, canEdit }: { item: any; tasks: any[]; canEdit: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const task = tasks.find(t => t.id === item.taskId);

  const update = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/onboarding/task-items/${item.id}`, data),
    onSuccess: () => { qc.invalidateQueries({ predicate: q => (q.queryKey[0] as string)?.includes("/api/onboarding") }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const statusIcon = item.status === "done" ? (
    <CheckCircle2 className="h-4 w-4 text-[#0E7C7B]" />
  ) : item.status === "skipped" ? (
    <SkipForward className="h-4 w-4 text-muted-foreground" />
  ) : (
    <Circle className="h-4 w-4 text-muted-foreground" />
  );

  return (
    <div className={`flex items-start gap-3 py-3 ${item.status === "done" ? "opacity-60" : ""}`} data-testid={`task-item-${item.id}`}>
      <div className="flex-shrink-0 mt-0.5">{statusIcon}</div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${item.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
          {task?.title || "Task"}
        </p>
        {task?.description && <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>}
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="text-xs capitalize">{roleOptions.find(r => r.value === task?.ownedByRole)?.label || task?.ownedByRole}</Badge>
          {item.dueDate && <span className="text-xs text-muted-foreground">Due {format(new Date(item.dueDate), "MMM d")}</span>}
          {item.completedAt && <span className="text-xs text-muted-foreground">Done {format(new Date(item.completedAt), "MMM d")}</span>}
        </div>
      </div>
      {canEdit && item.status === "pending" && (
        <div className="flex gap-1 flex-shrink-0">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => update.mutate({ status: "done" })} disabled={update.isPending} data-testid={`button-complete-${item.id}`}>
            <CheckCircle2 className="h-3 w-3 mr-1" /> Done
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => update.mutate({ status: "skipped" })} disabled={update.isPending}>
            <SkipForward className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

function InstanceCard({ instance, employees, templates }: { instance: any; employees: any[]; templates: any[] }) {
  const [expanded, setExpanded] = useState(false);
  const { data: taskItems = [] } = useQuery<any[]>({
    queryKey: [`/api/onboarding/instances/${instance.id}/tasks`],
    enabled: expanded,
  });
  const { data: allTasks = [] } = useQuery<any[]>({
    queryKey: [`/api/onboarding/templates/${instance.templateId}/tasks`],
    enabled: expanded,
  });

  const { data: auth } = useAuth();
  const user = auth?.user;
  const canEdit = isHR(user!);

  const emp = employees.find((e: any) => e.id === instance.employeeId);
  const template = templates.find((t: any) => t.id === instance.templateId);
  const done = taskItems.filter(i => i.status === "done").length;
  const total = taskItems.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Card className="hover-elevate" data-testid={`instance-${instance.id}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3" onClick={() => setExpanded(!expanded)} style={{ cursor: "pointer" }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm font-bold text-primary">
              {emp ? emp.firstName[0] : "?"}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm text-foreground">
                {emp ? `${emp.firstName} ${emp.lastName}` : instance.employeeId}
              </p>
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">{emp?.employeeCode || "—"}<span className="w-px h-3 bg-border" />{template?.name || "Default Template"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {total > 0 && (
              <div className="hidden sm:flex items-center gap-2">
                <Progress value={pct} className="w-20 h-1.5" />
                <span className="text-xs text-muted-foreground">{done}/{total}</span>
              </div>
            )}
            <Badge className={pct === 100 ? "bg-[#4BDCD9]/25 text-[#0E7C7B] text-xs" : "bg-[#FFA962]/25 text-[#D98324] text-xs"}>
              {pct === 100 ? "Completed" : `${pct}%`}
            </Badge>
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
          </div>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-border">
            {taskItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No tasks in this onboarding instance.</p>
            ) : (
              <div className="divide-y divide-border">
                {taskItems.map(item => (
                  <TaskItemRow key={item.id} item={item} tasks={allTasks} canEdit={canEdit} />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TemplateManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddTemplate, setShowAddTemplate] = useState(false);

  const { data: templates = [] } = useQuery<any[]>({ queryKey: ["/api/onboarding/templates"] });
  const { data: tasks = [] } = useQuery<any[]>({
    queryKey: [`/api/onboarding/templates/${selectedTemplate}/tasks`],
    enabled: !!selectedTemplate,
  });

  const deleteTask = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/onboarding/tasks/${id}`),
    onSuccess: () => qc.invalidateQueries({ predicate: q => (q.queryKey[0] as string)?.includes("/tasks") }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const current = templates.find((t: any) => t.id === selectedTemplate);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {templates.map((t: any) => (
            <button
              key={t.id}
              onClick={() => setSelectedTemplate(t.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${selectedTemplate === t.id ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted/50"}`}
              data-testid={`button-template-${t.id}`}
            >
              {t.name} {t.isDefault && <span className="text-xs ml-1 opacity-70">(Default)</span>}
            </button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowAddTemplate(true)} data-testid="button-add-template">
          <Plus className="h-3.5 w-3.5 mr-1" /> New Template
        </Button>
      </div>

      {templates.length === 0 && (
        <div className="text-center py-12">
          <Settings className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No templates yet. Create one to get started.</p>
        </div>
      )}

      {selectedTemplate && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground">{current?.name} — Tasks</h3>
            <Button size="sm" onClick={() => setShowAddTask(true)} data-testid="button-add-task">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Task
            </Button>
          </div>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No tasks defined yet.</p>
          ) : (
            <div className="border border-border rounded-lg divide-y divide-border">
              {tasks.map((task: any) => (
                <div key={task.id} className="flex items-center gap-3 px-4 py-3" data-testid={`template-task-${task.id}`}>
                  <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{task.title}</p>
                    {task.description && <p className="text-xs text-muted-foreground">{task.description}</p>}
                    <div className="flex gap-2 mt-0.5">
                      <Badge variant="outline" className="text-xs">{roleOptions.find(r => r.value === task.ownedByRole)?.label}</Badge>
                      <span className="text-xs text-muted-foreground">Due in {task.dueDaysFromJoin} days</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 flex-shrink-0"
                    onClick={() => deleteTask.mutate(task.id)} data-testid={`button-delete-task-${task.id}`}>
                    <span className="text-xs">×</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}


      <TemplateFormDialog open={showAddTemplate} onClose={() => setShowAddTemplate(false)} />
      <TaskFormDialog open={showAddTask} onClose={() => setShowAddTask(false)} templateId={selectedTemplate} roleOptions={roleOptions} />
    </div>
  );
}

export default function OnboardingPage() {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const hrUser = isHR(user!);

  const { data: instances = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/onboarding/instances"] });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const { data: templates = [] } = useQuery<any[]>({ queryKey: ["/api/onboarding/templates"] });

  const active = instances.filter((i: any) => !i.completedAt);
  const completed = instances.filter((i: any) => i.completedAt);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Onboarding</h1>
          <p className="text-sm text-muted-foreground">{active.length} active onboarding{active.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active" data-testid="tab-active-onboarding">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed-onboarding">Completed ({completed.length})</TabsTrigger>
          {hrUser && <TabsTrigger value="documents" data-testid="tab-doc-collection">Documents</TabsTrigger>}
          {hrUser && <TabsTrigger value="templates" data-testid="tab-templates">Templates</TabsTrigger>}
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>
          ) : active.length === 0 ? (
            <div className="text-center py-16">
              <ClipboardList className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No active onboardings</h3>
              <p className="text-sm text-muted-foreground mt-1">Onboarding instances are created automatically when employees are added.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {active.map((instance: any) => (
                <InstanceCard key={instance.id} instance={instance} employees={employees} templates={templates} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {completed.length === 0 ? (
            <div className="text-center py-16">
              <CheckCircle2 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No completed onboardings yet</h3>
            </div>
          ) : (
            <div className="space-y-3">
              {completed.map((instance: any) => (
                <InstanceCard key={instance.id} instance={instance} employees={employees} templates={templates} />
              ))}
            </div>
          )}
        </TabsContent>

        {hrUser && (
          <TabsContent value="documents" className="mt-4">
            <DocCollection />
          </TabsContent>
        )}

        {hrUser && (
          <TabsContent value="templates" className="mt-4">
            <TemplateManager />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
