import { formatDate } from "../shared/request-format";
import { moneyShort } from "@/lib/format";
import { useIsMobile } from "@/hooks/use-mobile";
import { colDivider } from "./request-ui";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, Package, CheckCircle2, Ban, History, MoreVertical, Eye, CalendarClock, Copy } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { statusClass, statusLabel } from "@/lib/status";

// Purchase-request card (office + procurement) — the shared columnar layout used across the requests list.
export function PurchaseRequestCard({ item, onOpen, kind = "office" }: { item: any; onOpen: (id: string) => void; kind?: "office" | "procurement" }) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const isProc = kind === "procurement";
  const basePath = isProc ? "/api/procurement" : "/api/office-purchases";
  const reference = item.reference || `${isProc ? "PR" : "OP"}-${String(item.id || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase()}`;
  const lines = Array.isArray(item.items) ? item.items : [];
  const title = lines.length ? `${lines[0]?.description || "Item"}${lines.length > 1 ? ` +${lines.length - 1} more` : ""}` : (isProc ? "Procurement" : "Office Purchase");
  const amt = Number(item.totalAmount) || 0;
  // Office can be cancelled pre-CEO (pending_hr / pending_approval); procurement only while pending_approval.
  const canCancel = isProc ? item.status === "pending_approval" : ["pending_hr", "pending_approval"].includes(item.status);
  const cancel = useMutation({
    mutationFn: () => apiRequest("POST", `${basePath}/${item.id}/cancel`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith(basePath) }); toast({ title: "Request cancelled" }); },
    onError: (e: any) => toast({ title: "Could not cancel", description: e.message, variant: "destructive" }),
  });
  const overflowMenu = (
    <div className="flex-shrink-0 flex items-center pl-2" onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" data-testid={`more-${kind}-${item.id}`}><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => onOpen(item.id)}><Eye className="h-4 w-4 mr-2" /> View details</DropdownMenuItem>
          {canCancel && <DropdownMenuItem className="text-[#FF6F62] focus:text-[#FF6F62]" disabled={cancel.isPending} onClick={() => { if (window.confirm("Cancel this request? This cannot be undone.")) cancel.mutate(); }}><Ban className="h-4 w-4 mr-2" /> Cancel</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  // Mobile: a compact single-row card — title + status on line 1, reference (with copy) + priority
  // on line 2, a |-separated date + amount meta line; the overflow menu keeps View / Cancel.
  if (isMobile) {
    return (
      <Card data-testid={`card-${kind}-${item.id}`} className="border-0 hover-elevate active-elevate-2 cursor-pointer" onClick={() => onOpen(item.id)}>
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${isProc ? "bg-[#0E7C7B]/10 text-[#0E7C7B]" : "bg-[#206295]/10 text-[#206295]"}`}>{isProc ? <Package className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground tracking-tight truncate">{title}</h3>
                <Badge className={`text-[10px] flex-shrink-0 ${statusClass(item.status)}`}>{statusLabel(item.status)}</Badge>
              </div>
              <div className="flex items-center gap-1.5 min-w-0 mt-0.5">
                <span className="text-[11px] font-semibold text-muted-foreground tracking-wide truncate">{reference}</span>
                <button onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(reference); toast({ title: "Reference copied" }); }} aria-label="Copy reference" className="h-5 w-5 rounded inline-flex items-center justify-center text-muted-foreground hover:text-[#206295] hover:bg-muted flex-shrink-0"><Copy className="h-3 w-3" /></button>
                {!isProc && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize flex-shrink-0">{item.priority || "medium"}</Badge>}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1 min-w-0">
                <span className="inline-flex items-center gap-1 min-w-0 truncate"><CalendarClock className="h-3 w-3 flex-shrink-0" /><span className="truncate">{formatDate(item.createdAt)}</span></span>
                <span className="text-border flex-shrink-0">|</span>
                {amt > 0
                  ? <span className="flex-shrink-0 font-bold text-[#206295] tabular-nums">{moneyShort(amt)}</span>
                  : <span className="flex-shrink-0">{isProc ? "—" : "Not priced yet"}</span>}
              </div>
            </div>
            {overflowMenu}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid={`card-${kind}-${item.id}`} className="border-0 hover-elevate active-elevate-2 cursor-pointer" onClick={() => onOpen(item.id)}>
      <CardContent className="p-[17px]">
        <div className="flex flex-col lg:flex-row lg:items-stretch gap-3 lg:gap-0">
          <div className="flex-1 min-w-0 flex items-start gap-3 lg:pr-5">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 ${isProc ? "bg-[#0E7C7B]/10 text-[#0E7C7B]" : "bg-[#206295]/10 text-[#206295]"}`}>{isProc ? <Package className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}</div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground tracking-wide">{reference}</span>
                <button onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(reference); toast({ title: "Reference copied" }); }} aria-label="Copy reference" className="h-5 w-5 rounded inline-flex items-center justify-center text-muted-foreground hover:text-[#206295] hover:bg-muted"><Copy className="h-3 w-3" /></button>
                {!isProc && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">{item.priority || "medium"}</Badge>}
              </div>
              <h3 className="text-[18px] leading-tight font-semibold text-foreground tracking-tight truncate mt-0.5">{title}</h3>
              <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5 flex-shrink-0" /> Created · {formatDate(item.createdAt)}</p>
            </div>
          </div>

          {colDivider}
          <div className="w-full lg:w-[150px] flex-shrink-0 lg:px-5 flex flex-col justify-end">
            <History className="h-4 w-4 text-muted-foreground" />
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1.5 whitespace-nowrap">Last Updated</p>
            <p className="text-sm font-semibold text-foreground mt-1.5 whitespace-nowrap">{item.updatedAt ? formatDate(item.updatedAt) : "—"}</p>
          </div>

          {colDivider}
          <div className="w-full lg:w-[188px] flex-shrink-0 lg:px-5 flex flex-col justify-end">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1.5 whitespace-nowrap">Approval Status</p>
            <div className="mt-1.5"><Badge className={`text-xs ${statusClass(item.status)}`}>{statusLabel(item.status)}</Badge></div>
          </div>

          {colDivider}
          <div className="w-full lg:w-[188px] flex-shrink-0 lg:px-5 flex flex-col justify-end items-start lg:items-end text-left lg:text-right">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">Amount</p>
            {amt > 0
              ? <p className="text-2xl font-bold text-[#206295] tracking-tight tabular-nums mt-1.5"><span className="font-semibold mr-0.5">₹</span>{amt.toLocaleString("en-IN")}</p>
              : <p className="text-sm text-muted-foreground mt-1.5">{isProc ? "—" : "Not priced yet"}</p>}
          </div>

          <div className="flex-shrink-0 flex items-center pl-2" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" data-testid={`more-${kind}-${item.id}`}><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => onOpen(item.id)}><Eye className="h-4 w-4 mr-2" /> View details</DropdownMenuItem>
                {canCancel && <DropdownMenuItem className="text-[#FF6F62] focus:text-[#FF6F62]" disabled={cancel.isPending} onClick={() => { if (window.confirm("Cancel this request? This cannot be undone.")) cancel.mutate(); }}><Ban className="h-4 w-4 mr-2" /> Cancel</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
