import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { RequisitionFormDialog } from "../ats/components/requisition-form";
import { CandidateFormDialog } from "../ats/components/candidate-form";
import { ApplicationFormDialog } from "../ats/components/application-form";
import { Plus, Search, Briefcase, Send } from "lucide-react";
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
  const [appCandidateId, setAppCandidateId] = useState<string | undefined>(undefined);
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

  const submitReqMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/workspace/requisitions/${id}/submit`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/workspace/requisitions"] }); toast({ title: "Submitted for CEO approval" }); },
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
                      <Button variant="outline" size="sm" onClick={() => { setAppCandidateId(c.id); setShowAppForm(true); }} data-testid={`button-apply-${c.id}`}>
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

      {/* New Candidate Dialog */}

      <RequisitionFormDialog open={showReqForm} onClose={() => setShowReqForm(false)} />
      <CandidateFormDialog open={showCandForm} onClose={() => setShowCandForm(false)} />
      <ApplicationFormDialog open={showAppForm} onClose={() => { setShowAppForm(false); setAppCandidateId(undefined); }} initialCandidateId={appCandidateId}
        requisitions={requisitions as any[]} candidates={candidates as any[]} firstStageId={(stages as any[])[0]?.id} />
    </div>
  );
}
