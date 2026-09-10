import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCommunityContributors, useSetContributor } from "../api/announcements.api";

// HR/Admin surface: grant/revoke individual employees the right to post in Community.
// HR/Admin themselves are always allowed (toggle shown as a fixed "Always" badge).
export function ManageContributorsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const { data: rows = [], isLoading } = useCommunityContributors(open);
  const setContributor = useSetContributor();

  const term = q.trim().toLowerCase();
  const list = (rows as any[]).filter((r) => !term || `${r.name} ${r.email || ""}`.toLowerCase().includes(term));

  const toggle = (r: any, next: boolean) => {
    setContributor.mutate({ userId: r.userId, canPost: next }, {
      onSuccess: () => toast({ title: next ? `${r.name} can now post` : `Removed posting for ${r.name}` }),
      onError: (e: any) => toast({ title: "Couldn't update", description: e.message, variant: "destructive" }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Community contributors</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Choose who can publish Community posts. HR and Admins can always post.</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people…" className="pl-9 h-9" data-testid="input-contributor-search" />
          </div>
          <ScrollArea className="h-72 rounded-[12px] border border-border">
            {isLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Loading…</p>
            ) : list.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No one matches your search.</p>
            ) : (
              <ul className="divide-y divide-border">
                {list.map((r) => (
                  <li key={r.userId} className="flex items-center gap-3 px-3 py-2" data-testid={`contributor-${r.userId}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                      {r.email && <p className="text-xs text-muted-foreground truncate">{r.email}</p>}
                    </div>
                    {r.alwaysAllowed ? (
                      <Badge className="text-[10px] bg-[#4BDCD9]/25 text-[#0E7C7B] flex-shrink-0">Always</Badge>
                    ) : (
                      <Switch
                        checked={!!r.granted}
                        disabled={setContributor.isPending}
                        onCheckedChange={(v) => toggle(r, v)}
                        data-testid={`toggle-contributor-${r.userId}`}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
