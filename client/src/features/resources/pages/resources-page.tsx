import { useState } from "react";
import { useAuth, isHR } from "@/lib/auth";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { SECTIONS } from "../lib/sections";
import { useReferenceDocs, useDeleteReferenceDoc } from "../api/reference-docs.api";
import { ResourcesHeader, DocumentList } from "../components/resources-sections";
import { UploadDocumentDialog } from "../components/upload-document-dialog";

export default function ResourcesPage() {
  const { data: auth } = useAuth();
  const { toast } = useToast();
  const canManage = isHR(auth?.user ?? null) || ["super_admin", "office_admin"].includes(auth?.user?.role || "");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("policy");

  const { data: docs = [] } = useReferenceDocs();
  const del = useDeleteReferenceDoc({ onSuccess: () => toast({ title: "Removed" }) });

  return (
    <div className="p-6 space-y-6">
      <ResourcesHeader canManage={canManage} onUpload={() => setOpen(true)} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>{SECTIONS.map(s => <TabsTrigger key={s.key} value={s.key}>{s.label}</TabsTrigger>)}</TabsList>
        {SECTIONS.map(s => (
          <TabsContent key={s.key} value={s.key} className="space-y-3 mt-4">
            <DocumentList
              docs={docs.filter((d: any) => d.section === s.key)}
              canManage={canManage}
              onDelete={(id) => del.mutate(id)}
            />
          </TabsContent>
        ))}
      </Tabs>

      <UploadDocumentDialog open={open} onOpenChange={setOpen} defaultSection={tab} />
    </div>
  );
}
