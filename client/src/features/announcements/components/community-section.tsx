import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Cake, PartyPopper, Heart, Plus, Users, Share2 } from "lucide-react";
import { AnnouncementCard } from "./announcement-card";

// A celebration to offer HR/Admin a one-tap "Share to Community" post.
type Celebration = { emp: any; type: "birthday" | "anniversary"; when: "today" | "tomorrow"; years?: number };

function computeCelebrations(employees: any[]): Celebration[] {
  const now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const key = (d: Date) => `${d.getMonth()}-${d.getDate()}`;
  const todayKey = key(now), tomKey = key(tomorrow);
  const out: Celebration[] = [];
  for (const e of employees as any[]) {
    if (e.employmentStatus === "exited") continue;
    if (e.dateOfBirth) {
      const k = key(new Date(e.dateOfBirth));
      if (k === todayKey) out.push({ emp: e, type: "birthday", when: "today" });
      else if (k === tomKey) out.push({ emp: e, type: "birthday", when: "tomorrow" });
    }
    if (e.joinDate) {
      const j = new Date(e.joinDate); const k = key(j);
      if (k === todayKey) { const years = now.getFullYear() - j.getFullYear(); if (years >= 1) out.push({ emp: e, type: "anniversary", when: "today", years }); }
      else if (k === tomKey) { const years = tomorrow.getFullYear() - j.getFullYear(); if (years >= 1) out.push({ emp: e, type: "anniversary", when: "tomorrow", years }); }
    }
  }
  // Today before tomorrow; birthdays before anniversaries.
  return out.sort((a, b) => (a.when === b.when ? a.type.localeCompare(b.type) : a.when === "today" ? -1 : 1));
}

export function celebrationDraft(c: Celebration): { title: string; content: string; category: string } {
  const name = `${c.emp.firstName} ${c.emp.lastName}`.trim();
  if (c.type === "birthday") {
    return { category: "birthday", title: `Happy Birthday, ${c.emp.firstName}! 🎉`, content: `Wishing ${name} a very happy birthday! 🎂 Drop your wishes below.` };
  }
  const y = c.years || 1;
  return { category: "anniversary", title: `${y} year${y !== 1 ? "s" : ""} with us — congrats, ${c.emp.firstName}! 🎉`, content: `${name} completes ${y} year${y !== 1 ? "s" : ""} with us. Thank you for everything you do! 👏` };
}

// Community lives BELOW the announcements list on the same page. It shows all community posts;
// HR/Admin (and granted posters) also get a "celebrations to share" prompt + New Post. It renders
// nothing for a plain viewer when there are no community posts.
export function CommunitySection({ posts, employees, meId, canPost, isHrUser, authorOf, canRemove, onReact, onDelete, onNewPost, onShare, onManageContributors }: {
  posts: any[];
  employees: any[];
  meId?: string;
  canPost: boolean;
  isHrUser: boolean;
  authorOf: (publishedBy?: string) => string | null;
  canRemove: (ann: any) => boolean;
  onReact: (id: string, emoji: string) => void;
  onDelete: (id: string) => void;
  onNewPost: () => void;
  onShare: (draft: { title: string; content: string; category: string }) => void;
  onManageContributors: () => void;
}) {
  const celebrations = canPost ? computeCelebrations(employees) : [];
  // Hidden entirely for viewers with nothing to see; posters always get the section (their entry point).
  if (posts.length === 0 && !canPost) return null;

  const sorted = [...posts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <section id="community" className="space-y-4 pt-4 border-t border-border">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2"><Heart className="h-5 w-5 text-[#0E7C7B]" /> Community</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Birthdays, work anniversaries and team moments.</p>
        </div>
        {canPost && (
          <div className="flex items-center gap-2 flex-wrap">
            {isHrUser && (
              <Button variant="secondary" onClick={onManageContributors} data-testid="button-manage-contributors">
                <Users className="h-4 w-4 mr-2" /> Manage contributors
              </Button>
            )}
            <Button className="btn-primary-gradient" onClick={onNewPost} data-testid="button-new-community">
              <Plus className="h-4 w-4 mr-2" /> New Post
            </Button>
          </div>
        )}
      </div>

      {/* HR/Admin nudge: today's & tomorrow's celebrations, each shareable to Community in one tap. */}
      {canPost && celebrations.length > 0 && (
        <Card className="border-0">
          <CardContent className="p-4 space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Celebrations to share</p>
            <div className="space-y-2">
              {celebrations.map((c) => {
                const Icon = c.type === "birthday" ? Cake : PartyPopper;
                const label = c.type === "birthday"
                  ? `Birthday ${c.when}`
                  : `${c.years}-year anniversary ${c.when}`;
                return (
                  <div key={`${c.emp.id}-${c.type}`} className="flex items-center gap-3 rounded-xl border border-border/60 p-2.5" data-testid={`celebration-${c.emp.id}-${c.type}`}>
                    <div className="h-9 w-9 rounded-lg bg-[#4BDCD9]/25 text-[#0E7C7B] flex items-center justify-center flex-shrink-0"><Icon className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{c.emp.firstName} {c.emp.lastName}</p>
                      <p className="text-xs text-muted-foreground capitalize">{label}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-9 btn-glass text-[#206295] hover:text-[#206295] flex-shrink-0" onClick={() => onShare(celebrationDraft(c))} data-testid={`share-${c.emp.id}-${c.type}`}>
                      <Share2 className="h-4 w-4 mr-1.5" /> Share
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {sorted.length > 0 ? (
        <Card className="border-0">
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {sorted.map((ann: any) => (
                <AnnouncementCard key={ann.id} ann={ann} canManage={canRemove(ann)} onDelete={onDelete} author={authorOf(ann.publishedBy)} view="list" meId={meId} onReact={onReact} />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground py-2">No community posts yet.{canPost ? " Share a celebration above or start a new post." : ""}</p>
      )}
    </section>
  );
}
