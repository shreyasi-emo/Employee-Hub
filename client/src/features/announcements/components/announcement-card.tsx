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

/** Self-contained Read More toggle (list view): shows only when the text is actually clamped. */
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
      <p ref={ref} className={`text-sm text-muted-foreground whitespace-pre-line leading-relaxed ${clamp}`}>{text}</p>
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

export function AnnouncementCard({ ann, canManage, onDelete, author, view = "list", expanded = false, full = false, onToggle, onNeedFull }: {
  ann: any;
  canManage: boolean;
  onDelete: (id: string) => void;
  author?: string | null;
  view?: "list" | "grid";
  // Grid: parent-controlled WIDTH expansion. `expanded` = this is the open card; `full` = it needs
  // the whole row (the 2-col width couldn't fit the text). onNeedFull asks the parent to go full.
  expanded?: boolean;
  full?: boolean;
  onToggle?: () => void;
  onNeedFull?: () => void;
}) {
  const meta = catMeta(ann.category);
  const Icon = meta.icon;
  const isUrgent = ann.priority === "urgent";
  const isExpired = ann.expiresAt && new Date(ann.expiresAt) < new Date();

  // Grid: one card is the "main character" — Read More widens it (2 columns, or the whole row if the
  // text needs more) and neighbours reflow. Collapsed cards share an equal height (grid items-stretch).
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const [truncated, setTruncated] = useState(false);
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el || view !== "grid") return;
    if (!expanded) { setTruncated(el.scrollHeight > el.clientHeight + 1); return; }
    // Expanded at the 2-column width: if the text still overflows ~3 lines, ask for full width.
    if (!full && el.scrollHeight > el.clientHeight + 1) onNeedFull?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ann.content, expanded, full, view]);

  if (view === "grid") {
    // The whole card is the Read More toggle when there's anything to expand/collapse.
    const expandable = truncated || expanded;
    return (
      <Card
        className={`card-hover h-full flex flex-col transition-all duration-300 ${expandable ? "cursor-pointer" : ""} ${isExpired ? "opacity-60" : ""}`}
        // Near-solid (not frosted) so a neighbour gliding past during a reflow is hidden, not seen
        // through — this is what removes the "overlap" during the animation.
        style={{ background: "hsl(var(--card))" }}
        data-testid={`announcement-${ann.id}`}
        onClick={expandable ? onToggle : undefined}
      >
        <CardContent className="p-5 flex flex-col h-full">
          <div className="flex items-start justify-between gap-2 flex-shrink-0">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.tile}`}><Icon className="h-6 w-6" /></div>
            {/* stop the delete menu from also toggling the card */}
            <div onClick={(e) => e.stopPropagation()}>{canManage && <MoreMenu id={ann.id} onDelete={onDelete} />}</div>
          </div>
          <div className="mt-3 flex-shrink-0"><Badges ann={ann} isUrgent={isUrgent} isExpired={isExpired} /></div>
          <h3 className="font-semibold text-foreground mt-1.5 leading-snug line-clamp-2 flex-shrink-0">{ann.title}</h3>
          {/* Collapsed and the 2-col state both clamp to 3 lines (2-col simply fits more per line, so
              no height change); only full width drops the clamp and scrolls if the text is very long. */}
          <p ref={bodyRef} className={`text-sm text-muted-foreground mt-1 whitespace-pre-line leading-relaxed ${expanded && full ? "max-h-[24rem] overflow-y-auto pr-1" : "line-clamp-3"}`}>{ann.content}</p>
          {(truncated || expanded) && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
              className="mt-2 mb-4 flex-shrink-0 self-start inline-flex items-center rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-foreground hover-elevate"
              data-testid={`read-more-${ann.id}`}
            >
              {expanded ? "Show less" : "Read More"}
            </button>
          )}
          <div className="mt-auto pt-3 border-t border-border flex flex-col gap-1.5 text-xs text-muted-foreground flex-shrink-0">
            <span className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 flex-shrink-0" /> {fmtDate(ann.createdAt)}</span>
            {author && <span className="flex items-center gap-2"><User className="h-3.5 w-3.5 flex-shrink-0" /> {author}</span>}
          </div>
        </CardContent>
      </Card>
    );
  }

  // List view — left column = icon + title + date + poster; right column = the message body.
  return (
    <div className={`p-5 flex flex-col lg:flex-row items-start gap-4 ${isExpired ? "opacity-60" : ""}`} data-testid={`announcement-${ann.id}`}>
      {/* LEFT — icon + meta */}
      <div className="flex items-start gap-3 w-full lg:w-72 lg:flex-shrink-0">
        <div className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.tile}`}><Icon className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <Badges ann={ann} isUrgent={isUrgent} isExpired={isExpired} />
          <div className="mt-2.5 space-y-1.5">
            <span className="flex items-center gap-2 text-xs text-muted-foreground"><Calendar className="h-3.5 w-3.5 flex-shrink-0" /> {fmtDate(ann.createdAt)}</span>
            {author && <span className="flex items-center gap-2 text-xs text-muted-foreground"><User className="h-3.5 w-3.5 flex-shrink-0" /> {author}</span>}
          </div>
        </div>
      </div>

      <div className="hidden lg:block w-px self-stretch bg-border" />

      {/* RIGHT — message body */}
      <div className="flex-1 min-w-0 w-full">
        <h3 className="font-semibold text-foreground mt-1 leading-snug">{ann.title}</h3>
        <div className="mt-1">
        <ExpandableText text={ann.content} clampLines={3} testId={`read-more-${ann.id}`} />
        </div>
      </div>
      {canManage && <MoreMenu id={ann.id} onDelete={onDelete} />}
    </div>
  );
}
