import { Fragment, type ReactNode } from "react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { FileText, IndianRupee, Eye, MoreVertical, ChevronDown } from "lucide-react";

// Shared "premium" approval card — the canonical reimbursement-card layout, reused across every
// approval surface (reimbursements / office purchases / procurement / travel) so they read identically:
// reference + type badge → big ₹ amount → requester line → meta columns. Fields vary per category via the
// `facts` and `meta` arrays. Two interaction modes: a View button that opens a detail (reimb / travel), or
// an `expandable` accordion that drops the `children` down in place (office / procurement).
export interface ApprovalFact { label?: string; value: ReactNode; muted?: boolean; truncate?: boolean; }
export interface ApprovalMeta { icon?: any; label: string; value?: ReactNode; badge?: ReactNode; width?: string; }
export interface ApprovalMenuItem { label: string; icon?: any; onClick: () => void; danger?: boolean; }

export function ApprovalCard({
  icon: Icon = FileText, reference, badge, resubmitted,
  amount, amountFallback,
  requesterName, requesterCode, facts = [], meta = [],
  selectable, selected, selectionMode, checkboxAlways, onToggleSelect,
  onView, viewLabel = "View", menu = [], testId,
  expandable, expanded, onToggleExpand, children,
}: {
  icon?: any; reference: ReactNode; badge?: ReactNode; resubmitted?: boolean;
  amount?: number | string; amountFallback?: string;
  requesterName?: string; requesterCode?: string; facts?: ApprovalFact[]; meta?: ApprovalMeta[];
  selectable?: boolean; selected?: boolean; selectionMode?: boolean; checkboxAlways?: boolean; onToggleSelect?: () => void;
  onView?: () => void; viewLabel?: string; menu?: ApprovalMenuItem[]; testId?: string;
  expandable?: boolean; expanded?: boolean; onToggleExpand?: () => void; children?: ReactNode;
}) {
  const amt = Number(amount) || 0;
  const showCheckbox = selectable && (selectionMode || checkboxAlways);
  const handleCardClick = () => {
    if (selectionMode && selectable) return onToggleSelect?.();
    if (expandable) return onToggleExpand?.();
    return onView?.();
  };
  return (
    <div
      data-testid={testId}
      className={`group card-surface card-hover relative overflow-hidden cursor-pointer ${selectionMode && selected ? "ring-2 ring-[#206295]" : ""}`}
      onClick={handleCardClick}
    >
      {/* Overflow menu — top-right (hidden in selection mode) */}
      {!selectionMode && menu.length > 0 && (
        <div className="absolute right-4 top-4 z-10" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" data-testid={testId ? `${testId}-more` : undefined}><MoreVertical className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {menu.map((m, i) => (
                <DropdownMenuItem key={i} className={m.danger ? "text-[#FF6F62] focus:text-[#FF6F62]" : ""} onClick={m.onClick}>
                  {m.icon && <m.icon className="h-4 w-4 mr-2" />} {m.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <div className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
          {showCheckbox && (
            <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
              <Checkbox checked={!!selected} onCheckedChange={() => onToggleSelect?.()} data-testid={testId ? `${testId}-select` : undefined} />
            </div>
          )}

          {/* Identity — reference → amount → requester line */}
          <div className="flex-1 min-w-0 lg:pr-6">
            <div className="flex items-center gap-2">
              <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-[13px] font-semibold tracking-wide text-foreground truncate">{reference}</span>
              {badge}
              {resubmitted && <Badge className="text-[10px] bg-[#206295]/15 text-[#206295] flex-shrink-0">Resubmitted</Badge>}
            </div>
            <div className="flex items-end gap-1 mt-1.5">
              {amt > 0 ? (
                <>
                  <IndianRupee className="h-7 w-7 text-[#206295] mb-1" />
                  <span className="text-[2.1rem] leading-none font-bold text-[#206295] tracking-tight tabular-nums">{amt.toLocaleString("en-IN")}</span>
                </>
              ) : (
                <span className="text-base font-semibold text-muted-foreground">{amountFallback || "—"}</span>
              )}
            </div>
            <div className="flex items-center gap-2.5 mt-2.5 text-sm min-w-0">
              <span className="flex-shrink-0">
                <span className="font-bold text-foreground">{requesterName || "Employee"}</span>
                {requesterCode ? <span className="text-muted-foreground font-normal"> ({requesterCode})</span> : null}
              </span>
              {facts.map((f, i) => (
                <Fragment key={i}>
                  <Separator orientation="vertical" className="h-3.5 flex-shrink-0" />
                  <span className={f.truncate ? "min-w-0 truncate" : "flex-shrink-0"}>
                    {f.label && <span className="text-muted-foreground">{f.label}: </span>}
                    <span className={f.muted ? "text-muted-foreground" : "font-semibold text-foreground/90"}>{f.value}</span>
                  </span>
                </Fragment>
              ))}
            </div>
          </div>

          {/* Meta columns — icon / uppercase label / bold value, divided by tall separators */}
          {meta.length > 0 && (
            <>
              <div className="hidden lg:block self-center w-[1.4px] h-24 rounded-full bg-foreground/30 flex-shrink-0" />
              <div className="flex flex-wrap lg:flex-nowrap items-stretch gap-x-6 gap-y-3 lg:gap-6 flex-shrink-0">
                {meta.map((m, i) => (
                  <Fragment key={i}>
                    {i > 0 && <Separator orientation="vertical" className="h-14 hidden lg:block" />}
                    <div className={`flex-shrink-0 ${m.width || "w-[120px]"}`}>
                      {m.icon && <m.icon className="h-3.5 w-3.5 text-muted-foreground" />}
                      <p className="text-[12px] uppercase tracking-wide text-muted-foreground mt-1">{m.label}</p>
                      {m.badge ? <div className="mt-1.5">{m.badge}</div> : <p className="text-sm font-semibold text-foreground mt-1 truncate">{m.value}</p>}
                    </div>
                  </Fragment>
                ))}
              </div>
            </>
          )}

          {/* Right action — accordion chevron, or a View button */}
          {expandable ? (
            <ChevronDown className={`h-5 w-5 text-muted-foreground flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
          ) : onView && !selectionMode ? (
            <>
              <Separator orientation="vertical" className="h-16 hidden lg:block" />
              <div className="flex-shrink-0 pr-2" onClick={(e) => e.stopPropagation()}>
                <Button size="sm" variant="ghost" className="h-10 w-[108px] btn-glass text-[#206295] hover:text-[#206295]" onClick={onView} data-testid={testId ? `${testId}-view` : undefined}>
                  <Eye className="h-4 w-4 mr-1.5" /> {viewLabel}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Accordion body — drops down in place */}
      {expandable && expanded && (
        <div className="border-t border-border bg-muted/20 px-5 py-4" onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      )}
    </div>
  );
}
