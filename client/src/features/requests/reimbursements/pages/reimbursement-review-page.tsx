import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Download } from "lucide-react";
import { ReimbursementDetailView, exportReimbursement } from "@/features/requests/reimbursements/components/reimbursement-approval-detail";

export default function ReimbursementReviewPage() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { data: auth } = useAuth();
  const role = auth?.user?.role;
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: reimb, isLoading } = useQuery<any>({ queryKey: [`/api/reimbursements/${id}`], enabled: !!id });

  const canFinance = role === "finance" || role === "super_admin";
  const canCeo = role === "ceo_approver" || role === "super_admin";
  const notOwn = reimb && reimb.requesterId !== auth?.user?.id;
  const canAct = !!reimb && !!notOwn && ((reimb.status === "submitted" && canFinance) || (reimb.status === "finance_approved" && canCeo));

  const invalidate = () => qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/reimbursements") });
  const act = useMutation({
    mutationFn: ({ kind, note, sel }: { kind: string; note?: string; sel?: { fields: string[]; lines: number[] } }) => apiRequest("POST", `/api/reimbursements/${id}/${kind}`, { ...(note ? { note } : {}), ...(sel || {}) }),
    onSuccess: (_d, v) => { invalidate(); toast({ title: v.kind === "approve" ? "Reimbursement approved" : v.kind === "reject" ? "Reimbursement rejected" : "Changes requested" }); navigate("/my-approvals"); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="p-6 max-w-[92rem] mx-auto space-y-4"><Skeleton className="h-12 w-64" /><Skeleton className="h-[70vh] w-full" /></div>;
  if (!reimb) return (
    <div className="p-6 max-w-[92rem] mx-auto">
      <Button variant="secondary" size="sm" onClick={() => navigate("/my-approvals")}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
      <p className="text-center text-sm text-muted-foreground py-20">Reimbursement not found.</p>
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-0px)]">
      <div className="flex items-center gap-3 px-6 pt-5 pb-2">
        <Button variant="secondary" size="icon" className="h-10 w-10 flex-shrink-0" onClick={() => navigate("/my-approvals")} aria-label="Back" data-testid="button-back-review">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">Reimbursement Review</h1>
          <p className="text-xs text-muted-foreground">{reimb.reference}</p>
        </div>
        <Button variant="outline" size="sm" className="btn-glass" onClick={() => { exportReimbursement(reimb).catch((e) => toast({ title: "Export failed", description: e.message, variant: "destructive" })); }} data-testid="button-export-review">
          <Download className="h-4 w-4 mr-1.5" /> Export
        </Button>
      </div>
      <div className="flex-1 min-h-0">
        <ReimbursementDetailView
          reimb={reimb}
          canAct={canAct}
          busy={act.isPending}
          variant="page"
          showTimeline
          onApprove={() => act.mutate({ kind: "approve" })}
          onReject={(note) => act.mutate({ kind: "reject", note })}
          onRequestChanges={(note, sel) => act.mutate({ kind: "request-changes", note, sel })}
        />
      </div>
    </div>
  );
}
