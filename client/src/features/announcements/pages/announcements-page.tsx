import { useEffect, useState } from "react";
import { motion, LayoutGroup } from "framer-motion";
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

// Live column count for the grid (grid-cols-1 / md:2 / xl:3) so we can repack in JS.
function useGridColumns() {
  const [cols, setCols] = useState(() => {
    if (typeof window === "undefined") return 3;
    if (window.matchMedia("(min-width: 1280px)").matches) return 3;
    if (window.matchMedia("(min-width: 768px)").matches) return 2;
    return 1;
  });
  useEffect(() => {
    const xl = window.matchMedia("(min-width: 1280px)");
    const md = window.matchMedia("(min-width: 768px)");
    const update = () => setCols(xl.matches ? 3 : md.matches ? 2 : 1);
    xl.addEventListener("change", update);
    md.addEventListener("change", update);
    return () => { xl.removeEventListener("change", update); md.removeEventListener("change", update); };
  }, []);
  return cols;
}

// "Grow in place, neighbor drops": when the expanded card can't fit the rest of its row, pull it
// back to the last column where its span fits and push the singles it displaces to just after it —
// so it stays in its row and no vacant cell is left in the middle of the grid.
function repack<T>(items: T[], expandedIdx: number, span: number, cols: number): T[] {
  if (expandedIdx < 0 || cols <= 1 || span <= 1) return items;
  const s = Math.min(span, cols);
  const col = expandedIdx % cols;        // where it naturally lands in its row (all earlier cards are single)
  if (col + s <= cols) return items;     // fits without wrapping — leave order alone
  const bump = col - (cols - s);         // singles in this row to move after the expanded card
  const out = items.slice();
  const [exp] = out.splice(expandedIdx, 1);
  out.splice(expandedIdx - bump, 0, exp);
  return out;
}

// Gentle position-only tween for the reflow. Position-only (not size) means framer never scales the
// card, so text never distorts; a plain easeInOut tween is calmer than a spring (no overshoot/jumping).
const LAYOUT_TWEEN = { duration: 0.4, ease: "easeInOut" as const };

export default function AnnouncementsPage() {
  const { data: auth } = useAuth();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sort, setSort] = useState("latest");
  const [view, setView] = useState<"list" | "grid">("list");
  // Grid: one expanded "main character" card. It widens to 2 cols, or the full row if the content
  // needs more (measured by the card). Opening another card collapses the previous one.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedFull, setExpandedFull] = useState(false);
  const openCard = (id: string) => { setExpandedId((prev) => (prev === id ? null : id)); setExpandedFull(false); };
  const cols = useGridColumns();

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
        // items-stretch keeps collapsed cards equal-height; the expanded card widens via col-span.
        // repack() → CSS `order` (DOM order stays STABLE so framer never loses nodes). `layout="position"`
        // animates POSITION only (never scales → text stays crisp). The cards are near-opaque (see the
        // grid AnnouncementCard) so a neighbour gliding past is cleanly hidden, not seen-through — that
        // see-through was the "overlap", a glass-transparency thing, not a timing thing. zIndex keeps the
        // expanded card on top. LayoutGroup measures them as one.
        (() => {
          const items = paged.pageItems as any[];
          const expIdx = expandedId ? items.findIndex((a) => a.id === expandedId) : -1;
          const span = expandedFull ? cols : 2;
          const arranged = repack(items, expIdx, span, cols);
          const orderById = new Map<string, number>(arranged.map((a: any, i: number) => [a.id, i]));
          return (
            <LayoutGroup>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {items.map((ann: any) => {
                  const isExp = expandedId === ann.id;
                  const spanCls = isExp ? (expandedFull ? "md:col-span-2 xl:col-span-3" : "md:col-span-2") : "";
                  return (
                    <motion.div
                      key={ann.id}
                      layout="position"
                      transition={LAYOUT_TWEEN}
                      style={{ order: orderById.get(ann.id) ?? 0, zIndex: isExp ? 2 : 1 }}
                      className={`${spanCls} min-w-0`}
                    >
                      <AnnouncementCard
                        ann={ann} canManage={canManage} onDelete={(id) => deleteMutation.mutate(id)}
                        author={authorOf(ann.publishedBy)} view="grid"
                        expanded={isExp} full={expandedFull}
                        onToggle={() => openCard(ann.id)}
                        onNeedFull={() => setExpandedFull(true)}
                      />
                    </motion.div>
                  );
                })}
              </div>
            </LayoutGroup>
          );
        })()
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
