import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateInput } from "@/components/shared/datetime-field";
import { useToast } from "@/hooks/use-toast";
import { categoryColors } from "../lib/categories";
import { useCreateAnnouncement } from "../api/announcements.api";

const BLANK = {
  title: "", content: "", category: "general", priority: "normal",
  visibleTo: "all", expiresAt: "",
};

export function AddAnnouncementDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ ...BLANK });

  const mutation = useCreateAnnouncement({
    onSuccess: () => {
      toast({ title: "Announcement published" });
      onOpenChange(false);
      setForm({ ...BLANK });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Announcement</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Title *</label>
            <Input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Announcement title..."
              className="mt-1"
              data-testid="input-announcement-title"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Content *</label>
            <Textarea
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Full announcement content..."
              rows={4}
              className="mt-1"
              data-testid="textarea-announcement-content"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Category</label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="mt-1" data-testid="select-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(categoryColors).map(c => (
                    <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Priority</label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Visible To</label>
              <Select value={form.visibleTo} onValueChange={v => setForm(f => ({ ...f, visibleTo: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  <SelectItem value="hr">HR Team</SelectItem>
                  <SelectItem value="finance">Finance Team</SelectItem>
                  <SelectItem value="management">Management</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Expires At</label>
              <div className="mt-1">
                <DateInput value={form.expiresAt} onChange={v => setForm(f => ({ ...f, expiresAt: v }))} />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              onClick={() => mutation.mutate({
                ...form,
                expiresAt: form.expiresAt || undefined,
              })}
              disabled={mutation.isPending || !form.title || !form.content}
              data-testid="button-submit-announcement"
            >
              {mutation.isPending ? "Publishing..." : "Publish Announcement"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
