import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useCreateOnboardingTemplate } from "../api/onboarding.api";

const BLANK = { name: "", description: "", isDefault: false };

export function TemplateFormDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState(BLANK);
  const close = () => { setForm(BLANK); onClose(); };

  const create = useCreateOnboardingTemplate({
    onSuccess: () => { toast({ title: "Template created" }); close(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent>
        <DialogHeader><DialogTitle>New Onboarding Template</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Template Name *</label>
            <Input value={form.name} onChange={(e) => setForm((t) => ({ ...t, name: e.target.value }))} className="mt-1" placeholder="e.g. Standard Onboarding" data-testid="input-template-name" />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Input value={form.description} onChange={(e) => setForm((t) => ({ ...t, description: e.target.value }))} className="mt-1" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((t) => ({ ...t, isDefault: e.target.checked }))} />
            <span className="text-sm">Set as default template</span>
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button onClick={() => create.mutate(form)} disabled={create.isPending || !form.name} data-testid="button-create-template">
              {create.isPending ? "Creating..." : "Create Template"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
