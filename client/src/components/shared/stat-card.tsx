import { Card, CardContent } from "@/components/ui/card";

/**
 * Headline number card: label, big value, optional caption, tinted icon box.
 *
 * Used by the employees directory and the leave screen, whose versions were
 * byte-identical. Four other screens keep their own variant because each renders
 * differently, and folding them in here would need half a dozen variant props:
 *
 *   features/attendance  — takes a ReactNode subtitle and renders it raw
 *   features/holidays    — truncates both the value and the caption
 *   features/requests    — truncates the value, ReactNode caption, optional onClick
 *   features/dashboard   — glass CARD_STYLE, rounded-lg icon box, optional href link
 *
 * If you need one of those behaviours, use that feature's version rather than
 * adding a flag here.
 */
export function StatCard({ title, value, subtitle, icon: Icon, color }: {
  title: string; value: number | string; subtitle?: string; icon: any; color: string;
}) {
  return (
    <Card className="border-0 card-hover"><CardContent className="p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 flex-1 min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-[33px] leading-tight font-bold text-foreground">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-xl flex-shrink-0 ${color}`}><Icon className="h-5 w-5" /></div>
      </div>
    </CardContent></Card>
  );
}
