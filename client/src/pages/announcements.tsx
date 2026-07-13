import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, isHR } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, Plus, Trash2, Calendar, Tag } from "lucide-react";
import { format } from "date-fns";

const categoryColors: Record<string, string> = {
  general: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  holiday: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  policy: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  event: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  urgent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  benefits: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
};

function AddAnnouncementDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: "", content: "", category: "general", priority: "normal",
    visibleTo: "all", expiresAt: "",
  });

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/announcements", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/announcements"] });
      toast({ title: "Announcement published" });
      onOpenChange(false);
      setForm({ title: "", content: "", category: "general", priority: "normal", visibleTo: "all", expiresAt: "" });
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
              <Input
                type="date"
                value={form.expiresAt}
                onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                className="mt-1"
              />
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

export default function AnnouncementsPage() {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");

  const { data: announcements = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/announcements"] });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/announcements/${id}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/announcements"] });
      toast({ title: "Announcement deleted" });
    },
  });

  const filtered = categoryFilter === "all"
    ? announcements
    : announcements.filter((a: any) => a.category === categoryFilter);

  const categories = Array.from(new Set(announcements.map((a: any) => a.category)));

  const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
  const sorted = [...filtered].sort((a, b) =>
    (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2) ||
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Announcements</h1>
          <p className="text-sm text-muted-foreground">{announcements.length} announcements</p>
        </div>
        {isHR(user!) && (
          <Button onClick={() => setShowAdd(true)} data-testid="button-new-announcement">
            <Plus className="h-4 w-4 mr-2" />
            New Announcement
          </Button>
        )}
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${categoryFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border"}`}
          onClick={() => setCategoryFilter("all")}
          data-testid="filter-all"
        >
          All ({announcements.length})
        </button>
        {categories.map((cat: any) => (
          <button
            key={cat}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize ${categoryFilter === cat ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border"}`}
            onClick={() => setCategoryFilter(cat)}
            data-testid={`filter-${cat}`}
          >
            {cat} ({announcements.filter((a: any) => a.category === cat).length})
          </button>
        ))}
      </div>

      {/* Announcements List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16">
          <Megaphone className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground">No announcements</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {isHR(user!) ? "Create your first announcement" : "Check back later"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sorted.map((ann: any) => {
            const catColor = categoryColors[ann.category] || categoryColors.general;
            const isUrgent = ann.priority === "urgent";
            const isExpired = ann.expiresAt && new Date(ann.expiresAt) < new Date();

            return (
              <Card
                key={ann.id}
                className={`hover-elevate ${isUrgent ? "border-red-200 dark:border-red-800/30" : ""} ${isExpired ? "opacity-60" : ""}`}
                data-testid={`announcement-${ann.id}`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isUrgent ? "bg-red-100 dark:bg-red-900/20" : "bg-primary/10"}`}>
                        <Megaphone className={`h-5 w-5 ${isUrgent ? "text-red-600 dark:text-red-400" : "text-primary"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground leading-snug">{ann.title}</h3>
                          <Badge className={`text-xs capitalize flex-shrink-0 ${catColor}`}>{ann.category}</Badge>
                          {isUrgent && (
                            <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 text-xs">Urgent</Badge>
                          )}
                          {isExpired && <Badge variant="outline" className="text-xs">Expired</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mt-2 whitespace-pre-line leading-relaxed">{ann.content}</p>
                        <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(ann.createdAt), "MMM d, yyyy 'at' h:mm a")}
                          </span>
                          {ann.visibleTo && ann.visibleTo !== "all" && (
                            <span className="flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              Visible to: {ann.visibleTo}
                            </span>
                          )}
                          {ann.expiresAt && (
                            <span>
                              Expires: {format(new Date(ann.expiresAt), "MMM d, yyyy")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {isHR(user!) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground flex-shrink-0"
                        onClick={() => deleteMutation.mutate(ann.id)}
                        data-testid={`button-delete-announcement-${ann.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AddAnnouncementDialog open={showAdd} onOpenChange={setShowAdd} />
    </div>
  );
}
