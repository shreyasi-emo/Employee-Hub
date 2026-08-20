import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useForm, Controller } from "react-hook-form";
import { DateInput } from "@/components/shared/datetime-field";
import { Plus, CheckSquare, Trash2, ClipboardList, TicketIcon, CheckCircle2, ArrowRight } from "lucide-react";
import { TICKET_CATEGORIES } from "@/features/company-workspace/tickets/lib/ticket-categories";
import { cap } from "@/features/company-workspace/shared/approval-format";
import { Link } from "wouter";
import { format } from "date-fns";

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  done: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  cancelled: "bg-gray-100 text-gray-700",
};

const TICKET_STATUS_COLORS: Record<string, string> = {
  open: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  resolved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  closed: "bg-gray-100 text-gray-700",
};

export default function HRopsPage() {
  const { data: auth } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState("tasks");
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [taskFilter, setTaskFilter] = useState("all");
  const [ticketFilter, setTicketFilter] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [newComment, setNewComment] = useState("");

  const { data: tasks = [], isLoading: loadingTasks } = useQuery<any[]>({
    queryKey: ["/api/workspace/hr-tasks", taskFilter],
    queryFn: () => apiRequest("GET", taskFilter !== "all" ? `/api/workspace/hr-tasks?status=${taskFilter}` : "/api/workspace/hr-tasks"),
  });

  const { data: tickets = [], isLoading: loadingTickets } = useQuery<any[]>({
    queryKey: ["/api/workspace/tickets", ticketFilter],
    queryFn: () => apiRequest("GET", ticketFilter !== "all" ? `/api/workspace/tickets?status=${ticketFilter}` : "/api/workspace/tickets"),
  });

  const { data: comments = [] } = useQuery<any[]>({
    queryKey: ["/api/workspace/tickets", selectedTicket?.id, "comments"],
    queryFn: () => apiRequest("GET", `/api/workspace/tickets/${selectedTicket?.id}/comments`),
    enabled: !!selectedTicket,
  });

  const { data: approvedRequisitions = [] } = useQuery<any[]>({
    queryKey: ["/api/workspace/requisitions", "approved"],
    queryFn: () => apiRequest("GET", "/api/workspace/requisitions?status=approved"),
  });
  const { data: approvedOffers = [] } = useQuery<any[]>({
    queryKey: ["/api/workspace/offers", "approved"],
    queryFn: () => apiRequest("GET", "/api/workspace/offers?status=approved"),
  });
  const { data: approvedPurchases = [] } = useQuery<any[]>({
    queryKey: ["/api/workspace/purchase-requests", "approved"],
    queryFn: () => apiRequest("GET", "/api/workspace/purchase-requests?status=approved"),
  });
  const { data: approvedTravel = [] } = useQuery<any[]>({
    queryKey: ["/api/workspace/travel-requests", "approved"],
    queryFn: () => apiRequest("GET", "/api/workspace/travel-requests?status=approved"),
  });
  const { data: approvedPayments = [] } = useQuery<any[]>({
    queryKey: ["/api/workspace/payments", "approved"],
    queryFn: () => apiRequest("GET", "/api/workspace/payments?status=approved"),
  });

  const userRole = (auth as any)?.role;
  const showHiringItems = ["super_admin", "hr_admin", "recruiter"].includes(userRole);
  const showOpsItems = ["super_admin", "hr_admin", "hr_executive", "hr_ops"].includes(userRole);

  const ceoApprovedCount =
    (showHiringItems ? (approvedRequisitions as any[]).length + (approvedOffers as any[]).length : 0) +
    (showOpsItems ? (approvedPurchases as any[]).length + (approvedTravel as any[]).length + (approvedPayments as any[]).length : 0);

  const taskForm = useForm({
    defaultValues: { title: "", description: "", priority: "medium", dueDate: "", category: "general" }
  });

  const ticketForm = useForm({
    defaultValues: { subject: "", description: "", category: "hr_query", priority: "medium" }
  });

  const createTaskMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/workspace/hr-tasks", { ...data, status: "pending", dueDate: data.dueDate || null }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/workspace/hr-tasks"] }); setShowTaskForm(false); taskForm.reset(); toast({ title: "Task created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiRequest("PUT", `/api/workspace/hr-tasks/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/workspace/hr-tasks"] }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/workspace/hr-tasks/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/workspace/hr-tasks"] }); toast({ title: "Task deleted" }); },
  });

  const createTicketMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/workspace/tickets", { ...data, status: "open" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/workspace/tickets"] }); setShowTicketForm(false); ticketForm.reset(); toast({ title: "Ticket raised" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateTicketMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiRequest("PUT", `/api/workspace/tickets/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/workspace/tickets"] }),
  });

  const addCommentMutation = useMutation({
    mutationFn: ({ ticketId, content }: { ticketId: string; content: string }) =>
      apiRequest("POST", `/api/workspace/tickets/${ticketId}/comments`, { content, isInternal: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspace/tickets", selectedTicket?.id, "comments"] });
      setNewComment("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const doneTasks = (tasks as any[]).filter(t => t.status === "done").length;
  const totalTasks = (tasks as any[]).length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" /> HR Ops Control Room
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage HR tasks and employee helpdesk tickets</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList data-testid="tabs-hr-ops">
          <TabsTrigger value="tasks">HR Tasks {totalTasks > 0 && `(${doneTasks}/${totalTasks})`}</TabsTrigger>
          <TabsTrigger value="tickets">Helpdesk Tickets</TabsTrigger>
          <TabsTrigger value="ceo-approved" data-testid="tab-ceo-approved">
            CEO Approved {ceoApprovedCount > 0 && <span className="ml-1.5 bg-green-600 text-white text-xs rounded-full px-1.5 py-0.5">{ceoApprovedCount}</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <Select value={taskFilter} onValueChange={setTaskFilter}>
              <SelectTrigger className="w-36" data-testid="select-task-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tasks</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => setShowTaskForm(true)} data-testid="button-new-task">
              <Plus className="h-4 w-4 mr-1.5" /> New Task
            </Button>
          </div>

          {loadingTasks ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : (
            <div className="space-y-2">
              {(tasks as any[]).map((task: any) => (
                <div
                  key={task.id}
                  data-testid={`card-task-${task.id}`}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors"
                >
                  <Checkbox
                    checked={task.status === "done"}
                    onCheckedChange={(checked) => updateTaskMutation.mutate({ id: task.id, status: checked ? "done" : "pending" })}
                    data-testid={`checkbox-task-${task.id}`}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-medium ${task.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {task.title}
                      </span>
                      <Badge className={`text-xs border-0 ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium}`}>{task.priority}</Badge>
                      <Badge className={`text-xs border-0 ${STATUS_COLORS[task.status] || STATUS_COLORS.pending}`}>{task.status?.replace(/_/g, " ")}</Badge>
                    </div>
                    {task.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.description}</p>}
                    {task.dueDate && <p className="text-xs text-muted-foreground">Due: {format(new Date(task.dueDate), "MMM d, yyyy")}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {task.status !== "in_progress" && task.status !== "done" && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateTaskMutation.mutate({ id: task.id, status: "in_progress" })} data-testid={`button-progress-task-${task.id}`}>
                        <CheckSquare className="h-3.5 w-3.5 text-blue-500" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteTaskMutation.mutate(task.id)} data-testid={`button-delete-task-${task.id}`}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              {(tasks as any[]).length === 0 && (
                <Card className="py-10"><CardContent className="text-center text-muted-foreground text-sm">No tasks found.</CardContent></Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tickets" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <Select value={ticketFilter} onValueChange={setTicketFilter}>
              <SelectTrigger className="w-36" data-testid="select-ticket-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tickets</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => setShowTicketForm(true)} data-testid="button-raise-ticket">
              <Plus className="h-4 w-4 mr-1.5" /> Raise Ticket
            </Button>
          </div>

          {loadingTickets ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : (
            <div className="space-y-3">
              {(tickets as any[]).map((ticket: any) => (
                <Card key={ticket.id} data-testid={`card-ticket-${ticket.id}`} className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setSelectedTicket(ticket)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <TicketIcon className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="font-medium text-sm text-foreground">{ticket.subject}</span>
                          <Badge className={`text-xs border-0 ${TICKET_STATUS_COLORS[ticket.status] || TICKET_STATUS_COLORS.open}`}>{ticket.status}</Badge>
                          <Badge className={`text-xs border-0 ${PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.medium}`}>{ticket.priority}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{ticket.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">Category: {ticket.category?.replace(/_/g, " ")}</p>
                      </div>
                      <div onClick={e => e.stopPropagation()}>
                        <Select
                          value={ticket.status}
                          onValueChange={(v) => { updateTicketMutation.mutate({ id: ticket.id, status: v }); queryClient.invalidateQueries({ queryKey: ["/api/workspace/tickets"] }); }}
                        >
                          <SelectTrigger className="w-32 h-8 text-xs" data-testid={`select-ticket-status-${ticket.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(tickets as any[]).length === 0 && (
                <Card className="py-10"><CardContent className="text-center text-muted-foreground text-sm">No tickets found.</CardContent></Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ceo-approved" className="mt-4 space-y-5">
          <p className="text-sm text-muted-foreground">Items approved by CEO that require HR Admin or Ops action.</p>

          {ceoApprovedCount === 0 && (
            <Card className="py-10">
              <CardContent className="text-center text-muted-foreground text-sm">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                No CEO-approved items pending action.
              </CardContent>
            </Card>
          )}

          {showHiringItems && (approvedRequisitions as any[]).length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Job Requisitions — Start Hiring</h3>
                <Link href="/workspace/ats">
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" data-testid="link-ats-requisitions">
                    Go to ATS <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
              {(approvedRequisitions as any[]).map((r: any) => (
                <div key={r.id} data-testid={`card-approved-req-${r.id}`} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div>
                    <p className="text-sm font-medium text-foreground">{r.title}</p>
                    <p className="text-xs text-muted-foreground">{r.department} · {r.location} · {r.positions} position{r.positions !== 1 ? "s" : ""}</p>
                  </div>
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0 text-xs">Approved</Badge>
                </div>
              ))}
            </div>
          )}

          {showHiringItems && (approvedOffers as any[]).length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Offers — Send to Candidates</h3>
                <Link href="/workspace/ats">
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" data-testid="link-ats-offers">
                    Go to ATS <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
              {(approvedOffers as any[]).map((o: any) => (
                <div key={o.id} data-testid={`card-approved-offer-${o.id}`} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div>
                    <p className="text-sm font-medium text-foreground">{o.candidateName}</p>
                    <p className="text-xs text-muted-foreground">{o.offeredRole} · {o.offeredCtc ? `CTC: ₹${Number(o.offeredCtc).toLocaleString("en-IN")}` : ""}</p>
                  </div>
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0 text-xs">Approved</Badge>
                </div>
              ))}
            </div>
          )}

          {showOpsItems && (approvedPurchases as any[]).length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Purchase Requests — Place Order</h3>
                <Link href="/workspace/office">
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" data-testid="link-office-purchase">
                    Go to Office <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
              {(approvedPurchases as any[]).map((p: any) => (
                <div key={p.id} data-testid={`card-approved-purchase-${p.id}`} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.category}</p>
                    <p className="text-xs text-muted-foreground">{p.description} · ₹{Number(p.estimatedAmount || 0).toLocaleString("en-IN")}</p>
                  </div>
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0 text-xs">Approved</Badge>
                </div>
              ))}
            </div>
          )}

          {showOpsItems && (approvedTravel as any[]).length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Travel Requests — Book & Assign</h3>
                <Link href="/workspace/office">
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" data-testid="link-office-travel">
                    Go to Office <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
              {(approvedTravel as any[]).map((t: any) => (
                <div key={t.id} data-testid={`card-approved-travel-${t.id}`} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div>
                    <p className="text-sm font-medium text-foreground">{t.fromCity} → {t.toCity}</p>
                    <p className="text-xs text-muted-foreground">{t.travelDate ? format(new Date(t.travelDate), "MMM d, yyyy") : ""} · {t.purpose}</p>
                    {t.assignedToName && <p className="text-xs text-blue-600 dark:text-blue-400">Assigned: {t.assignedToName}</p>}
                  </div>
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0 text-xs">Approved</Badge>
                </div>
              ))}
            </div>
          )}

          {showOpsItems && (approvedPayments as any[]).length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Payments — Process</h3>
                <Link href="/workspace/office">
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" data-testid="link-office-payments">
                    Go to Office <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
              {(approvedPayments as any[]).map((p: any) => (
                <div key={p.id} data-testid={`card-approved-payment-${p.id}`} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.description || p.category}</p>
                    <p className="text-xs text-muted-foreground">₹{Number(p.amount || 0).toLocaleString("en-IN")} · {p.paymentType?.replace(/_/g, " ")}</p>
                  </div>
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0 text-xs">Approved</Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* New Task Dialog */}
      <Dialog open={showTaskForm} onOpenChange={setShowTaskForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New HR Task</DialogTitle></DialogHeader>
          <form onSubmit={taskForm.handleSubmit(data => createTaskMutation.mutate(data))} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input {...taskForm.register("title", { required: true })} placeholder="Task title..." data-testid="input-task-title" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={2} {...taskForm.register("description")} placeholder="Task description..." data-testid="textarea-task-desc" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={taskForm.watch("priority")} onValueChange={v => taskForm.setValue("priority", v)}>
                  <SelectTrigger data-testid="select-task-priority"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Controller control={taskForm.control} name="dueDate" render={({ field }) => <DateInput value={field.value || ""} onChange={field.onChange} testId="input-task-due" />} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowTaskForm(false)}>Cancel</Button>
              <Button type="submit" disabled={createTaskMutation.isPending} data-testid="button-save-task">
                {createTaskMutation.isPending ? "Creating..." : "Create Task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Ticket Dialog */}
      <Dialog open={showTicketForm} onOpenChange={setShowTicketForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Raise Helpdesk Ticket</DialogTitle></DialogHeader>
          <form onSubmit={ticketForm.handleSubmit(data => createTicketMutation.mutate(data))} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Subject *</Label>
              <Input {...ticketForm.register("subject", { required: true })} placeholder="Brief subject..." data-testid="input-ticket-subject" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={3} {...ticketForm.register("description")} placeholder="Describe your issue..." data-testid="textarea-ticket-desc" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={ticketForm.watch("category")} onValueChange={v => ticketForm.setValue("category", v)}>
                  <SelectTrigger data-testid="select-ticket-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TICKET_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{cap(c)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={ticketForm.watch("priority")} onValueChange={v => ticketForm.setValue("priority", v)}>
                  <SelectTrigger data-testid="select-ticket-priority"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowTicketForm(false)}>Cancel</Button>
              <Button type="submit" disabled={createTicketMutation.isPending} data-testid="button-save-ticket">
                {createTicketMutation.isPending ? "Raising..." : "Raise Ticket"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={(o) => !o && setSelectedTicket(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{selectedTicket?.subject}</DialogTitle></DialogHeader>
          {selectedTicket && (
            <div className="space-y-4">
              <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="font-medium capitalize">{selectedTicket.status?.replace(/_/g, " ")}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Priority</span><span className="font-medium capitalize">{selectedTicket.priority}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span className="font-medium capitalize">{selectedTicket.category?.replace(/_/g, " ")}</span></div>
              </div>
              <p className="text-sm text-foreground">{selectedTicket.description}</p>
              <div className="border-t pt-3 space-y-3">
                <h4 className="text-sm font-semibold">Comments</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {(comments as any[]).map((c: any) => (
                    <div key={c.id} className="bg-muted/40 rounded-md p-2.5 text-xs">
                      <p className="font-medium text-foreground mb-0.5">{c.content}</p>
                      <p className="text-muted-foreground">{c.createdAt ? format(new Date(c.createdAt), "MMM d, h:mm a") : ""}</p>
                    </div>
                  ))}
                  {(comments as any[]).length === 0 && <p className="text-xs text-muted-foreground">No comments yet.</p>}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && newComment.trim()) {
                        addCommentMutation.mutate({ ticketId: selectedTicket.id, content: newComment.trim() });
                      }
                    }}
                    data-testid="input-new-comment"
                  />
                  <Button
                    size="sm"
                    onClick={() => newComment.trim() && addCommentMutation.mutate({ ticketId: selectedTicket.id, content: newComment.trim() })}
                    disabled={addCommentMutation.isPending || !newComment.trim()}
                    data-testid="button-add-comment"
                  >
                    Send
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTicket(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
