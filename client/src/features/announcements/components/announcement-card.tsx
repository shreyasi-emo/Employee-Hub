import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar, User, Trash2, MoreVertical } from "lucide-react";
import { format } from "date-fns";
import { categoryColors, catMeta, URGENT_TINT } from "../lib/categories";

const fmtDate = (d: any) => `${format(new Date(d), "MMM d, yyyy")} | ${format(new Date(d), "h:mm a")}`;

/** Announcement body with a Read More toggle that appears ONLY when the text is actually
 *  clamped/overflowing. Measures the rendered height against the clamp and re-checks on resize;
 *  clicking expands the full text inline (and back). */
function ExpandableText({ text, clampLines, testId }: { text: string; clampLines: 2 | 3; testId: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);

  const measure = () => {
    const el = ref.current;
    if (el && !expanded) setTruncated(el.scrollHeight > el.clientHeight + 1);
  };
  useLayoutEffect(measure, [text, expanded, clampLines]);
  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const clamp = expanded ? "" : clampLines === 3 ? "line-clamp-3" : "line-clamp-2";
  return (
    <>
      <p ref={ref} className={`text-sm text-muted-foreground mt-1 whitespace-pre-line leading-relaxed ${clamp}`}>{text}</p>
      {(truncated || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-2 inline-flex items-center rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-foreground hover-elevate"
          data-testid={testId}
        >
          {expanded ? "Show less" : "Read More"}
        </button>
      )}
    </>
  );
}

function MoreMenu({ id, onDelete }: { id: string; onDelete: (id: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground flex-shrink-0" data-testid={`announcement-menu-${id}`}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          className="text-[#FF6F62] focus:text-[#FF6F62]"
          onClick={() => { if (window.confirm("Delete this announcement?")) onDelete(id); }}
          data-testid={`button-delete-announcement-${id}`}
        >
          <Trash2 className="h-4 w-4 mr-2" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Badges({ ann, isUrgent, isExpired }: { ann: any; isUrgent: boolean; isExpired: boolean }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Badge className={`text-[10px] uppercase tracking-wide font-semibold border-0 ${categoryColors[ann.category] || categoryColors.general}`}>{ann.category}</Badge>
      {isUrgent && <Badge className={`text-[10px] uppercase tracking-wide font-semibold border-0 ${URGENT_TINT}`}>Urgent</Badge>}
      {isExpired && <Badge variant="outline" className="text-[10px]">Expired</Badge>}
    </div>
  );
}

export function AnnouncementCard({ ann, canManage, onDelete, author, view = "list" }: {
  ann: any;
  canManage: boolean;
  onDelete: (id: string) => void;
  author?: string | null;
  view?: "list" | "grid";
}) {
  const meta = catMeta(ann.category);
  const Icon = meta.icon;
  const isUrgent = ann.priority === "urgent";
  const isExpired = ann.expiresAt && new Date(ann.expiresAt) < new Date();

  if (view === "grid") {
    return (
      <Card className={`card-hover h-full ${isExpired ? "opacity-60" : ""}`} data-testid={`announcement-${ann.id}`}>
        <CardContent className="p-5 flex flex-col h-full">
          <div className="flex items-start justify-between gap-2">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.tile}`}><Icon className="h-6 w-6" /></div>
            {canManage && <MoreMenu id={ann.id} onDelete={onDelete} />}
          </div>
          <div className="mt-3"><Badges ann={ann} isUrgent={isUrgent} isExpired={isExpired} /></div>
          <h3 className="font-semibold text-foreground mt-1.5 leading-snug">{ann.title}</h3>
          <div className="flex-1"><ExpandableText text={ann.content} clampLines={3} testId={`read-more-${ann.id}`} /></div>
          <div className="mt-3 pt-3 border-t border-border flex flex-col gap-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 flex-shrink-0" /> {fmtDate(ann.createdAt)}</span>
            {author && <span className="flex items-center gap-2"><User className="h-3.5 w-3.5 flex-shrink-0" /> {author}</span>}
          </div>
        </CardContent>
      </Card>
    );
  }

  // List view — a flush row for the divide-y container.
  return (
    <div className={`p-5 flex items-start gap-4 ${isExpired ? "opacity-60" : ""}`} data-testid={`announcement-${ann.id}`}>
      <div className={`h-14 w-14 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.tile}`}><Icon className="h-6 w-6" /></div>

      <div className="flex-1 min-w-0">
        <Badges ann={ann} isUrgent={isUrgent} isExpired={isExpired} />
        <h3 className="font-semibold text-foreground mt-1.5 leading-snug">{ann.title}</h3>
        <ExpandableText text={ann.content} clampLines={2} testId={`read-more-${ann.id}`} />
      </div>

      <div className="hidden lg:block w-px self-stretch bg-border" />

      <div className="hidden lg:flex flex-col gap-2.5 w-52 flex-shrink-0 pt-0.5">
        <span className="flex items-center gap-2 text-xs text-muted-foreground"><Calendar className="h-3.5 w-3.5 flex-shrink-0" /> {fmtDate(ann.createdAt)}</span>
        {author && <span className="flex items-center gap-2 text-xs text-muted-foreground"><User className="h-3.5 w-3.5 flex-shrink-0" /> {author}</span>}
      </div>

      {canManage && <MoreMenu id={ann.id} onDelete={onDelete} />}
    </div>
  );
}
