import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, isHR } from "@/lib/auth";
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
import { FileText, Plus, ExternalLink, Trash2 } from "lucide-react";
import { format } from "date-fns";

const SECTIONS = [
  { key: "policy", label: "Policies" },
  { key: "calendar", label: "Yearly Calendar" },
  { key: "quality", label: "Quality" },
  { key: "general", label: "General" },
];

function UploadDialog({ open, onOpenChange, defaultSection }: any) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({ section: defaultSection || "policy", title: "", summaryNote: "", fileUrl: "", year: new Date().getFullYear() });

  const upload = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/reference-docs", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/reference-docs"] }); toast({ title: "Uploaded" }); onOpenChange(false); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Upload Reference Document</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Select value={form.section} onValueChange={v => setForm((f: any) => ({ ...f, section: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{SECTIONS.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
          <Input placeholder="Title" value={form.title} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))} />
          <Input placeholder="File URL (Drive link or hosted file)" value={form.fileUrl} onChange={e => setForm((f: any) => ({ ...f, fileUrl: e.target.value }))} />
          <Textarea placeholder="Short summary note for everyone" rows={3} value={form.summaryNote} onChange={e => setForm((f: any) => ({ ...f, summaryNote: e.target.value }))} />
          <Input type="number" placeholder="Year (for calendar)" value={form.year} onChange={e => setForm((f: any) => ({ ...f, year: Number(e.target.value) }))} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => upload.mutate(form)} disabled={upload.isPending || !form.title || !form.fileUrl}>Upload</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ResourcesPage() {
  const { data: auth } = useAuth();
  const canManage = isHR(auth?.user ?? null) || ["super_admin", "office_admin"].includes(auth?.user?.role || "");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("policy");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: docs = [] } = useQuery<any[]>({ queryKey: ["/api/reference-docs"] });

  const del = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/reference-docs/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/reference-docs"] }); toast({ title: "Removed" }); },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-bold">Company Resources</h1>
            <p className="text-sm text-muted-foreground">Policies, the yearly calendar, quality docs</p>
          </div>
        </div>
        {canManage && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Upload</Button>}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>{SECTIONS.map(s => <TabsTrigger key={s.key} value={s.key}>{s.label}</TabsTrigger>)}</TabsList>
        {SECTIONS.map(s => (
          <TabsContent key={s.key} value={s.key} className="space-y-3 mt-4">
            {docs.filter((d: any) => d.section === s.key).length === 0
              ? <Card><CardContent className="p-8 text-center text-muted-foreground">Nothing here yet.</CardContent></Card>
              : docs.filter((d: any) => d.section === s.key).map((d: any) => (
                <Card key={d.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium">{d.title}</h3>
                        {d.year && <Badge variant="outline" className="mt-1">{d.year}</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        <a href={d.fileUrl} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline"><ExternalLink className="h-4 w-4 mr-1" /> Open</Button>
                        </a>
                        {canManage && <Button size="icon" variant="ghost" onClick={() => del.mutate(d.id)}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                    </div>
                    {d.summaryNote && <p className="text-sm text-muted-foreground">{d.summaryNote}</p>}
                    <div className="text-xs text-muted-foreground">Uploaded {format(new Date(d.createdAt), "d MMM yyyy")}</div>
                  </CardContent>
                </Card>
              ))}
          </TabsContent>
        ))}
      </Tabs>

      <UploadDialog open={open} onOpenChange={setOpen} defaultSection={tab} />
    </div>
  );
}
