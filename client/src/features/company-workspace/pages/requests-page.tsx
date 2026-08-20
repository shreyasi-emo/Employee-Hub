import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Inbox, Plus, ExternalLink, ImageIcon } from "lucide-react";
import { format } from "date-fns";

const HANDLER_ROLES = ["super_admin", "hr_admin", "hr_executive", "hr_ops", "logistics", "finance"];

const statusColors: Record<string, string> = {
  submitted: "bg-blue-500/10 text-blue-700",
  in_review: "bg-amber-500/10 text-amber-700",
  pending_ceo: "bg-violet-500/10 text-violet-700",
  approved: "bg-green-500/10 text-green-700",
  rejected: "bg-red-500/10 text-red-700",
  fulfilled: "bg-emerald-500/10 text-emerald-700",
  cancelled: "bg-gray-500/10 text-gray-700",
};

const typeLabels: Record<string, string> = {
  purchase_online: "Online purchase (Amazon etc.)",
  supplies: "Supplies / materials",
  it_request: "IT request",
  facilities: "Facilities",
  hr_request: "HR request",
  finance_request: "Finance request",
  other: "Other",
};

function RaiseRequestDialog({ open, onOpenChange }: any) {
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
                {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
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

function RequestCard({ r, isHandler, onAction }: any) {
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{r.reference}</span>
              <Badge className={statusColors[r.status] || ""}>{r.status.replace(/_/g, " ")}</Badge>
              <Badge variant="outline">{r.routeToTeam}</Badge>
            </div>
            <h3 className="font-medium mt-1">{r.title}</h3>
          </div>
          <span className="text-xs text-muted-foreground">{format(new Date(r.createdAt), "d MMM")}</span>
        </div>
        {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}
        <div className="flex items-center gap-3 text-sm">
          {r.itemLink && <a href={r.itemLink} target="_blank" rel="noopener noreferrer" className="text-primary inline-flex items-center gap-1"><ExternalLink className="h-3 w-3" /> link</a>}
          {r.itemPhotoUrl && <a href={r.itemPhotoUrl} target="_blank" rel="noopener noreferrer" className="text-primary inline-flex items-center gap-1"><ImageIcon className="h-3 w-3" /> photo</a>}
          <span className="text-muted-foreground">Qty {r.quantity}</span>
          {r.estimatedCost && <span className="text-muted-foreground">~₹{r.estimatedCost}</span>}
        </div>
        {isHandler && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {r.status === "submitted" && <Button size="sm" onClick={() => onAction(r.id, "assign")}>Assign to me</Button>}
            {(r.status === "submitted" || r.status === "in_review" || r.status === "approved") && (
              <Button size="sm" variant="outline" onClick={() => onAction(r.id, "fulfill")}>Mark fulfilled</Button>
            )}
            {(r.status === "submitted" || r.status === "in_review") && (
              <Button size="sm" variant="ghost" onClick={() => onAction(r.id, "reject")}>Reject</Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function RequestsPage() {
  const { data: auth } = useAuth();
  const isHandler = HANDLER_ROLES.includes(auth?.user?.role || "");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(isHandler ? "team" : "mine");
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: requests = [] } = useQuery<any[]>({ queryKey: ["/api/requests"] });
  const mine = requests.filter(r => r.requesterId === auth?.user?.id);
  const teamQueue = requests.filter(r => !["fulfilled", "cancelled", "rejected"].includes(r.status));

  const action = useMutation({
    mutationFn: ({ id, op }: any) => apiRequest("POST", `/api/requests/${id}/${op}`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/requests"] }); toast({ title: "Updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Inbox className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-bold">Requests</h1>
            <p className="text-sm text-muted-foreground">Anything you need — purchases, supplies, IT, HR, facilities</p>
          </div>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Raise Request</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="mine">My Requests ({mine.length})</TabsTrigger>
          {isHandler && <TabsTrigger value="team">Team Queue ({teamQueue.length})</TabsTrigger>}
        </TabsList>
        <TabsContent value="mine" className="space-y-3 mt-4">
          {mine.length === 0 ? <Card><CardContent className="p-8 text-center text-muted-foreground">No requests yet — raise one to get started.</CardContent></Card>
            : mine.map(r => <RequestCard key={r.id} r={r} isHandler={false} onAction={() => {}} />)}
        </TabsContent>
        {isHandler && (
          <TabsContent value="team" className="space-y-3 mt-4">
            {teamQueue.length === 0 ? <Card><CardContent className="p-8 text-center text-muted-foreground">Queue empty.</CardContent></Card>
              : teamQueue.map(r => <RequestCard key={r.id} r={r} isHandler={true} onAction={(id: string, op: string) => action.mutate({ id, op })} />)}
          </TabsContent>
        )}
      </Tabs>

      <RaiseRequestDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
