import { formatDate, formatStatus, money, amountOf, titleOf, purposeOf, refOf, REVOCABLE_BLOCK } from "../shared/request-format";
import { moneyShort } from "@/lib/format";
import { useIsMobile } from "@/hooks/use-mobile";
import { submittedInfo } from "../shared/submitted-info";
import { SubmittedLabel, colDivider } from "./request-ui";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, Car, TicketIcon, Receipt, CheckCircle2, Ban, History, MoreVertical, Eye, CalendarClock, Copy, User } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { StatusBadge } from "../reimbursements/components/status-badge";
import { statusClass, statusLabel } from "@/lib/status";

// Unified enterprise request card — Identity (ref · title · date) | Approval Status | Payable.
// `readOnly` drops the click-through + overflow menu (e.g. the manager's Team Requests view);
// `byline` shows who raised it (only meaningful when the list spans multiple requesters).
export function RequestCard({ item, type, onOpen, readOnly = false, byline }: { item: any; type: "purchase" | "travel" | "ticket" | "reimbursement"; onOpen?: (item: any) => void; readOnly?: boolean; byline?: string }) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const Icon = type === "purchase" ? ShoppingCart : type === "travel" ? Car : type === "ticket" ? TicketIcon : Receipt;
  const reference = refOf(type, item);
  const title = purposeOf(type, item) || titleOf(type, item);
  const amt = amountOf(type, item);
  const category = type === "travel" ? null : (item.category || null);
  const advance = type === "reimbursement" ? Number(item.cashAdvance) || 0 : 0;
  const payable = amt - advance;
  const canRevoke = !REVOCABLE_BLOCK.includes(item.status);
  const sub = submittedInfo(type, item);
  const dateLine = type === "reimbursement"
    ? (item.periodFrom ? `Expense Period · ${formatDate(item.periodFrom)} – ${formatDate(item.periodTo || item.periodFrom)}` : "Expense Period · —")
    : `Created · ${formatDate(item.createdAt)}`;
  // Mobile meta uses a compact date (no "Created ·" prefix, no middot).
  const dateShort = type === "reimbursement"
    ? (item.periodFrom ? `${formatDate(item.periodFrom)} – ${formatDate(item.periodTo || item.periodFrom)}` : "—")
    : formatDate(item.createdAt);

  const revoke = useMutation({
    mutationFn: () => {
      const url = type === "reimbursement"
        ? `/api/reimbursements/${item.id}/revoke`
        : `/api/my-requests/${type === "purchase" ? "purchases" : type === "travel" ? "travels" : "tickets"}/${item.id}/revoke`;
      return apiRequest("POST", url, {});
    },
    onSuccess: () => { queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/") }); toast({ title: "Request revoked" }); },
    onError: (e: any) => toast({ title: "Could not revoke", description: e.message, variant: "destructive" }),
  });

  const overflowMenu = !readOnly && (
    <div className="flex-shrink-0 flex items-center pl-2" onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" data-testid={`more-${type}-${item.id}`}><MoreVertical className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => onOpen?.(item)}><Eye className="h-4 w-4 mr-2" /> View details</DropdownMenuItem>
          {canRevoke && (
            <DropdownMenuItem className="text-[#FF6F62] focus:text-[#FF6F62]" disabled={revoke.isPending}
              onClick={() => { if (window.confirm("Revoke this request? This cannot be undone.")) revoke.mutate(); }}>
              <Ban className="h-4 w-4 mr-2" /> Revoke
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  // Mobile: a compact single-row card — title + status on line 1, reference (with copy) + category
  // on line 2, a |-separated date + payable meta line; the overflow menu keeps every action.
  if (isMobile) {
    return (
      <Card data-testid={`card-request-${item.id}`} className={`border-0 ${readOnly ? "" : "hover-elevate active-elevate-2 cursor-pointer"} ${item.status === "changes_requested" ? "ring-1 ring-[#FF6F62]/50 bg-[#FF6F62]/[0.04]" : ""}`} onClick={readOnly ? undefined : () => onOpen?.(item)}>
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0 mt-0.5">
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground tracking-tight truncate">{title}</h3>
                <div className="flex-shrink-0">
                  {type === "reimbursement"
                    ? <StatusBadge status={item.status} />
                    : <Badge className={`text-[10px] ${statusClass(item.status)}`}>{statusLabel(item.status)}</Badge>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 min-w-0 mt-0.5">
                <span className="text-[11px] font-semibold text-muted-foreground tracking-wide truncate">{reference}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(reference); toast({ title: "Reference copied" }); }}
                  aria-label="Copy reference" data-testid={`copy-ref-${item.id}`}
                  className="h-5 w-5 rounded inline-flex items-center justify-center text-muted-foreground hover:text-[#206295] hover:bg-muted flex-shrink-0">
                  <Copy className="h-3 w-3" />
                </button>
                {category && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize flex-shrink-0">{formatStatus(category)}</Badge>}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1 min-w-0">
                <span className="inline-flex items-center gap-1 min-w-0 truncate"><CalendarClock className="h-3 w-3 flex-shrink-0" /><span className="truncate">{dateShort}</span></span>
                {amt > 0 && <>
                  <span className="text-border flex-shrink-0">|</span>
                  <span className="flex-shrink-0 font-bold text-[#206295] tabular-nums">{moneyShort(payable)}</span>
                </>}
              </div>
              {advance > 0 && <p className="text-[11px] text-muted-foreground mt-0.5">net of {money(advance)} advance</p>}
              {byline && <p className="text-[11px] text-muted-foreground mt-0.5 inline-flex items-center gap-1.5"><User className="h-3 w-3 flex-shrink-0" /> {byline}</p>}
            </div>
            {overflowMenu}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid={`card-request-${item.id}`} className={`border-0 ${readOnly ? "" : "hover-elevate active-elevate-2 cursor-pointer"} ${item.status === "changes_requested" ? "ring-1 ring-[#FF6F62]/50 bg-[#FF6F62]/[0.04]" : ""}`} onClick={readOnly ? undefined : () => onOpen?.(item)}>
      <CardContent className="p-[17px]">
        <div className="flex flex-col lg:flex-row lg:items-stretch gap-3 lg:gap-0">
          {/* Identity */}
          <div className="flex-1 min-w-0 flex items-start gap-3 lg:pr-5">
            <div className="h-8 w-8 rounded-lg bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0 mt-1">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground tracking-wide">{reference}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(reference); toast({ title: "Reference copied" }); }}
                  aria-label="Copy reference" data-testid={`copy-ref-${item.id}`}
                  className="h-5 w-5 rounded inline-flex items-center justify-center text-muted-foreground hover:text-[#206295] hover:bg-muted">
                  <Copy className="h-3 w-3" />
                </button>
                {category && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">{formatStatus(category)}</Badge>}
              </div>
              <h3 className="text-[18px] leading-tight font-semibold text-foreground tracking-tight truncate mt-0.5">{title}</h3>
              <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5 flex-shrink-0" /> {dateLine}</p>
              {byline && <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1.5"><User className="h-3.5 w-3.5 flex-shrink-0" /> {byline}</p>}
            </div>
          </div>

          {/* Submitted on / Re-submitted On — reimbursements only */}
          {type === "reimbursement" && <>
            {colDivider}
            <div className="w-full lg:w-[150px] flex-shrink-0 lg:px-5 flex flex-col justify-end">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1.5 whitespace-nowrap"><SubmittedLabel info={sub} /></div>
              <p className="text-sm font-semibold text-foreground mt-1.5 whitespace-nowrap">{formatDate(sub.date)}</p>
            </div>
          </>}

          {colDivider}
          {/* Last Updated — all tabs */}
          <div className="w-full lg:w-[150px] flex-shrink-0 lg:px-5 flex flex-col justify-end">
            <History className="h-4 w-4 text-muted-foreground" />
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1.5 whitespace-nowrap">Last Updated</p>
            <p className="text-sm font-semibold text-foreground mt-1.5 whitespace-nowrap">{item.updatedAt ? formatDate(item.updatedAt) : "—"}</p>
          </div>

          {colDivider}
          {/* Approval Status — sized to fit "APPROVAL STATUS" + widest status chip ("Changes Requested") with even margins */}
          <div className="w-full lg:w-[188px] flex-shrink-0 lg:px-5 flex flex-col justify-end">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1.5 whitespace-nowrap">Approval Status</p>
            <div className="mt-1.5">
              {type === "reimbursement"
                ? <StatusBadge status={item.status} />
                : <Badge className={`text-xs ${statusClass(item.status)}`}>{statusLabel(item.status)}</Badge>}
            </div>
          </div>

          {colDivider}
          {/* Payable — sized to fit ₹10,00,000 + "net of … advance" subtext */}
          <div className="w-full lg:w-[188px] flex-shrink-0 lg:px-5 flex flex-col justify-end items-start lg:items-end text-left lg:text-right">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">Payable</p>
            {amt > 0 ? (
              <>
                <p className="text-2xl font-bold text-[#206295] tracking-tight tabular-nums mt-1.5">
                  <span className="font-semibold mr-0.5">₹</span>{payable.toLocaleString("en-IN")}
                </p>
                {advance > 0 && <p className="text-[11px] text-muted-foreground mt-0.5">net of {money(advance)} advance</p>}
              </>
            ) : (
              <p className="text-2xl font-bold text-muted-foreground/50 mt-1.5">—</p>
            )}
          </div>

          {/* Overflow — hidden in read-only views (e.g. a manager's team view) */}
          {!readOnly && (
            <div className="flex-shrink-0 flex items-center pl-2" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" data-testid={`more-${type}-${item.id}`}><MoreVertical className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => onOpen?.(item)}><Eye className="h-4 w-4 mr-2" /> View details</DropdownMenuItem>
                  {canRevoke && (
                    <DropdownMenuItem className="text-[#FF6F62] focus:text-[#FF6F62]" disabled={revoke.isPending}
                      onClick={() => { if (window.confirm("Revoke this request? This cannot be undone.")) revoke.mutate(); }}>
                      <Ban className="h-4 w-4 mr-2" /> Revoke
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
