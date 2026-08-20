import { CR_PAGE_SIZE } from "../../shared/request-format";
import { RequestCard } from "../../components/request-card";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { Separator } from "@/components/ui/separator";

// Reimbursement card view: "Changes Requested" claims are lifted into their own urgency section at the
// top (grey caps heading, count + pagination when > 2), separated from the rest of the list.
export function ReimbCardView({ items, onOpen }: { items: any[]; onOpen: (it: any) => void }) {
  const [crPage, setCrPage] = useState(1);
  const cr = items.filter((r) => r.status === "changes_requested");
  const rest = items.filter((r) => r.status !== "changes_requested");
  const showPager = cr.length > 2;
  const crTotalPages = Math.max(1, Math.ceil(cr.length / CR_PAGE_SIZE));
  const curCrPage = Math.min(crPage, crTotalPages);
  const crPageItems = showPager ? cr.slice((curCrPage - 1) * CR_PAGE_SIZE, curCrPage * CR_PAGE_SIZE) : cr;
  return (
    <div className="space-y-3">
      {cr.length > 0 && <>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5" data-testid="cr-section-title">
            <AlertTriangle className="h-3.5 w-3.5" /> Action Required — Changes Requested
          </h2>
          {showPager && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="tabular-nums whitespace-nowrap">{cr.length} item{cr.length !== 1 ? "s" : ""} need action</span>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={curCrPage <= 1} onClick={() => setCrPage(curCrPage - 1)} data-testid="cr-page-prev"><ChevronLeft className="h-4 w-4" /></Button>
              <span className="px-1 tabular-nums">{curCrPage} / {crTotalPages}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={curCrPage >= crTotalPages} onClick={() => setCrPage(curCrPage + 1)} data-testid="cr-page-next"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </div>
        <div className="space-y-3">
          {crPageItems.map((r) => <RequestCard key={r.id} item={r} type="reimbursement" onOpen={onOpen} />)}
        </div>
        {rest.length > 0 && <Separator className="my-1" />}
      </>}
      {rest.map((r) => <RequestCard key={r.id} item={r} type="reimbursement" onOpen={onOpen} />)}
    </div>
  );
}
