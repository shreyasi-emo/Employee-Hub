import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateInput } from "@/components/shared/datetime-field";
import { useToast } from "@/hooks/use-toast";
import { ANNOUNCEMENT_CATEGORIES, COMMUNITY_CATEGORIES } from "../lib/categories";
import { useCreateAnnouncement } from "../api/announcements.api";
import { prettyLabel } from "@/lib/format";

const cap = prettyLabel;   // acronym-aware (HR / IT)
const blankFor = (kind: "announcement" | "community") => ({
  title: "", content: "",
  category: kind === "community" ? "community" : "general",
  priority: "normal", visibleTo: "all", expiresAt: "",
});

// Same composer for both feeds. Community posts drop priority / audience / expiry (they don't apply)
// and offer the community category set; permission to open this is enforced by the caller + server.
// `initial` pre-fills the form (used by the "Share to Community" celebration buttons).
export function AddAnnouncementDialog({ open, onOpenChange, kind = "announcement", initial }: {
  open: boolean; onOpenChange: (v: boolean) => void; kind?: "announcement" | "community";
  initial?: Partial<{ title: string; content: string; category: string }>;
}) {
  const { toast } = useToast();
  const isCommunity = kind === "community";
  const [form, setForm] = useState(() => ({ ...blankFor(kind), ...initial }));
  const categories = isCommunity ? COMMUNITY_CATEGORIES : ANNOUNCEMENT_CATEGORIES;

  // Re-seed the form each time the dialog opens so a fresh compose (or a new Share draft) starts clean.
  useEffect(() => {
    if (open) setForm({ ...blankFor(kind), ...initial });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind]);

  const mutation = useCreateAnnouncement({
    onSuccess: () => {
      toast({ title: isCommunity ? "Community post published" : "Announcement published" });
      onOpenChange(false);
      setForm(blankFor(kind));
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isCommunity ? "Create Community Post" : "Create Announcement"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Title *</label>
            <Input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder={isCommunity ? "e.g. Happy Birthday, Asha!" : "Announcement title..."}
              className="mt-1"
              data-testid="input-announcement-title"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Content *</label>
            <Textarea
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder={isCommunity ? "Share a message for the team..." : "Full announcement content..."}
              rows={4}
              className="mt-1"
              data-testid="textarea-announcement-content"
            />
          </div>
          {isCommunity ? (
            <div>
              <label className="text-sm font-medium">Category</label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="mt-1" data-testid="select-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c} value={c} className="capitalize">{cap(c)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger className="mt-1" data-testid="select-category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map(c => <SelectItem key={c} value={c} className="capitalize">{cap(c)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Priority</label>
                  <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
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
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
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
            </>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              onClick={() => mutation.mutate({
                ...form,
                kind,
                expiresAt: form.expiresAt || undefined,
              })}
              disabled={mutation.isPending || !form.title || !form.content}
              data-testid="button-submit-announcement"
            >
              {mutation.isPending ? "Publishing..." : isCommunity ? "Publish Post" : "Publish Announcement"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
