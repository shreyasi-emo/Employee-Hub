import { formatDate } from "../shared/request-format";
import { DRAFT_META, draftTitle, draftAmount, type Draft } from "../shared/drafts";
import { colDivider } from "./request-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Send, Trash2, FileText, CalendarClock, Pencil } from "lucide-react";

export function DraftCard({ draft, onEdit, onDelete, onSubmit, submitting }: { draft: Draft; onEdit: (d: Draft) => void; onDelete: (d: Draft) => void; onSubmit: (d: Draft) => void; submitting: boolean }) {
  const meta = DRAFT_META[draft.type] || { label: draft.type, icon: FileText };
  const Icon = meta.icon;
  const amt = draftAmount(draft);
  return (
    <Card className="border-0 hover-elevate" data-testid={`draft-${draft.id}`}>
      <CardContent className="p-[17px]">
        <div className="flex flex-col lg:flex-row lg:items-stretch gap-3 lg:gap-0">
          {/* Identity */}
          <div className="flex-1 min-w-0 flex items-start gap-3 lg:pr-5">
            <div className="h-8 w-8 rounded-lg bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0 mt-1">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">DRAFT</Badge>
              <h3 className="text-[22px] leading-tight font-semibold text-foreground tracking-tight truncate mt-1">{draftTitle(draft)}</h3>
            </div>
          </div>

          {colDivider}
          {/* Category */}
          <div className="w-full lg:w-[176px] flex-shrink-0 lg:px-5 flex flex-col justify-end">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1.5 whitespace-nowrap">Category</p>
            <p className="text-sm font-semibold text-foreground mt-1.5">{meta.label}</p>
          </div>

          {colDivider}
          {/* Saved on */}
          <div className="w-full lg:w-[176px] flex-shrink-0 lg:px-5 flex flex-col justify-end">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1.5 whitespace-nowrap">Saved On</p>
            <p className="text-sm font-semibold text-foreground mt-1.5">{formatDate(new Date(draft.savedAt).toISOString())}</p>
          </div>

          {colDivider}
          {/* Amount */}
          <div className="w-full lg:w-[188px] flex-shrink-0 lg:px-5 flex flex-col justify-end items-start lg:items-end text-left lg:text-right">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">Amount</p>
            {amt > 0
              ? <p className="text-2xl font-bold text-[#206295] tracking-tight tabular-nums mt-1.5"><span className="font-semibold mr-0.5">₹</span>{amt.toLocaleString("en-IN")}</p>
              : <p className="text-2xl font-bold text-muted-foreground/50 mt-1.5">—</p>}
          </div>

          {colDivider}
          {/* Actions */}
          <div className="flex items-center gap-2 pl-5 flex-shrink-0">
            <Button size="sm" variant="ghost" className="btn-glass text-[#206295] hover:text-[#206295]" onClick={() => onEdit(draft)} data-testid={`draft-edit-${draft.id}`}><Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit</Button>
            <Button size="sm" className="btn-primary-gradient" disabled={submitting} onClick={() => onSubmit(draft)} data-testid={`draft-submit-${draft.id}`}><Send className="h-3.5 w-3.5 mr-1.5" /> Submit</Button>
            <Button size="sm" variant="ghost" className="text-[#FF6F62] hover:text-[#FF6F62]" onClick={() => onDelete(draft)} data-testid={`draft-delete-${draft.id}`}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
