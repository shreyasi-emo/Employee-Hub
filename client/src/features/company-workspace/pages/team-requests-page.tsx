import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, ShoppingCart, Car, TicketIcon, ChevronLeft, Search, LayoutGrid, Table2, ArrowDownUp } from "lucide-react";
import { RequestCard } from "../components/request-card";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { statusClass, statusLabel } from "@/lib/status";
import { matchesFilter, searchText, titleOf, subOf, amountOf, money, formatDate, formatStatus } from "../shared/request-format";

// Read-only view of a manager's direct reports' requests. Same canonical toolbar as My Requests
// (view toggle · search · status filter · sort) plus a member filter; renders the shared RequestCard
// / RequestTable in read-only mode.
export default function TeamRequestsPage() {
  const [tab, setTab] = useState("purchases");
  const [memberFilter, setMemberFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("latest");
  const [view, setView] = useState<"card" | "table">("card");

  const { data: teamData, isLoading, error } = useQuery<any>({ queryKey: ["/api/team-requests"], retry: false });

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
  const memberMap: Record<string, string> = {};
  for (const m of teamMembers) if (m.userId) memberMap[m.userId] = `${m.firstName} ${m.lastName}`;
  const getMemberName = (userId: string) => memberMap[userId] || userId?.slice(0, 8) || "Unknown";

  // member -> status -> search -> sort
  const refine = (list: any[], type: string) => {
    const q = search.trim().toLowerCase();
    let r = (list || []).filter((x: any) => memberFilter === "all" || x.requesterId === memberFilter);
    r = r.filter((x: any) => matchesFilter(x.status, statusFilter));
    if (q) r = r.filter((x: any) => searchText(type, x).includes(q));
    return [...r].sort((a: any, b: any) => {
      const d = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sortBy === "oldest" ? -d : d;
    });
  };

  const purchases = refine(teamData?.purchases, "purchase");
  const travels = refine(teamData?.travels, "travel");
  const tickets = refine(teamData?.tickets, "ticket");

  const titleCase = (s: string) => (s || "").replace(/\b\w/g, (c) => c.toUpperCase());
  const reqTitle = (type: string, it: any) => (type === "purchase" ? `${titleCase(formatStatus(it.category))} Request` : titleOf(type, it));

  // Team-view table: "Requested by" first, a proper capitalised title, one date column, no
  // duplicated "submitted on" label. Built on the shared DataTable.
  const teamTable = (items: any[], type: "purchase" | "travel" | "ticket") => (
    <div className="card-surface rounded-[16px]">
      <DataTable
        columns={[
          { key: "by", header: "Requested by", cellClassName: "font-medium text-foreground whitespace-nowrap", render: (it: any) => getMemberName(it.requesterId) },
          { key: "request", header: "Request", cellClassName: "text-foreground", render: (it: any) => reqTitle(type, it) },
          { key: "details", header: "Details", cellClassName: "text-muted-foreground max-w-[20rem] truncate", render: (it: any) => subOf(type, it) || "—" },
          { key: "status", header: "Status", render: (it: any) => <Badge className={`text-xs ${statusClass(it.status)}`}>{statusLabel(it.status)}</Badge> },
          { key: "amount", header: "Amount", align: "right", cellClassName: "font-semibold text-foreground tabular-nums", render: (it: any) => (amountOf(type, it) ? money(amountOf(type, it)) : "—") },
          { key: "raised", header: "Raised", cellClassName: "text-muted-foreground whitespace-nowrap", render: (it: any) => formatDate(it.createdAt) },
        ]}
        rows={items}
        getRowKey={(it: any) => it.id}
        testIdPrefix={`team-${type}`}
      />
    </div>
  );

  const render = (items: any[], type: "purchase" | "travel" | "ticket", emptyLabel: string) => {
    if (isLoading) return <Skeleton className="h-24 w-full" />;
    if (items.length === 0) return <Card className="py-10"><CardContent className="text-center text-sm text-muted-foreground">{emptyLabel}</CardContent></Card>;
    if (view === "table") return teamTable(items, type);
    return <div className="space-y-2">{items.map((it: any) => <RequestCard key={it.id} item={it} type={type} readOnly byline={getMemberName(it.requesterId)} />)}</div>;
  };

  return (
    <div className="p-6 space-y-6 max-w-[92rem] mx-auto">
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
        <Tabs value={tab} onValueChange={setTab} data-testid="tabs-team-requests" className="space-y-4">
          <TabsList>
            <TabsTrigger value="purchases"><ShoppingCart className="h-3.5 w-3.5 mr-1.5" /> Purchases {purchases.length > 0 && `(${purchases.length})`}</TabsTrigger>
            <TabsTrigger value="travels"><Car className="h-3.5 w-3.5 mr-1.5" /> Travel {travels.length > 0 && `(${travels.length})`}</TabsTrigger>
            <TabsTrigger value="tickets"><TicketIcon className="h-3.5 w-3.5 mr-1.5" /> Tickets {tickets.length > 0 && `(${tickets.length})`}</TabsTrigger>
          </TabsList>

          {/* Canonical controls strip (same as My Requests) — read-only, plus a member filter. */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="segmented-toggle inline-flex p-0.5 h-10 flex-shrink-0">
              <button onClick={() => setView("card")} aria-label="Card view" data-testid="view-card" className={`px-3 h-full rounded-[10px] inline-flex items-center justify-center ${view === "card" ? "btn-primary-gradient text-white" : "text-muted-foreground"}`}><LayoutGrid className="h-4 w-4" /></button>
              <button onClick={() => setView("table")} aria-label="Table view" data-testid="view-table" className={`px-3 h-full rounded-[10px] inline-flex items-center justify-center ${view === "table" ? "btn-primary-gradient text-white" : "text-muted-foreground"}`}><Table2 className="h-4 w-4" /></button>
            </div>
            <div className="w-px self-stretch flex-shrink-0 bg-foreground/30" />
            <div className="relative flex-1 min-w-[12rem]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search requests…" className="pl-8 h-10 w-full" data-testid="input-search-team-requests" />
            </div>
            <Select value={memberFilter} onValueChange={setMemberFilter}>
              <SelectTrigger className="h-10 w-[160px] flex-shrink-0" data-testid="select-member-filter"><SelectValue placeholder="Member" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Members</SelectItem>
                {teamMembers.filter((m: any) => m.userId).map((m: any) => (
                  <SelectItem key={m.id} value={m.userId}>{m.firstName} {m.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 w-[130px] flex-shrink-0" data-testid="select-status-filter"><SelectValue placeholder="Filter" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-10 w-[150px] gap-1 flex-shrink-0" data-testid="select-sort"><ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" /><span className="text-muted-foreground">Sort:</span><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <TabsContent value="purchases" className="mt-0">{render(purchases, "purchase", "No purchase requests from team.")}</TabsContent>
          <TabsContent value="travels" className="mt-0">{render(travels, "travel", "No travel requests from team.")}</TabsContent>
          <TabsContent value="tickets" className="mt-0">{render(tickets, "ticket", "No tickets from team.")}</TabsContent>
        </Tabs>
      )}
    </div>
  );
}
