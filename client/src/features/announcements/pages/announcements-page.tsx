import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth, isHR } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAnnouncements, useDeleteAnnouncement } from "../api/announcements.api";
import {
  AnnouncementsHeader, AnnouncementStats, AnnouncementsToolbar,
  AnnouncementsLoading, AnnouncementsEmpty,
} from "../components/announcements-sections";
import { AnnouncementCard } from "../components/announcement-card";
import { AddAnnouncementDialog } from "../components/add-announcement-dialog";
import { usePaged } from "@/components/shared/pagination";

export default function AnnouncementsPage() {
  const { data: auth } = useAuth();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sort, setSort] = useState("latest");
  const [view, setView] = useState<"list" | "grid">("list");

  const { data: announcements = [], isLoading } = useAnnouncements();
  const deleteMutation = useDeleteAnnouncement({ onSuccess: () => toast({ title: "Announcement deleted" }) });

  // Resolve the author (publishedBy is a user id → employee name + department; omitted if not resolvable).
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"], enabled: !!auth?.user });
  const { data: departments = [] } = useQuery<any[]>({ queryKey: ["/api/departments"], enabled: !!auth?.user });
  const authorOf = (publishedBy?: string) => {
    if (!publishedBy) return null;
    const emp = (employees as any[]).find((e) => e.userId === publishedBy);
    if (!emp) return null;
    const dept = (departments as any[]).find((d) => d.id === emp.departmentId)?.name;
    return `${emp.firstName} ${emp.lastName}${dept ? ` (${dept})` : ""}`;
  };

  const canManage = isHR(auth?.user ?? null);
  const categories = Array.from(new Set((announcements as any[]).map((a) => a.category).filter(Boolean))) as string[];

  const visible = categoryFilter === "all"
    ? (announcements as any[])
    : (announcements as any[]).filter((a) => a.category === categoryFilter);

  const sorted = [...visible].sort((a, b) => {
    const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return sort === "oldest" ? -diff : diff;
  });

  const paged = usePaged(sorted);
  const first = sorted.length === 0 ? 0 : (paged.page - 1) * paged.size + 1;
  const last = Math.min(paged.page * paged.size, sorted.length);

  return (
    <div className="p-6 space-y-6 max-w-[92rem] mx-auto">
      <AnnouncementsHeader canManage={canManage} onNew={() => setShowAdd(true)} />

      <AnnouncementStats announcements={announcements as any[]} categories={categories} />

      <AnnouncementsToolbar
        announcements={announcements as any[]}
        categories={categories}
        categoryFilter={categoryFilter}
        onCategory={setCategoryFilter}
        sort={sort}
        onSort={setSort}
        view={view}
        onView={setView}
      />

      {isLoading ? (
        <AnnouncementsLoading />
      ) : sorted.length === 0 ? (
        <AnnouncementsEmpty canManage={canManage} />
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paged.pageItems.map((ann: any) => (
            <AnnouncementCard key={ann.id} ann={ann} canManage={canManage} onDelete={(id) => deleteMutation.mutate(id)} author={authorOf(ann.publishedBy)} view="grid" />
          ))}
        </div>
      ) : (
        <Card className="border-0">
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {paged.pageItems.map((ann: any) => (
                <AnnouncementCard key={ann.id} ann={ann} canManage={canManage} onDelete={(id) => deleteMutation.mutate(id)} author={authorOf(ann.publishedBy)} view="list" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer — count summary + pager (matches the reference). */}
      {!isLoading && sorted.length > 0 && (
        <div className="flex items-center justify-between gap-3 pt-1 text-sm text-muted-foreground">
          <span className="tabular-nums">Showing {first} to {last} of {sorted.length} announcement{sorted.length !== 1 ? "s" : ""}</span>
          {paged.totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={paged.page <= 1} onClick={() => paged.setPage(paged.page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
              <span className="px-2 tabular-nums text-foreground font-medium">{paged.page}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={paged.page >= paged.totalPages} onClick={() => paged.setPage(paged.page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </div>
      )}

      <AddAnnouncementDialog open={showAdd} onOpenChange={setShowAdd} />
    </div>
  );
}
