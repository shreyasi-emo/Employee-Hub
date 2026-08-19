import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Unlock } from "lucide-react";

export function UnlockDialog({ open, onOpenChange, runId }: { open: boolean; onOpenChange: (v: boolean) => void; runId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/payroll-runs/${runId}/unlock`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/payroll-runs"] });
      toast({ title: "Payroll unlocked", description: reason });
      onOpenChange(false);
      setReason("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unlock Payroll Run</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This action requires Super Admin authorization and will be audited.
          </p>
          <div>
            <label className="text-sm font-medium">Reason for Unlock *</label>
            <Input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Mandatory reason..."
              className="mt-1"
              data-testid="input-unlock-reason"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !reason}
              data-testid="button-confirm-unlock"
            >
              {mutation.isPending ? "Unlocking..." : "Unlock Payroll"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
