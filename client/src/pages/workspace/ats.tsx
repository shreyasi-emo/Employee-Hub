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
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Plus, Search, Users, Briefcase, Send } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  submitted: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  open: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  closed: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  on_hold: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

export default function ATSPage() {
  const { data: auth } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState("requisitions");
  const [search, setSearch] = useState("");
  const [showReqForm, setShowReqForm] = useState(false);
  const [showCandForm, setShowCandForm] = useState(false);
  const [showAppForm, setShowAppForm] = useState(false);
  const [selectedReq, setSelectedReq] = useState<any>(null);

  const { data: requisitions = [], isLoading: loadingReqs } = useQuery<any[]>({
    queryKey: ["/api/workspace/requisitions"],
  });

  const { data: candidates = [], isLoading: loadingCands } = useQuery<any[]>({
    queryKey: ["/api/workspace/candidates", search],
    queryFn: () => apiRequest("GET", search ? `/api/workspace/candidates?q=${encodeURIComponent(search)}` : "/api/workspace/candidates"),
  });

  const { data: applications = [], isLoading: loadingApps } = useQuery<any[]>({
    queryKey: ["/api/workspace/applications"],
  });

  const { data: stages = [] } = useQuery<any[]>({
    queryKey: ["/api/workspace/pipeline-stages"],
  });

  const reqForm = useForm({
    defaultValues: { title: "", departmentId: "", noOfPositions: "1", jobType: "full_time", workMode: "onsite", description: "", requirements: "", salaryMin: "", salaryMax: "" }
  });

  const candForm = useForm({
    defaultValues: { name: "", email: "", phone: "", currentRole: "", currentCompany: "", experienceYears: "", source: "linkedin" }
  });

  const appForm = useForm({
    defaultValues: { requisitionId: "", candidateId: "" }
  });

  const createReqMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/workspace/requisitions", {
      ...data, noOfPositions: Number(data.noOfPositions), salaryMin: data.salaryMin ? Number(data.salaryMin) : null, salaryMax: data.salaryMax ? Number(data.salaryMax) : null, status: "draft",
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/workspace/requisitions"] }); setShowReqForm(false); reqForm.reset(); toast({ title: "Requisition created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const submitReqMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/workspace/requisitions/${id}/submit`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/workspace/requisitions"] }); toast({ title: "Submitted for CEO approval" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createCandMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/workspace/candidates", { ...data, experienceYears: data.experienceYears ? Number(data.experienceYears) : null }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/workspace/candidates"] }); setShowCandForm(false); candForm.reset(); toast({ title: "Candidate added" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createAppMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/workspace/applications", { ...data, status: "active", pipelineStageId: (stages as any[])[0]?.id }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/workspace/applications"] }); setShowAppForm(false); appForm.reset(); toast({ title: "Application created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateAppMutation = useMutation({
    mutationFn: (data: { id: string; pipelineStageId: string }) => apiRequest("PUT", `/api/workspace/applications/${data.id}`, { pipelineStageId: data.pipelineStageId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/workspace/applications"] }); toast({ title: "Stage updated" }); },
  });

  const getCandName = (id: string) => (candidates as any[]).find(c => c.id === id)?.name || id.slice(0, 8);
  const getReqTitle = (id: string) => (requisitions as any[]).find(r => r.id === id)?.title || id.slice(0, 8);
  const getStageName = (id: string) => (stages as any[]).find(s => s.id === id)?.name || "Unknown";

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" /> ATS / Recruitment
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage job requisitions, candidates and pipeline</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList data-testid="tabs-ats">
          <TabsTrigger value="requisitions">Job Requisitions</TabsTrigger>
          <TabsTrigger value="candidates">Candidates</TabsTrigger>
          <TabsTrigger value="applications">Pipeline</TabsTrigger>
        </TabsList>

        <TabsContent value="requisitions" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowReqForm(true)} data-testid="button-new-requisition">
              <Plus className="h-4 w-4 mr-1.5" /> New Requisition
            </Button>
          </div>
          {loadingReqs ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : (
            <div className="space-y-3">
              {(requisitions as any[]).map((req: any) => (
                <Card key={req.id} data-testid={`card-requisition-${req.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-foreground text-sm">{req.title}</span>
                          <Badge className={`text-xs border-0 ${STATUS_COLORS[req.status] || STATUS_COLORS.draft}`}>{req.status}</Badge>
                          <Badge variant="outline" className="text-xs">{req.jobType?.replace(/_/g, " ")}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{req.noOfPositions} position(s)</span>
                          <span>{req.workMode}</span>
                          {req.createdAt && <span>Created {format(new Date(req.createdAt), "MMM d, yyyy")}</span>}
                        </div>
                      </div>
                      {req.status === "draft" && (
                        <Button variant="outline" size="sm" onClick={() => submitReqMutation.mutate(req.id)} data-testid={`button-submit-req-${req.id}`}>
                          <Send className="h-3.5 w-3.5 mr-1.5" /> Submit for Approval
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(requisitions as any[]).length === 0 && (
                <Card className="py-10"><CardContent className="text-center text-muted-foreground text-sm">No requisitions yet. Create your first one.</CardContent></Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="candidates" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search candidates..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-candidate-search" />
            </div>
            <Button size="sm" onClick={() => setShowCandForm(true)} data-testid="button-new-candidate">
              <Plus className="h-4 w-4 mr-1.5" /> Add Candidate
            </Button>
          </div>
          {loadingCands ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : (
            <div className="space-y-2">
              {(candidates as any[]).map((c: any) => (
                <Card key={c.id} data-testid={`card-candidate-${c.id}`}>
                  <CardContent className="p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
                        {c.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.email} {c.currentRole && `• ${c.currentRole}`} {c.currentCompany && `@ ${c.currentCompany}`}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {c.source && <Badge variant="outline" className="text-xs">{c.source}</Badge>}
                      {c.experienceYears && <span className="text-xs text-muted-foreground">{c.experienceYears} yrs</span>}
                      <Button variant="outline" size="sm" onClick={() => { setShowAppForm(true); appForm.setValue("candidateId", c.id); }} data-testid={`button-apply-${c.id}`}>
                        Apply
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(candidates as any[]).length === 0 && (
                <Card className="py-10"><CardContent className="text-center text-muted-foreground text-sm">No candidates found.</CardContent></Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="applications" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowAppForm(true)} data-testid="button-new-application">
              <Plus className="h-4 w-4 mr-1.5" /> New Application
            </Button>
          </div>

          {stages.length > 0 && (
            <div className="overflow-x-auto">
              <div className="flex gap-3 min-w-max pb-2">
                {(stages as any[]).map(stage => {
                  const stageApps = (applications as any[]).filter(a => a.pipelineStageId === stage.id);
                  return (
                    <div key={stage.id} className="w-56 flex-shrink-0">
                      <div className="bg-muted/50 rounded-t-lg px-3 py-2 border border-border border-b-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground">{stage.name}</span>
                          <Badge variant="secondary" className="text-xs">{stageApps.length}</Badge>
                        </div>
                      </div>
                      <div className="border border-border rounded-b-lg bg-background min-h-32 p-2 space-y-2">
                        {stageApps.map(app => (
                          <div key={app.id} className="bg-card border border-border rounded-md p-2.5 text-xs space-y-1.5" data-testid={`card-application-${app.id}`}>
                            <p className="font-medium text-foreground truncate">{getCandName(app.candidateId)}</p>
                            <p className="text-muted-foreground truncate">{getReqTitle(app.requisitionId)}</p>
                            <Select
                              value={app.pipelineStageId || ""}
                              onValueChange={(val) => updateAppMutation.mutate({ id: app.id, pipelineStageId: val })}
                            >
                              <SelectTrigger className="h-6 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(stages as any[]).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!stages.length && loadingApps && <Skeleton className="h-64 w-full" />}
          {!stages.length && !loadingApps && (
            <Card className="py-10"><CardContent className="text-center text-muted-foreground text-sm">No pipeline stages configured.</CardContent></Card>
          )}
        </TabsContent>
      </Tabs>

      {/* New Requisition Dialog */}
      <Dialog open={showReqForm} onOpenChange={setShowReqForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Job Requisition</DialogTitle></DialogHeader>
          <form onSubmit={reqForm.handleSubmit(data => createReqMutation.mutate(data))} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Job Title *</Label>
              <Input {...reqForm.register("title", { required: true })} placeholder="e.g. Senior Backend Engineer" data-testid="input-req-title" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Positions</Label>
                <Input type="number" min="1" {...reqForm.register("noOfPositions")} data-testid="input-req-positions" />
              </div>
              <div className="space-y-1.5">
                <Label>Job Type</Label>
                <Select value={reqForm.watch("jobType")} onValueChange={v => reqForm.setValue("jobType", v)}>
                  <SelectTrigger data-testid="select-req-jobtype"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full Time</SelectItem>
                    <SelectItem value="part_time">Part Time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="internship">Internship</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Work Mode</Label>
              <Select value={reqForm.watch("workMode")} onValueChange={v => reqForm.setValue("workMode", v)}>
                <SelectTrigger data-testid="select-req-workmode"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="onsite">On-site</SelectItem>
                  <SelectItem value="remote">Remote</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Salary Min</Label>
                <Input type="number" placeholder="e.g. 600000" {...reqForm.register("salaryMin")} data-testid="input-req-salmin" />
              </div>
              <div className="space-y-1.5">
                <Label>Salary Max</Label>
                <Input type="number" placeholder="e.g. 1200000" {...reqForm.register("salaryMax")} data-testid="input-req-salmax" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={3} {...reqForm.register("description")} placeholder="Role description..." data-testid="textarea-req-description" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowReqForm(false)}>Cancel</Button>
              <Button type="submit" disabled={createReqMutation.isPending} data-testid="button-create-req">
                {createReqMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Candidate Dialog */}
      <Dialog open={showCandForm} onOpenChange={setShowCandForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Candidate</DialogTitle></DialogHeader>
          <form onSubmit={candForm.handleSubmit(data => createCandMutation.mutate(data))} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input {...candForm.register("name", { required: true })} placeholder="e.g. John Doe" data-testid="input-cand-name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" {...candForm.register("email", { required: true })} placeholder="john@email.com" data-testid="input-cand-email" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input {...candForm.register("phone")} placeholder="+91 9876543210" data-testid="input-cand-phone" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Current Role</Label>
                <Input {...candForm.register("currentRole")} data-testid="input-cand-role" />
              </div>
              <div className="space-y-1.5">
                <Label>Current Company</Label>
                <Input {...candForm.register("currentCompany")} data-testid="input-cand-company" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Experience (years)</Label>
                <Input type="number" min="0" {...candForm.register("experienceYears")} data-testid="input-cand-exp" />
              </div>
              <div className="space-y-1.5">
                <Label>Source</Label>
                <Select value={candForm.watch("source")} onValueChange={v => candForm.setValue("source", v)}>
                  <SelectTrigger data-testid="select-cand-source"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="naukri">Naukri</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="agency">Agency</SelectItem>
                    <SelectItem value="direct">Direct Apply</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCandForm(false)}>Cancel</Button>
              <Button type="submit" disabled={createCandMutation.isPending} data-testid="button-save-candidate">
                {createCandMutation.isPending ? "Adding..." : "Add Candidate"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Application Dialog */}
      <Dialog open={showAppForm} onOpenChange={setShowAppForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create Application</DialogTitle></DialogHeader>
          <form onSubmit={appForm.handleSubmit(data => createAppMutation.mutate(data))} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Job Requisition *</Label>
              <Select value={appForm.watch("requisitionId")} onValueChange={v => appForm.setValue("requisitionId", v)}>
                <SelectTrigger data-testid="select-app-req"><SelectValue placeholder="Select requisition..." /></SelectTrigger>
                <SelectContent>
                  {(requisitions as any[]).filter(r => ["approved", "open"].includes(r.status)).map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Candidate *</Label>
              <Select value={appForm.watch("candidateId")} onValueChange={v => appForm.setValue("candidateId", v)}>
                <SelectTrigger data-testid="select-app-candidate"><SelectValue placeholder="Select candidate..." /></SelectTrigger>
                <SelectContent>
                  {(candidates as any[]).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name} — {c.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAppForm(false)}>Cancel</Button>
              <Button type="submit" disabled={createAppMutation.isPending || !appForm.watch("requisitionId") || !appForm.watch("candidateId")} data-testid="button-save-application">
                {createAppMutation.isPending ? "Creating..." : "Create Application"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
