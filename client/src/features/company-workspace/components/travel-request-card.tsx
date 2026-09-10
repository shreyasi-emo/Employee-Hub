import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/lib/auth";
import { colDivider } from "./request-ui";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Ban, History, MoreVertical, Eye, CalendarClock, Copy, User, Plane, Hotel, Bus } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { statusClass, statusLabel } from "@/lib/status";
import { moneyShort, relDate, isJustUpdated } from "@/lib/format";
import { format } from "date-fns";
import { TRAVEL_CATS } from "../travel/components/travel";

// Travel-request card for My Requests — same columnar layout as PurchaseRequestCard/RequestCard so the
// whole list reads identically (tinted icon box → identity → Last Updated → Approval Status → Amount).
// Wired to the new /api/travel shape: category-aware route, trip date, who's travelling, and cancel.
const fmt = (d: any) => (d ? format(new Date(d), "d MMM yyyy") : "—");
const CAT_ICON: Record<string, any> = { flight: Plane, stay: Hotel, transport: Bus };

export function TravelRequestCard({ item, onOpen }: { item: any; onOpen: (id: string) => void }) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { data: auth } = useAuth();
  const meId = auth?.user?.id;
  const cat = TRAVEL_CATS[item.category] || TRAVEL_CATS.flight;
  const Icon = CAT_ICON[item.category] || Plane;
  const reference = item.reference || `TRV-${String(item.id || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase()}`;
  const route = item.category === "flight" ? `${item.details?.fromCity || "?"} → ${item.details?.toCity || "?"}`
    : item.category === "stay" ? (item.details?.city || "Stay")
    : `${item.details?.from || "?"} → ${item.details?.to || "?"}`;
  const tripDate = item.startDate ? `${fmt(item.startDate)}${item.endDate && item.endDate !== item.startDate ? ` – ${fmt(item.endDate)}` : ""}` : null;
  const amt = Number(item.amount) || 0;
  // Who's travelling: on-behalf → the travellers ("For …"); own trip with company → co-travellers ("With …").
  const travs = ((item.attendees || []) as any[]).filter((a) => a?.userId);
  const forOthers = item.requesterId === meId && !travs.some((a) => a.userId === meId);
  const names = travs.filter((a) => forOthers || a.userId !== meId).map((a) => a.name).filter(Boolean).join(", ");
  const who = forOthers ? (names ? `For ${names}` : null) : (names ? `With ${names}` : null);
  const canCancel = !["booked", "rejected", "cancelled"].includes(item.status);

  const cancel = useMutation({
    mutationFn: () => apiRequest("POST", `/api/travel/${item.id}/cancel`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/travel") }); toast({ title: "Request cancelled" }); },
    onError: (e: any) => toast({ title: "Could not cancel", description: e.message, variant: "destructive" }),
  });

  const copyRef = (e: React.MouseEvent) => { e.stopPropagation(); navigator.clipboard?.writeText(reference); toast({ title: "Reference copied" }); };
  const catBadge = <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize flex-shrink-0">{cat.label}</Badge>;
  const overflow = (
    <div className="flex-shrink-0 flex items-center pl-2" onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" data-testid={`more-travel-${item.id}`}><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => onOpen(item.id)}><Eye className="h-4 w-4 mr-2" /> View details</DropdownMenuItem>
          {canCancel && <DropdownMenuItem className="text-[#FF6F62] focus:text-[#FF6F62]" disabled={cancel.isPending} onClick={() => { if (window.confirm("Cancel this request? This cannot be undone.")) cancel.mutate(); }}><Ban className="h-4 w-4 mr-2" /> Cancel</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  if (isMobile) {
    return (
      <Card data-testid={`card-travel-${item.id}`} className={`border-0 hover-elevate active-elevate-2 cursor-pointer ${isJustUpdated(item.updatedAt) ? "ring-1 ring-[#4BDCD9]/70" : ""}`} onClick={() => onOpen(item.id)}>
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0 mt-0.5"><Icon className="h-4 w-4" /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground tracking-tight truncate">{route}</h3>
                <Badge className={`text-[10px] flex-shrink-0 ${statusClass(item.status)}`}>{statusLabel(item.status)}</Badge>
              </div>
              <div className="flex items-center gap-1.5 min-w-0 mt-0.5">
                <span className="text-[11px] font-semibold text-muted-foreground tracking-wide truncate">{reference}</span>
                <button onClick={copyRef} aria-label="Copy reference" className="h-5 w-5 rounded inline-flex items-center justify-center text-muted-foreground hover:text-[#206295] hover:bg-muted flex-shrink-0"><Copy className="h-3 w-3" /></button>
                {catBadge}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1 min-w-0">
                <span className="inline-flex items-center gap-1 min-w-0 truncate"><CalendarClock className="h-3 w-3 flex-shrink-0" /><span className="truncate">{tripDate || "—"}</span></span>
                {amt > 0
                  ? <><span className="text-border flex-shrink-0">|</span><span className="flex-shrink-0 font-bold text-[#206295] tabular-nums">{moneyShort(amt)}</span></>
                  : <><span className="text-border flex-shrink-0">|</span><span className="flex-shrink-0">Not priced yet</span></>}
              </div>
              {who && <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 min-w-0"><User className="h-3 w-3 flex-shrink-0" /><span className="truncate">{who}</span></p>}
            </div>
            {overflow}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid={`card-travel-${item.id}`} className={`border-0 hover-elevate active-elevate-2 cursor-pointer ${isJustUpdated(item.updatedAt) ? "ring-1 ring-[#4BDCD9]/70" : ""}`} onClick={() => onOpen(item.id)}>
      <CardContent className="p-[17px]">
        <div className="flex flex-col lg:flex-row lg:items-stretch gap-3 lg:gap-0">
          <div className="flex-1 min-w-0 flex items-start gap-3 lg:pr-5">
            <div className="h-8 w-8 rounded-lg bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0 mt-1"><Icon className="h-4 w-4" /></div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground tracking-wide">{reference}</span>
                <button onClick={copyRef} aria-label="Copy reference" className="h-5 w-5 rounded inline-flex items-center justify-center text-muted-foreground hover:text-[#206295] hover:bg-muted"><Copy className="h-3 w-3" /></button>
                {catBadge}
              </div>
              <h3 className="text-[18px] leading-tight font-semibold text-foreground tracking-tight truncate mt-0.5">{route}</h3>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5 flex-shrink-0" /> Trip | {tripDate || "—"}</p>
              {who && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 min-w-0"><User className="h-3.5 w-3.5 flex-shrink-0" /><span className="truncate">{who}</span></p>}
            </div>
          </div>

          {colDivider}
          <div className="w-full lg:w-[150px] flex-shrink-0 lg:px-5 flex flex-col justify-end">
            <History className="h-4 w-4 text-muted-foreground" />
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1.5 whitespace-nowrap">Last Updated</p>
            <p className="text-sm font-semibold text-foreground mt-1.5 whitespace-nowrap">{relDate(item.updatedAt || item.createdAt)}</p>
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
              : <p className="text-sm text-muted-foreground mt-1.5">Not priced yet</p>}
          </div>

          {overflow}
        </div>
      </CardContent>
    </Card>
  );
}
