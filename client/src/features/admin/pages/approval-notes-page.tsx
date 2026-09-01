import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, ScrollText } from "lucide-react";
import { format } from "date-fns";

const CEO_ROLES = ["super_admin", "ceo_approver"];

export default function ApprovalNotesPage() {
  const { data: auth } = useAuth();
  const isCEO = CEO_ROLES.includes(auth?.user?.role || "");
  const qc = useQueryClient();
  const { toast } = useToast();
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});

  const { data: notes = [] } = useQuery<any[]>({ queryKey: ["/api/approval-notes", { status: "pending" }], queryFn: () => fetch("/api/approval-notes?status=pending").then(r => r.json()) });
  const { data: decided = [] } = useQuery<any[]>({ queryKey: ["/api/approval-notes"], queryFn: () => fetch("/api/approval-notes").then(r => r.json()) });

  const decide = useMutation({
    mutationFn: ({ id, op, decisionNote }: any) => apiRequest("POST", `/api/approval-notes/${id}/${op}`, { decisionNote }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/approval-notes"] }); toast({ title: "Decision recorded" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-6 space-y-6 max-w-[92rem] mx-auto">
      <div className="flex items-center gap-3">
        <ScrollText className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">CEO Approval Notes</h1>
          <p className="text-sm text-muted-foreground">{isCEO ? "Decide on bundled approvals from teams" : "Notes you've raised to the CEO"}</p>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">Pending</h2>
        <div className="space-y-3">
          {notes.length === 0 ? <Card><CardContent className="p-8 text-center text-muted-foreground">Nothing pending.</CardContent></Card>
            : notes.map((n: any) => (
              <Card key={n.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{n.reference}</span>
                        <Badge variant="outline">{n.raisedByTeam}</Badge>
                        <Badge className="bg-amber-500/10 text-amber-700">pending</Badge>
                      </div>
                      <h3 className="font-medium mt-1">{n.title}</h3>
                    </div>
                    <span className="text-xs text-muted-foreground">{format(new Date(n.createdAt), "d MMM")}</span>
                  </div>
                  {n.summary && <p className="text-sm">{n.summary}</p>}
                  <div className="text-sm text-muted-foreground">
                    {(n.linkedRequestIds || []).length} linked request(s)
                    {n.totalEstimatedCost && <> · Est. ₹{n.totalEstimatedCost}</>}
                  </div>
                  {isCEO && (
                    <div className="space-y-2 pt-2 border-t">
                      <Textarea placeholder="Decision note (optional)" rows={2}
                        value={decisionNotes[n.id] || ""}
                        onChange={e => setDecisionNotes(d => ({ ...d, [n.id]: e.target.value }))} />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => decide.mutate({ id: n.id, op: "approve", decisionNote: decisionNotes[n.id] })}>
                          <CheckCircle className="h-4 w-4 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => decide.mutate({ id: n.id, op: "reject", decisionNote: decisionNotes[n.id] })}>
                          <XCircle className="h-4 w-4 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">History</h2>
        <div className="space-y-2">
          {decided.filter((n: any) => n.status !== "pending").slice(0, 20).map((n: any) => (
            <Card key={n.id}>
              <CardContent className="p-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Badge className={n.status === "approved" ? "bg-green-500/10 text-green-700" : "bg-red-500/10 text-red-700"}>{n.status}</Badge>
                  <span className="font-mono text-xs text-muted-foreground">{n.reference}</span>
                  <span>{n.title}</span>
                </div>
                <span className="text-xs text-muted-foreground">{n.decidedAt && format(new Date(n.decidedAt), "d MMM")}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
