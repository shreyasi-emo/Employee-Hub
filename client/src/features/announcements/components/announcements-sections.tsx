// The page's own chrome: title bar and the category filter pills.
// Kept beside the page so announcements-page.tsx stays a list of named parts.

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Megaphone, Plus } from "lucide-react";

export function AnnouncementsHeader({ count, canManage, onNew }: {
  count: number; canManage: boolean; onNew: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Announcements</h1>
        <p className="text-sm text-muted-foreground">{count} announcements</p>
      </div>
      {canManage && (
        <Button onClick={onNew} data-testid="button-new-announcement">
          <Plus className="h-4 w-4 mr-2" />
          New Announcement
        </Button>
      )}
    </div>
  );
}

export function CategoryFilterPills({ announcements, categories, value, onChange }: {
  announcements: any[]; categories: any[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      <button
        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${value === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border"}`}
        onClick={() => onChange("all")}
        data-testid="filter-all"
      >
        All ({announcements.length})
      </button>
      {categories.map((cat: any) => (
        <button
          key={cat}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize ${value === cat ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border"}`}
          onClick={() => onChange(cat)}
          data-testid={`filter-${cat}`}
        >
          {cat} ({announcements.filter((a: any) => a.category === cat).length})
        </button>
      ))}
    </div>
  );
}

export function AnnouncementsLoading() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
    </div>
  );
}

export function AnnouncementsEmpty({ canManage }: { canManage: boolean }) {
  return (
    <div className="text-center py-16">
      <Megaphone className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-foreground">No announcements</h3>
      <p className="text-sm text-muted-foreground mt-1">
        {canManage ? "Create your first announcement" : "Check back later"}
      </p>
    </div>
  );
}
