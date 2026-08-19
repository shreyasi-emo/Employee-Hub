import { useState } from "react";
import { useAuth, isHR } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { FileText, Plus, ExternalLink, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { SECTIONS } from "../lib/sections";
import { useReferenceDocs, useDeleteReferenceDoc } from "../api/reference-docs.api";
import { UploadDocumentDialog } from "../components/upload-document-dialog";

export default function ResourcesPage() {
  const { data: auth } = useAuth();
  const canManage = isHR(auth?.user ?? null) || ["super_admin", "office_admin"].includes(auth?.user?.role || "");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("policy");
  const { toast } = useToast();

  const { data: docs = [] } = useReferenceDocs();
  const del = useDeleteReferenceDoc({ onSuccess: () => toast({ title: "Removed" }) });

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

      <UploadDocumentDialog open={open} onOpenChange={setOpen} defaultSection={tab} />
    </div>
  );
}
