import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { DataTable } from "@/components/shared/data-table";
import { UserPlus, Copy, Mail, Link2, X, UserCheck } from "lucide-react";
import { format } from "date-fns";
import { OnboardDialog } from "./onboard-dialog";

// HR surface: add a candidate → generate + email a unique document-collection link, and track submissions.
export function DocCollection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: requests = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/onboarding/doc-requests"] });

  const copy = (link: string) => { navigator.clipboard?.writeText(link); toast({ title: "Link copied" }); };
  const linkFor = (token: string) => `${window.location.origin}/onboard/${token}`;
  const valid = form.name.trim() && form.email.trim();

  const create = useMutation({
    mutationFn: () => apiRequest("POST", "/api/onboarding/doc-requests", form),
    onSuccess: (data: any) => {
      const link = data && typeof data === "object" && typeof data.link === "string" ? data.link : null;
      if (!link) {
        toast({ title: "Unexpected response", description: "Restart the dev server so the new onboarding API routes load, then try again.", variant: "destructive" });
        return;
      }
      setLastLink(link);
      setForm({ name: "", email: "", phone: "" });
      qc.invalidateQueries({ queryKey: ["/api/onboarding/doc-requests"] });
      toast({
        title: data.email?.sent ? "Link emailed to candidate" : "Link generated",
        description: data.email?.sent ? undefined : "Email provider not set — copy the link below to share.",
      });
    },
    onError: (e: any) => toast({ title: "Couldn't create", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-5">
      {/* Add candidate */}
      <Card className="border-0"><CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2"><UserPlus className="h-4 w-4 text-[#206295]" /><h3 className="text-sm font-semibold text-foreground">Add candidate for document collection</h3></div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-3">
          <Input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="doc-candidate-name" />
          <Input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="doc-candidate-email" />
          <Input type="tel" inputMode="tel" placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="doc-candidate-phone" />
          <Button className="btn-primary-gradient" disabled={!valid || create.isPending} onClick={() => create.mutate()} data-testid="doc-generate">
            <Mail className="h-4 w-4 mr-1.5" /> {create.isPending ? "Generating…" : "Generate & send link"}
          </Button>
        </div>
        {lastLink && (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2">
            <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-foreground truncate flex-1">{lastLink}</span>
            <Button size="sm" variant="outline" onClick={() => { copy(lastLink); setLastLink(null); }}><Copy className="h-3.5 w-3.5 mr-1" /> Copy</Button>
            <button onClick={() => setLastLink(null)} aria-label="Dismiss" className="h-7 w-7 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted flex-shrink-0"><X className="h-4 w-4" /></button>
          </div>
        )}
      </CardContent></Card>

      {/* Requests list */}
      <Card className="border-0"><CardContent className="p-0">
        <DataTable
          columns={[
            { key: "candidateName", header: "Candidate", cellClassName: "font-medium text-foreground", render: (r: any) => r.candidateName || "—" },
            { key: "candidateEmail", header: "Email", cellClassName: "text-muted-foreground", render: (r: any) => r.candidateEmail || "—" },
            { key: "status", header: "Status", render: (r: any) => {
              const map: Record<string, [string, string]> = { onboarded: ["bg-[#4BDCD9]/25 text-[#0E7C7B]", "Onboarded"], submitted: ["bg-[#D98324]/20 text-[#D98324]", "Submitted"], sent: ["bg-[#206295]/15 text-[#206295]", "Sent"] };
              const [cls, txt] = map[r.status] || map.sent;
              return <Badge className={`text-xs ${cls}`}>{txt}</Badge>;
            } },
            { key: "sentAt", header: "Sent", cellClassName: "text-muted-foreground whitespace-nowrap", render: (r: any) => (r.sentAt ? format(new Date(r.sentAt), "d MMM yyyy") : "—") },
            { key: "submittedAt", header: "Submitted", cellClassName: "text-muted-foreground whitespace-nowrap", render: (r: any) => (r.submittedAt ? format(new Date(r.submittedAt), "d MMM yyyy") : "—") },
            { key: "action", header: "", align: "right", render: (r: any) => {
              if (r.status === "onboarded") return <Button size="sm" variant="outline" onClick={() => setOpenId(r.id)} data-testid={`doc-view-${r.id}`}><UserCheck className="h-3.5 w-3.5 mr-1" /> {r.employeeCode || "View"}</Button>;
              if (r.status === "submitted") return <Button size="sm" className="btn-primary-gradient" onClick={() => setOpenId(r.id)} data-testid={`doc-onboard-${r.id}`}>Review &amp; Onboard</Button>;
              return <Button size="sm" variant="outline" onClick={() => copy(linkFor(r.token))} data-testid={`doc-copy-${r.id}`}><Copy className="h-3.5 w-3.5 mr-1" /> Link</Button>;
            } },
          ]}
          rows={Array.isArray(requests) ? requests : []}
          getRowKey={(r: any) => r.id}
          emptyText={isLoading ? "Loading…" : "No candidates yet. Add one above to generate a link."}
          testIdPrefix="doc-request-row"
        />
      </CardContent></Card>

      <OnboardDialog requestId={openId} open={!!openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
