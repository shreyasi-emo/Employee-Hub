import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ImageIcon } from "lucide-react";

// The service-request form behind /requests. Lives here rather than in the page so the page
// composes the queue and this owns raising one.
export const REQUEST_TYPES: Record<string, string> = {
  purchase_online: "Online purchase (Amazon etc.)",
  supplies: "Supplies / materials",
  it_request: "IT request",
  facilities: "Facilities",
  hr_request: "HR request",
  finance_request: "Finance request",
  other: "Other",
};

export function RaiseRequestDialog({ open, onOpenChange }: any) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({ type: "purchase_online", title: "", description: "", itemLink: "", itemPhotoUrl: "", quantity: 1, priority: "normal" });

  const create = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/requests", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/requests"] });
      toast({ title: "Request raised" });
      onOpenChange(false);
      setForm({ type: "purchase_online", title: "", description: "", itemLink: "", itemPhotoUrl: "", quantity: 1, priority: "normal" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Raise a Request</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Type</label>
            <Select value={form.type} onValueChange={v => setForm((f: any) => ({ ...f, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(REQUEST_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {form.type === "purchase_online" ? "Goes to HR. They'll purchase on Amazon and may forward to CEO for approval."
                : form.type === "supplies" || form.type === "it_request" || form.type === "facilities" ? "Goes to Admin."
                : form.type === "hr_request" ? "Goes to HR."
                : form.type === "finance_request" ? "Goes to Finance."
                : "Goes to Admin."}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">Title *</label>
            <Input value={form.title} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))} placeholder="e.g. Sony WH-1000XM5 headphones" />
          </div>
          {form.type === "purchase_online" && (
            <>
              <div>
                <label className="text-sm font-medium">Item link (Amazon / website)</label>
                <Input value={form.itemLink} onChange={e => setForm((f: any) => ({ ...f, itemLink: e.target.value }))} placeholder="https://amazon.in/…" />
              </div>
              <div>
                <label className="text-sm font-medium">Item photo URL</label>
                <Input value={form.itemPhotoUrl} onChange={e => setForm((f: any) => ({ ...f, itemPhotoUrl: e.target.value }))} placeholder="https://… (Drive link or image URL)" />
              </div>
            </>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium">Quantity</label>
              <Input type="number" min={1} value={form.quantity} onChange={e => setForm((f: any) => ({ ...f, quantity: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="text-sm font-medium">Est. cost (₹)</label>
              <Input type="number" value={form.estimatedCost || ""} onChange={e => setForm((f: any) => ({ ...f, estimatedCost: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="text-sm font-medium">Priority</label>
              <Select value={form.priority} onValueChange={v => setForm((f: any) => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem><SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea rows={3} value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => create.mutate(form)} disabled={create.isPending || !form.title}>
              {create.isPending ? "Raising…" : "Raise"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
