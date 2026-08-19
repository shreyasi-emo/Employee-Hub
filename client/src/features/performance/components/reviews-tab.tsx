import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth, isHR, isAdmin } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Star, Lock, Unlock, CheckCircle2, FileText, Users, Send } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { REVIEW_STATUS_COLORS } from "../lib/performance-constants";
import { statusBadge } from "./status-badge";

// ---- Review Form Tab ----
export function ReviewsTab({ cycleId, cycle, employees }: { cycleId: string; cycle: any; employees: any[] }) {
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
