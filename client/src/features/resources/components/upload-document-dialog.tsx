import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { SECTIONS } from "../lib/sections";
import { useUploadReferenceDoc } from "../api/reference-docs.api";

export function UploadDocumentDialog({ open, onOpenChange, defaultSection }: any) {
  const { toast } = useToast();
  const [form, setForm] = useState<any>({ section: defaultSection || "policy", title: "", summaryNote: "", fileUrl: "", year: new Date().getFullYear() });

  const upload = useUploadReferenceDoc({
    onSuccess: () => { toast({ title: "Uploaded" }); onOpenChange(false); },
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
