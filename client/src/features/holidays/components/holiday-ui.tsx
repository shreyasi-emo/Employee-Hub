// Presentational pieces for the holidays screen.
//
// NOTE: this StatCard is deliberately NOT the one in features/attendance —
// it truncates the value and wraps `subtitle` in its own <p>, where attendance's
// takes a ReactNode subtitle. Unifying the app's six StatCard variants is a
// separate deliberate pass; merging them here would change markup.

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Pencil, MapPin } from "lucide-react";
import { format } from "date-fns";

export function StatCard({ title, value, subtitle, icon: Icon, color }: { title: string; value: any; subtitle?: string; icon: any; color: string; }) {
  return (
    <Card className="border-0 card-hover"><CardContent className="p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 flex-1 min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-[33px] leading-tight font-bold text-foreground truncate">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-xl flex-shrink-0 ${color}`}><Icon className="h-5 w-5" /></div>
      </div>
    </CardContent></Card>
  );
}

export function HolidayCard({ h, canManage, onEdit, onDelete }: { h: any; canManage: boolean; onEdit: (h: any) => void; onDelete: (h: any) => void; }) {
  const date = new Date(h.date);
  return (
    <Card className="border-0 card-hover" data-testid={`holiday-${h.id}`}><CardContent className="p-4">
      <div className="flex items-start gap-4">
        <div className={`w-12 flex-shrink-0 rounded-[12px] py-1.5 text-center ${h.isOptional ? "bg-[#FF6F62]/20 text-[#FF6F62]" : "bg-[#206295]/15 text-[#206295]"}`}>
          <p className="text-lg font-bold leading-tight">{format(date, "d")}</p>
          <p className="text-[10px] uppercase tracking-wide">{format(date, "MMM")}</p>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground">{h.name}</p>
              <p className="text-xs text-muted-foreground">{format(date, "EEEE, MMMM d, yyyy")}</p>
            </div>
            {canManage && (
              <div className="flex gap-1.5 flex-shrink-0">
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onEdit(h)} aria-label="Edit" data-testid={`button-edit-holiday-${h.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="outline" className="h-7 w-7 text-[#FF6F62] border-[#FF6F62]/30" onClick={() => onDelete(h)} aria-label="Delete" data-testid={`button-delete-holiday-${h.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Badge className={`text-xs ${h.isOptional ? "bg-[#FF6F62]/20 text-[#FF6F62]" : "bg-[#4BDCD9]/25 text-[#206295]"}`}>{h.isOptional ? "Optional" : "Mandatory"}</Badge>
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {h.location === "all" ? "All locations" : h.location}</span>
          </div>
          {h.description && <p className="text-xs text-muted-foreground mt-1.5">{h.description}</p>}
        </div>
      </div>
    </CardContent></Card>
  );
}
