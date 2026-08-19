import { useState } from "react";
import { useAuth, isHR } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { priorityOrder } from "../lib/categories";
import { useAnnouncements, useDeleteAnnouncement } from "../api/announcements.api";
import {
  AnnouncementsHeader, CategoryFilterPills, AnnouncementsLoading, AnnouncementsEmpty,
} from "../components/announcements-sections";
import { AnnouncementCard } from "../components/announcement-card";
import { AddAnnouncementDialog } from "../components/add-announcement-dialog";

export default function AnnouncementsPage() {
  const { data: auth } = useAuth();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");

  const { data: announcements = [], isLoading } = useAnnouncements();
  const deleteMutation = useDeleteAnnouncement({ onSuccess: () => toast({ title: "Announcement deleted" }) });

  const canManage = isHR(auth?.user ?? null);
  const categories = Array.from(new Set(announcements.map((a: any) => a.category)));

  const visible = categoryFilter === "all"
    ? announcements
    : announcements.filter((a: any) => a.category === categoryFilter);

  // Urgent first, then newest.
  const sorted = [...visible].sort((a, b) =>
    (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2) ||
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <AnnouncementsHeader count={announcements.length} canManage={canManage} onNew={() => setShowAdd(true)} />

      <CategoryFilterPills
        announcements={announcements}
        categories={categories}
        value={categoryFilter}
        onChange={setCategoryFilter}
      />

      {isLoading ? (
        <AnnouncementsLoading />
      ) : sorted.length === 0 ? (
        <AnnouncementsEmpty canManage={canManage} />
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
