import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/shared/stat-card";
import { DataTable } from "@/components/shared/data-table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Users, FileText, CalendarClock, Mail, UserCheck, UserPlus, Search, ArrowDownUp, Eye, MoreVertical, Copy, Download, Plus, CheckCircle2, XCircle, SlidersHorizontal, X, type LucideIcon } from "lucide-react";
import { format } from "date-fns";
import { AddCandidateDialog } from "./add-candidate-dialog";
import { OnboardDialog } from "./onboard-dialog";

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

const SORT_LABELS: Record<string, string> = { activity: "Latest Activity", newest: "Newest", oldest: "Oldest" };

type StepKey = "doc_collection" | "date_of_joining" | "offer_letter" | "ready_to_onboard" | "onboarded" | "cancelled";
const STEPS: Record<StepKey, { label: string; icon: LucideIcon; status: string; pill: string; tint: string }> = {
  doc_collection: { label: "Document Collection", icon: FileText, status: "In Progress", pill: "bg-[#206295]/15 text-[#206295]", tint: "bg-[#206295]/10 text-[#206295]" },
  date_of_joining: { label: "Date of Joining", icon: CalendarClock, status: "Pending", pill: "bg-[#D98324]/20 text-[#D98324]", tint: "bg-[#D98324]/10 text-[#D98324]" },
  offer_letter: { label: "Offer Letter", icon: Mail, status: "Pending", pill: "bg-[#D98324]/20 text-[#D98324]", tint: "bg-[#206295]/10 text-[#206295]" },
  ready_to_onboard: { label: "Ready to Onboard", icon: UserCheck, status: "Pending", pill: "bg-[#D98324]/20 text-[#D98324]", tint: "bg-[#206295]/10 text-[#206295]" },
  onboarded: { label: "Onboarded", icon: CheckCircle2, status: "Completed", pill: "bg-[#4BDCD9]/25 text-[#0E7C7B]", tint: "bg-[#4BDCD9]/25 text-[#0E7C7B]" },
  cancelled: { label: "Cancelled", icon: XCircle, status: "Cancelled", pill: "bg-[#64748B]/15 text-[#64748B]", tint: "bg-[#64748B]/15 text-[#64748B]" },
};
const stepOf = (r: any): StepKey => {
  if (r.status === "onboarded") return "onboarded";
  if (r.status === "cancelled") return "cancelled";
  if (r.status === "sent") return "doc_collection";
  if (!r.joinDate) return "date_of_joining";
  if (!r.offerLetter) return "offer_letter";
  return "ready_to_onboard";
};
const initials = (n?: string) => (n || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

export function OnboardingDashboard() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"all" | StepKey>("all");
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("all");
  const [position, setPosition] = useState("all");
  const [sortBy, setSortBy] = useState("activity");
  const [add, setAdd] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: requests = [] } = useQuery<any[]>({ queryKey: ["/api/onboarding/doc-requests"] });
  const rows = Array.isArray(requests) ? requests : [];
  const withStep = useMemo(() => rows.map((r) => ({ ...r, step: stepOf(r) })), [rows]);

  const counts = useMemo(() => {
    const c: any = { total: withStep.length };
    (Object.keys(STEPS) as StepKey[]).forEach((k) => (c[k] = withStep.filter((r) => r.step === k).length));
    return c;
  }, [withStep]);

  const departments = useMemo(() => Array.from(new Set(rows.map((r) => r.department).filter(Boolean))) as string[], [rows]);
  const positions = useMemo(() => Array.from(new Set(rows.map((r) => r.position).filter(Boolean))) as string[], [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = withStep.filter((r) => (tab === "all" ? true : r.step === tab));
    if (dept !== "all") list = list.filter((r) => r.department === dept);
    if (position !== "all") list = list.filter((r) => r.position === position);
    if (q) list = list.filter((r) => `${r.candidateName || ""} ${r.candidateEmail || ""} ${r.position || ""} ${r.department || ""}`.toLowerCase().includes(q));
    const upd = (r: any) => +new Date(r.updatedAt || r.createdAt || 0);
    const crt = (r: any) => +new Date(r.createdAt || 0);
    return [...list].sort((a, b) => (sortBy === "newest" ? crt(b) - crt(a) : sortBy === "oldest" ? crt(a) - crt(b) : upd(b) - upd(a)));
  }, [withStep, tab, dept, position, search, sortBy]);

  const copyLink = (r: any) => { navigator.clipboard?.writeText(`${window.location.origin}/onboard/${r.token}`); toast({ title: "Link copied" }); };
  const exportCsv = () => {
    const head = ["S.No.", "Candidate", "Email", "Position", "Department", "Current Step", "Status", "Last Activity"];
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = filtered.map((r, i) => [i + 1, r.candidateName, r.candidateEmail, r.position || "", r.department || "", STEPS[r.step as StepKey].label, STEPS[r.step as StepKey].status, r.updatedAt ? format(new Date(r.updatedAt), "d MMM yyyy") : ""].map(esc).join(","));
    const blob = new Blob([[head.map(esc).join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "onboarding.csv"; a.click(); URL.revokeObjectURL(url);
  };

  const TABS: ("all" | StepKey)[] = ["all", "doc_collection", "date_of_joining", "offer_letter", "ready_to_onboard", "onboarded", "cancelled"];

  return (
    <div className="p-6 space-y-6 max-w-[92rem] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Onboarding</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track and manage the onboarding process of all candidates.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Desktop: Export + Add Candidate inline (unchanged). */}
          <div className="hidden sm:flex items-center gap-2">
            <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1.5" /> Export</Button>
            <Button className="btn-primary-gradient" onClick={() => setAdd(true)} data-testid="onboarding-add-candidate"><Plus className="h-4 w-4 mr-1.5" /> Add Candidate</Button>
          </div>
          {/* Mobile: Add Candidate visible; Export folds into a kebab. */}
          <div className="flex sm:hidden items-center gap-2 w-full">
            <Button className="btn-primary-gradient" onClick={() => setAdd(true)} data-testid="onboarding-add-candidate-mobile"><Plus className="h-4 w-4 mr-1.5" /> Add Candidate</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="ml-auto" aria-label="More actions" data-testid="onboarding-more-mobile"><MoreVertical className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportCsv} data-testid="menu-export-onboarding"><Download className="h-4 w-4 mr-2" /> Export</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="Total Initiated" value={counts.total} subtitle="All time" icon={Users} color="bg-[#206295]/10 text-[#206295]" />
        <StatCard title="Doc Collection" value={counts.doc_collection} subtitle="In progress" icon={FileText} color="bg-[#0E7C7B]/10 text-[#0E7C7B]" />
        <StatCard title="Date of Joining" value={counts.date_of_joining} subtitle="Pending" icon={CalendarClock} color="bg-[#D98324]/15 text-[#D98324]" />
        <StatCard title="Offer Letter" value={counts.offer_letter} subtitle="Pending" icon={Mail} color="bg-[#206295]/10 text-[#206295]" />
        <StatCard title="Ready to Onboard" value={counts.ready_to_onboard} subtitle="Pending" icon={UserCheck} color="bg-[#206295]/10 text-[#206295]" />
        <StatCard title="Onboarded" value={counts.onboarded} subtitle="Completed" icon={UserPlus} color="bg-[#0E7C7B]/10 text-[#0E7C7B]" />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="flex-wrap h-auto">
          {TABS.map((t) => <TabsTrigger key={t} value={t} data-testid={`onb-tab-${t}`}>{t === "all" ? "All" : STEPS[t].label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      {/* Toolbar */}
      {(() => {
        const chips: { key: string; label: string; onClear: () => void }[] = [];
        if (dept !== "all") chips.push({ key: "dept", label: dept, onClear: () => setDept("all") });
        if (position !== "all") chips.push({ key: "position", label: position, onClear: () => setPosition("all") });
        if (sortBy !== "activity") chips.push({ key: "sort", label: SORT_LABELS[sortBy] ?? sortBy, onClear: () => setSortBy("activity") });
        const resetAll = () => { setDept("all"); setPosition("all"); setSortBy("activity"); };
        return (
          <>
            {/* Desktop: search + department + position + sort inline (unchanged). */}
            <div className="hidden sm:flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[12rem]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, or candidate ID…" className="pl-8 h-10 w-full" data-testid="onb-search" />
              </div>
              <Select value={dept} onValueChange={setDept}>
                <SelectTrigger className="h-10 w-[160px] flex-shrink-0"><SelectValue placeholder="Department" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All departments</SelectItem>{departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger className="h-10 w-[160px] flex-shrink-0"><SelectValue placeholder="Position" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All positions</SelectItem>{positions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-10 w-[200px] gap-1 flex-shrink-0"><ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" /><span className="text-muted-foreground">Sort:</span><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="activity">Latest Activity</SelectItem><SelectItem value="newest">Newest</SelectItem><SelectItem value="oldest">Oldest</SelectItem></SelectContent>
              </Select>
            </div>

            {/* Mobile: search + Filters on one row; department + position + sort behind one badged Filters sheet. */}
            <div className="sm:hidden space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, or candidate ID…" className="pl-8 h-10 w-full" data-testid="onb-search-mobile" />
                </div>
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-shrink-0" data-testid="button-filters-mobile">
                      <SlidersHorizontal className="h-4 w-4 mr-1.5" /> Filters
                      {chips.length > 0 && <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#206295] px-1 text-[10px] font-bold text-white">{chips.length}</span>}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
                    <SheetHeader className="text-left"><SheetTitle>Filters</SheetTitle></SheetHeader>
                    <div className="space-y-4 py-4">
                      <FilterField label="Department">
                        <Select value={dept} onValueChange={setDept}>
                          <SelectTrigger className="w-full" data-testid="sheet-dept"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="all">All departments</SelectItem>{departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                        </Select>
                      </FilterField>
                      <FilterField label="Position">
                        <Select value={position} onValueChange={setPosition}>
                          <SelectTrigger className="w-full" data-testid="sheet-position"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="all">All positions</SelectItem>{positions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                        </Select>
                      </FilterField>
                      <FilterField label="Sort">
                        <Select value={sortBy} onValueChange={setSortBy}>
                          <SelectTrigger className="w-full" data-testid="sheet-sort"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="activity">Latest Activity</SelectItem><SelectItem value="newest">Newest</SelectItem><SelectItem value="oldest">Oldest</SelectItem></SelectContent>
                        </Select>
                      </FilterField>
                    </div>
                    <SheetFooter className="flex-row gap-2">
                      <Button variant="outline" className="flex-1" onClick={resetAll} data-testid="sheet-reset">Reset</Button>
                      <SheetClose asChild><Button className="flex-1 btn-primary-gradient text-white" data-testid="sheet-apply">Show results</Button></SheetClose>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>
              </div>
              {chips.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {chips.map((c) => (
                    <button key={c.key} onClick={c.onClear} className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2.5 py-1 text-xs text-foreground hover-elevate" data-testid={`chip-${c.key}`}>
                      <span className="truncate max-w-[8rem]">{c.label}</span> <X className="h-3 w-3 flex-shrink-0" />
                    </button>
                  ))}
                  {chips.length > 1 && <button onClick={resetAll} className="text-xs font-medium text-[#206295] underline underline-offset-2" data-testid="chip-clear-all">Clear all</button>}
                </div>
              )}
            </div>
          </>
        );
      })()}

      {/* Table */}
      <Card className="border-0"><CardContent className="p-0">
        <DataTable
          columns={[
            { key: "candidate", header: "Candidate", cellClassName: "min-w-0", render: (r: any) => (
              <div className="flex items-center gap-3 min-w-0">
                <span className="h-9 w-9 rounded-full bg-[#206295]/10 text-[#206295] text-xs font-bold flex items-center justify-center flex-shrink-0">{initials(r.candidateName)}</span>
                <div className="min-w-0"><p className="font-medium text-foreground truncate">{r.candidateName || "—"}</p><p className="text-xs text-muted-foreground truncate">{r.candidateEmail || "—"}</p></div>
              </div>
            ) },
            { key: "sno", header: "S.No.", cellClassName: "text-muted-foreground whitespace-nowrap", render: (r: any) => r._sno },
            { key: "position", header: "Position", cellClassName: "text-foreground", render: (r: any) => r.position || "—" },
            { key: "department", header: "Department", cellClassName: "text-muted-foreground", render: (r: any) => r.department || "—" },
            { key: "step", header: "Current Step", render: (r: any) => {
              const s = STEPS[r.step as StepKey];
              return (
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 ${s.tint}`}><s.icon className="h-3.5 w-3.5" /></span>
                  <p className="text-foreground truncate">{s.label}</p>
                </div>
              );
            } },
            { key: "status", header: "Status", render: (r: any) => { const s = STEPS[r.step as StepKey]; return <Badge className={`text-xs ${s.pill}`}>{s.status}</Badge>; } },
            { key: "activity", header: "Last Activity", cellClassName: "text-muted-foreground whitespace-nowrap", render: (r: any) => (r.updatedAt ? <div><p>{format(new Date(r.updatedAt), "d MMM yyyy")}</p><p className="text-xs">{format(new Date(r.updatedAt), "h:mm a")}</p></div> : "—") },
            { key: "actions", header: "", align: "right", render: (r: any) => (
              <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setOpenId(r.id)} data-testid={`onb-view-${r.id}`}><Eye className="h-4 w-4" /></Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => setOpenId(r.id)}><Eye className="h-4 w-4 mr-2" /> {r.status === "submitted" ? "Review & onboard" : "View details"}</DropdownMenuItem>
                    {r.status !== "onboarded" && <DropdownMenuItem onClick={() => copyLink(r)}><Copy className="h-4 w-4 mr-2" /> Copy link</DropdownMenuItem>}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) },
          ]}
          rows={filtered.map((r, i) => ({ ...r, _sno: i + 1 }))}
          getRowKey={(r: any) => r.id}
          onRowClick={(r: any) => setOpenId(r.id)}
          emptyText="No candidates yet. Use “Add Candidate” to send a document-collection link."
          testIdPrefix="onb-row"
        />
      </CardContent></Card>

      <AddCandidateDialog open={add} onClose={() => setAdd(false)} />
      <OnboardDialog requestId={openId} open={!!openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
