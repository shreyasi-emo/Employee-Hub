import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// ---- Progress Dialog ----
export function ProgressDialog({ open, onClose, goal }: { open: boolean; onClose: () => void; goal: any }) {
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
            <Input data-testid="input-progress-value" type="number" inputMode="decimal" value={form.progressValue} onChange={e => setForm(f => ({ ...f, progressValue: e.target.value }))} placeholder={`Target: ${goal?.targetValue} ${goal?.unit || ""}`} />
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
