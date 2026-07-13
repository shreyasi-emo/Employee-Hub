import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, RotateCcw, ClockIcon, FilterIcon, Inbox } from "lucide-react";
import { format } from "date-fns";

const ENTITY_COLORS: Record<string, string> = {
  requisition: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  offer: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  purchase_request: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  travel_request: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  payment: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
};

const DECISION_LABELS = {
  approved: { label: "Approve", icon: CheckCircle2, variant: "default" as const, class: "bg-green-600 hover:bg-green-700 text-white" },
  rejected: { label: "Reject", icon: XCircle, variant: "destructive" as const, class: "" },
  changes_requested: { label: "Request Changes", icon: RotateCcw, variant: "outline" as const, class: "" },
};

export default function ApprovalsPage() {
  const { data: auth } = useAuth();
  const { toast } = useToast();
  const [entityFilter, setEntityFilter] = useState("all");
  const [selectedApproval, setSelectedApproval] = useState<any>(null);
  const [decision, setDecision] = useState<"approved" | "rejected" | "changes_requested" | "">("");
  const [comment, setComment] = useState("");

  const { data: approvals = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/workspace/approvals/pending", entityFilter],
    queryFn: async () => {
      const url = entityFilter !== "all" ? `/api/workspace/approvals/pending?entityType=${entityFilter}` : "/api/workspace/approvals/pending";
      return apiRequest("GET", url);
    },
  });

  const decideMutation = useMutation({
    mutationFn: (data: { id: string; decision: string; comment?: string }) =>
      apiRequest("POST", `/api/workspace/approvals/${data.id}/decide`, { decision: data.decision, comment: data.comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspace/approvals/pending"] });
      toast({ title: "Decision recorded", description: "The approval has been updated." });
      setSelectedApproval(null);
      setDecision("");
      setComment("");
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message || "Failed to record decision.", variant: "destructive" });
    },
  });

  const handleDecide = () => {
    if (!selectedApproval || !decision) return;
    if ((decision === "rejected" || decision === "changes_requested") && !comment.trim()) {
      toast({ title: "Comment required", description: "Please provide a reason for rejection/changes.", variant: "destructive" });
      return;
    }
    decideMutation.mutate({ id: selectedApproval.id, decision, comment: comment.trim() || undefined });
  };

  const getApprovalRows = (item: any): { label: string; value: string }[] => {
    const d = item.entityDetails;
    const rows: { label: string; value: string | undefined | null }[] = [
      { label: "Type", value: item.entityType.replace(/_/g, " ") },
      { label: "Submitted by", value: item.submitterName },
      { label: "Submitted on", value: format(new Date(item.createdAt), "PPP") },
    ];
    if (item.entityType === "travel_request" && d) {
      rows.push(
        { label: "Route", value: `${d.fromCity} → ${d.toCity}` },
        { label: "Travel Date", value: d.travelDate ? format(new Date(d.travelDate), "PPP") : undefined },
        { label: "Return Date", value: d.returnDate ? format(new Date(d.returnDate), "PPP") : undefined },
        { label: "Purpose", value: d.purpose },
        { label: "Budget", value: d.estimatedBudget ? `₹${Number(d.estimatedBudget).toLocaleString("en-IN")}` : undefined },
        { label: "Preferences", value: d.preferences },
      );
    } else if (item.entityType === "purchase_request" && d) {
      rows.push(
        { label: "Category", value: d.category?.replace(/_/g, " ") },
        { label: "Estimated Cost", value: d.estimatedCost ? `₹${Number(d.estimatedCost).toLocaleString("en-IN")}` : undefined },
        { label: "Needed By", value: d.neededByDate ? format(new Date(d.neededByDate), "PPP") : undefined },
        { label: "Notes", value: d.notes },
      );
    } else if (item.entityType === "requisition" && d) {
      rows.push(
        { label: "Role", value: d.title },
        { label: "Department", value: d.department },
        { label: "Location", value: d.location },
        { label: "Positions", value: d.positions ? String(d.positions) : undefined },
        { label: "Employment Type", value: d.employmentType?.replace(/_/g, " ") },
        { label: "Justification", value: d.justification },
      );
    } else if (item.entityType === "offer" && d) {
      rows.push(
        { label: "Candidate", value: d.candidateName },
        { label: "Role Offered", value: d.offeredRole },
        { label: "CTC", value: d.offeredCtc ? `₹${Number(d.offeredCtc).toLocaleString("en-IN")}` : undefined },
        { label: "Joining Date", value: d.targetJoiningDate ? format(new Date(d.targetJoiningDate), "PPP") : undefined },
      );
    } else if (item.entityType === "payment" && d) {
      rows.push(
        { label: "Payment Type", value: d.paymentType?.replace(/_/g, " ") },
        { label: "Amount", value: d.amount ? `${d.currency || "INR"} ${Number(d.amount).toLocaleString("en-IN")}` : undefined },
        { label: "Description", value: d.description },
      );
    }
    return rows.filter((r): r is { label: string; value: string } => !!r.value);
  };

  const pending = (approvals as any[]).filter(a => entityFilter === "all" || a.entityType === entityFilter);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Inbox className="h-6 w-6 text-primary" /> CEO Approval Inbox
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Review and approve pending items</p>
        </div>
        <div className="flex items-center gap-2">
          <FilterIcon className="h-4 w-4 text-muted-foreground" />
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-44" data-testid="select-entity-filter">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="requisition">Requisitions</SelectItem>
              <SelectItem value="offer">Offers</SelectItem>
              <SelectItem value="purchase_request">Purchase Requests</SelectItem>
              <SelectItem value="travel_request">Travel Requests</SelectItem>
              <SelectItem value="payment">Payments</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : pending.length === 0 ? (
        <Card className="py-16">
          <CardContent className="flex flex-col items-center justify-center text-center gap-3">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <h3 className="text-lg font-semibold">All caught up!</h3>
            <p className="text-sm text-muted-foreground">No pending approvals at this time.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(pending as any[]).map((item: any) => {
            const d = item.entityDetails;
            const title = item.entityType === "travel_request" ? `${d?.fromCity} → ${d?.toCity}`
              : item.entityType === "purchase_request" ? d?.category?.replace(/_/g, " ")
              : item.entityType === "requisition" ? d?.title
              : item.entityType === "offer" ? `Offer — ${d?.candidateName}`
              : item.entityType === "payment" ? d?.description || "Payment Request"
              : item.entityType.replace(/_/g, " ");
            return (
              <Card key={item.id} className="border border-border hover:border-primary/40 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-0.5">
                        <ClockIcon className="h-5 w-5 text-amber-500" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={`text-xs font-medium border-0 ${ENTITY_COLORS[item.entityType] || "bg-gray-100 text-gray-800"}`}>
                            {item.entityType.replace(/_/g, " ")}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Submitted {format(new Date(item.createdAt), "MMM d, yyyy 'at' h:mm a")}
                          </span>
                        </div>
                        <p className="text-sm font-medium mt-1 text-foreground">{title || "—"}</p>
                        {item.submitterName && (
                          <p className="text-xs text-muted-foreground mt-0.5">By: {item.submitterName}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => { setSelectedApproval(item); setDecision(""); setComment(""); }}
                      data-testid={`button-review-${item.id}`}
                    >
                      Review
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedApproval} onOpenChange={(o) => !o && setSelectedApproval(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Approval</DialogTitle>
          </DialogHeader>
          {selectedApproval && (
            <div className="space-y-4">
              <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-1.5">
                {getApprovalRows(selectedApproval).map(r => (
                  <div key={r.label} className="flex justify-between gap-4">
                    <span className="text-muted-foreground flex-shrink-0">{r.label}</span>
                    <span className="font-medium text-right capitalize">{r.value}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Decision</p>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(DECISION_LABELS) as Array<keyof typeof DECISION_LABELS>).map(key => {
                    const IconComp = DECISION_LABELS[key].icon;
                    return (
                      <button
                        key={key}
                        onClick={() => setDecision(key)}
                        data-testid={`button-decision-${key}`}
                        className={`px-3 py-2 rounded-md text-xs font-medium border transition-colors flex items-center gap-1.5 justify-center ${
                          decision === key
                            ? key === "approved" ? "bg-green-600 text-white border-green-600"
                              : key === "rejected" ? "bg-destructive text-destructive-foreground border-destructive"
                              : "bg-orange-500 text-white border-orange-500"
                            : "border-border text-foreground hover:bg-accent"
                        }`}
                      >
                        <IconComp className="h-3.5 w-3.5" />
                        {DECISION_LABELS[key].label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-sm font-medium">
                  Comment {(decision === "rejected" || decision === "changes_requested") && <span className="text-destructive">*</span>}
                </p>
                <Textarea
                  placeholder="Add a comment or reason..."
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  rows={3}
                  data-testid="textarea-decision-comment"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedApproval(null)}>Cancel</Button>
            <Button
              onClick={handleDecide}
              disabled={!decision || decideMutation.isPending}
              data-testid="button-confirm-decision"
            >
              {decideMutation.isPending ? "Submitting..." : "Submit Decision"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
