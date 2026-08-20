import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, ShoppingCart, Car, TicketIcon, ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { formatDate, formatStatus } from "@/lib/format";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  submitted: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  pending_ceo: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  changes_requested: "bg-orange-100 text-orange-700",
  completed: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  booked: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  open: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  done: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  resolved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};



export default function TeamRequestsPage() {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const [tab, setTab] = useState("purchases");
  const [memberFilter, setMemberFilter] = useState("all");

  const { data: teamData, isLoading, error } = useQuery<any>({
    queryKey: ["/api/team-requests"],
    retry: false,
  });

  if (error) {
    return (
      <div className="p-6 space-y-6 max-w-[92rem] mx-auto">
        <Card className="py-12">
          <CardContent className="text-center space-y-2">
            <Users className="h-10 w-10 text-muted-foreground mx-auto" />
            <h3 className="font-semibold text-foreground">Manager Access Required</h3>
            <p className="text-sm text-muted-foreground">You need a manager role to view team requests.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const teamMembers: any[] = teamData?.teamMembers || [];
  const purchases: any[] = (teamData?.purchases || []).filter((p: any) =>
    memberFilter === "all" || p.requesterId === memberFilter
  );
  const travels: any[] = (teamData?.travels || []).filter((t: any) =>
    memberFilter === "all" || t.requesterId === memberFilter
  );
  const tickets: any[] = (teamData?.tickets || []).filter((t: any) =>
    memberFilter === "all" || t.requesterId === memberFilter
  );

  const memberMap: Record<string, string> = {};
  for (const m of teamMembers) {
    if (m.userId) memberMap[m.userId] = `${m.firstName} ${m.lastName}`;
  }

  function getMemberName(userId: string) {
    return memberMap[userId] || userId?.slice(0, 8) || "Unknown";
  }

  return (
    <div className="p-6 space-y-6 max-w-[92rem] mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="icon" className="h-10 w-10 flex-shrink-0" onClick={() => window.history.back()} aria-label="Back" data-testid="button-back">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Team Requests</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Read-only view of your direct reports' requests
              {teamMembers.length > 0 && ` (${teamMembers.length} member${teamMembers.length !== 1 ? "s" : ""})`}
            </p>
          </div>
        </div>
        <Select value={memberFilter} onValueChange={setMemberFilter}>
          <SelectTrigger className="w-44" data-testid="select-member-filter">
            <SelectValue placeholder="Filter by member" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Members</SelectItem>
            {teamMembers.filter((m: any) => m.userId).map((m: any) => (
              <SelectItem key={m.id} value={m.userId}>
                {m.firstName} {m.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {teamMembers.length === 0 && !isLoading && (
        <Card className="py-12">
          <CardContent className="text-center space-y-2">
            <Users className="h-10 w-10 text-muted-foreground mx-auto" />
            <h3 className="font-semibold text-foreground">No Direct Reports</h3>
            <p className="text-sm text-muted-foreground">You have no team members reporting to you yet.</p>
          </CardContent>
        </Card>
      )}

      {(teamMembers.length > 0 || isLoading) && (
        <Tabs value={tab} onValueChange={setTab} data-testid="tabs-team-requests">
          <TabsList>
            <TabsTrigger value="purchases">
              <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
              Purchases {purchases.length > 0 && `(${purchases.length})`}
            </TabsTrigger>
            <TabsTrigger value="travels">
              <Car className="h-3.5 w-3.5 mr-1.5" />
              Travel {travels.length > 0 && `(${travels.length})`}
            </TabsTrigger>
            <TabsTrigger value="tickets">
              <TicketIcon className="h-3.5 w-3.5 mr-1.5" />
              Tickets {tickets.length > 0 && `(${tickets.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="purchases" className="mt-4 space-y-3">
            {isLoading ? <Skeleton className="h-24 w-full" /> :
              purchases.length === 0 ?
                <Card className="py-10"><CardContent className="text-center text-sm text-muted-foreground">No purchase requests from team.</CardContent></Card> :
                <div className="space-y-2">
                  {purchases.map((pr: any) => (
                    <Card key={pr.id} data-testid={`card-team-pr-${pr.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-medium text-sm text-foreground capitalize">{pr.category?.replace(/_/g, " ")}</span>
                              <Badge className={`text-xs border-0 ${STATUS_COLORS[pr.status] || STATUS_COLORS.draft}`}>{formatStatus(pr.status)}</Badge>
                              {pr.estimatedCost && <span className="text-xs font-semibold">₹{Number(pr.estimatedCost).toLocaleString()}</span>}
                            </div>
                            <p className="text-xs text-muted-foreground">{pr.notes}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              By <span className="font-medium text-foreground">{getMemberName(pr.requesterId)}</span>
                              {" · "}{formatDate(pr.createdAt)}
                              {pr.neededByDate && ` · Needed by ${formatDate(pr.neededByDate)}`}
                            </p>
                          </div>
                        </div>
                        {Array.isArray(pr.items) && pr.items.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {pr.items.slice(0, 3).map((item: any, i: number) => (
                              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground flex-shrink-0" />
                                <span>{item.description}</span>
                                {item.qty > 1 && <span>× {item.qty}</span>}
                                {item.estimatedCost && <span>₹{Number(item.estimatedCost).toLocaleString()}</span>}
                              </div>
                            ))}
                            {pr.items.length > 3 && <p className="text-xs text-muted-foreground pl-3.5">+{pr.items.length - 3} more items</p>}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
            }
          </TabsContent>

          <TabsContent value="travels" className="mt-4 space-y-3">
            {isLoading ? <Skeleton className="h-24 w-full" /> :
              travels.length === 0 ?
                <Card className="py-10"><CardContent className="text-center text-sm text-muted-foreground">No travel requests from team.</CardContent></Card> :
                <div className="space-y-2">
                  {travels.map((tr: any) => (
                    <Card key={tr.id} data-testid={`card-team-tr-${tr.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-medium text-sm text-foreground">{tr.fromCity} → {tr.toCity}</span>
                              <Badge className={`text-xs border-0 ${STATUS_COLORS[tr.status] || STATUS_COLORS.draft}`}>{formatStatus(tr.status)}</Badge>
                              {tr.estimatedBudget && <span className="text-xs font-semibold">₹{Number(tr.estimatedBudget).toLocaleString()}</span>}
                            </div>
                            <p className="text-xs text-muted-foreground">{tr.purpose}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              By <span className="font-medium text-foreground">{getMemberName(tr.requesterId)}</span>
                              {" · "}Travel: {tr.travelDate ? formatDate(tr.travelDate) : "TBD"}
                              {tr.returnDate && ` → ${formatDate(tr.returnDate)}`}
                            </p>
                            {tr.preferences && <p className="text-xs text-muted-foreground">Preferences: {tr.preferences}</p>}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
            }
          </TabsContent>

          <TabsContent value="tickets" className="mt-4 space-y-3">
            {isLoading ? <Skeleton className="h-24 w-full" /> :
              tickets.length === 0 ?
                <Card className="py-10"><CardContent className="text-center text-sm text-muted-foreground">No tickets from team.</CardContent></Card> :
                <div className="space-y-2">
                  {tickets.map((t: any) => (
                    <Card key={t.id} data-testid={`card-team-ticket-${t.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-medium text-sm text-foreground">{t.subject}</span>
                              <Badge className={`text-xs border-0 ${STATUS_COLORS[t.status] || STATUS_COLORS.open}`}>{formatStatus(t.status)}</Badge>
                              <Badge variant="outline" className="text-xs">{t.priority}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              By <span className="font-medium text-foreground">{getMemberName(t.requesterId)}</span>
                              {" · "}{formatDate(t.createdAt)}
                              {" · "}<span className="capitalize">{t.category?.replace(/_/g, " ")}</span>
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
            }
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
