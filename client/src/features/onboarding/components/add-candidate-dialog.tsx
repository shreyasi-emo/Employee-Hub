import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Copy, Mail, Link2, CheckCircle2 } from "lucide-react";

const BLANK = { firstName: "", lastName: "", email: "", phone: "", position: "", department: "" };

export function AddCandidateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...BLANK });
  const [link, setLink] = useState<string | null>(null);
  const [emailed, setEmailed] = useState(false);

  useEffect(() => { if (open) { setForm({ ...BLANK }); setLink(null); setEmailed(false); } }, [open]);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.firstName.trim() && form.lastName.trim() && form.email.trim();

  const create = useMutation({
    mutationFn: () => apiRequest("POST", "/api/onboarding/doc-requests", {
      name: `${form.firstName.trim()} ${form.lastName.trim()}`,
      email: form.email, phone: form.phone, position: form.position, department: form.department,
    }),
    onSuccess: (data: any) => {
      const l = data && typeof data === "object" && typeof data.link === "string" ? data.link : null;
      if (!l) { toast({ title: "Unexpected response", description: "Restart the dev server so the onboarding routes load.", variant: "destructive" }); return; }
      setLink(l); setEmailed(!!data.email?.sent);
      qc.invalidateQueries({ queryKey: ["/api/onboarding/doc-requests"] });
    },
    onError: (e: any) => toast({ title: "Couldn't add candidate", description: e.message, variant: "destructive" }),
  });
  const copy = () => { if (link) { navigator.clipboard?.writeText(link); toast({ title: "Link copied" }); } };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden flex flex-col rounded-[16px]">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b border-border">
          <DialogTitle>Add candidate</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          {link ? (
            <div className="text-center space-y-3 py-2">
              <span className="h-12 w-12 rounded-2xl bg-[#0E7C7B]/15 text-[#0E7C7B] flex items-center justify-center mx-auto"><CheckCircle2 className="h-6 w-6" /></span>
              <div>
                <p className="font-semibold text-foreground">{emailed ? "Link emailed to candidate" : "Link generated"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{emailed ? "They’ll get an email with their document-collection link." : "No email provider set — copy the link below to share."}</p>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-left">
                <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-xs text-foreground truncate flex-1">{link}</span>
                <Button size="sm" variant="outline" onClick={copy}><Copy className="h-3.5 w-3.5 mr-1" /> Copy</Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label className="text-[13px]">First name <span className="text-[#FF6F62]">*</span></Label><Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="First name" data-testid="add-cand-first" /></div>
              <div className="space-y-1.5"><Label className="text-[13px]">Last name <span className="text-[#FF6F62]">*</span></Label><Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} placeholder="Last name" data-testid="add-cand-last" /></div>
              <div className="space-y-1.5"><Label className="text-[13px]">Email <span className="text-[#FF6F62]">*</span></Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="name@example.com" data-testid="add-cand-email" /></div>
              <div className="space-y-1.5"><Label className="text-[13px]">Phone</Label><Input type="tel" inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Optional" /></div>
              <div className="space-y-1.5"><Label className="text-[13px]">Position</Label><Input value={form.position} onChange={(e) => set("position", e.target.value)} placeholder="e.g. Software Engineer" /></div>
              <div className="space-y-1.5"><Label className="text-[13px]">Department</Label><Input value={form.department} onChange={(e) => set("department", e.target.value)} placeholder="e.g. Engineering" /></div>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 border-t border-border bg-background px-6 py-4 flex items-center justify-end gap-2">
          {link ? (
            <Button size="sm" className="btn-primary-gradient" onClick={onClose}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
              <Button size="sm" className="btn-primary-gradient" disabled={!valid || create.isPending} onClick={() => create.mutate()} data-testid="add-cand-submit"><Mail className="h-4 w-4 mr-1.5" /> {create.isPending ? "Generating…" : "Generate & send link"}</Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
