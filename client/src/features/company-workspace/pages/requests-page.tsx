import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Inbox, Plus, ExternalLink, ImageIcon } from "lucide-react";
import { RaiseRequestDialog } from "../components/raise-request-dialog";
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
