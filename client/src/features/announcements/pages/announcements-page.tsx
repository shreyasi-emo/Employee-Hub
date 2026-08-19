import { useState } from "react";
import { useAuth, isHR } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, Plus } from "lucide-react";
import { priorityOrder } from "../lib/categories";
import { useAnnouncements, useDeleteAnnouncement } from "../api/announcements.api";
import { AddAnnouncementDialog } from "../components/add-announcement-dialog";
import { AnnouncementCard } from "../components/announcement-card";

export default function AnnouncementsPage() {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");

  const { data: announcements = [], isLoading } = useAnnouncements();
  const deleteMutation = useDeleteAnnouncement({ onSuccess: () => toast({ title: "Announcement deleted" }) });

  const canManage = isHR(user!);

  const filtered = categoryFilter === "all"
    ? announcements
    : announcements.filter((a: any) => a.category === categoryFilter);

  const categories = Array.from(new Set(announcements.map((a: any) => a.category)));

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
        {canManage && (
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
            {canManage ? "Create your first announcement" : "Check back later"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sorted.map((ann: any) => (
            <AnnouncementCard key={ann.id} ann={ann} canManage={canManage} onDelete={(id) => deleteMutation.mutate(id)} />
          ))}
        </div>
      )}

      <AddAnnouncementDialog open={showAdd} onOpenChange={setShowAdd} />
    </div>
  );
}
