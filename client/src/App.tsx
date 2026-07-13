import { Switch, Route, useLocation, Redirect } from "wouter";
import { QueryClientProvider, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeProvider } from "@/components/theme-provider";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import EmployeesPage from "@/pages/employees";
import EmployeeProfilePage from "@/pages/employee-profile";
import AttendancePage from "@/pages/attendance";
import LeavePage from "@/pages/leave";
import HolidaysPage from "@/pages/holidays";
import PayrollPage from "@/pages/payroll";
import AdminPage from "@/pages/admin";
import AnnouncementsPage from "@/pages/announcements";
import AssetsPage from "@/pages/assets";
import AuditPage from "@/pages/audit";
import PerformancePage from "@/pages/performance";
import SettingsPage from "@/pages/settings";
import InviteAcceptPage from "@/pages/invite-accept";
import ShiftsPage from "@/pages/shifts";
import OnboardingPage from "@/pages/onboarding";
import ATSPage from "@/pages/workspace/ats";
import HROpsPage from "@/pages/workspace/hr-ops";
import OfficeAdminPage from "@/pages/workspace/office";
import ApprovalsPage from "@/pages/workspace/approvals";
import CompanyWorkspacePage from "@/pages/company-workspace";
import ReimbursementReviewPage from "@/pages/reimbursement-review";
import MyRequestsPage from "@/pages/my-requests";
import TeamRequestsPage from "@/pages/team-requests";
import LogisticsPage from "@/pages/logistics";
import RequestsPage from "@/pages/requests";
import ApprovalNotesPage from "@/pages/approval-notes";
import VehiclesPage from "@/pages/vehicles";
import ResourcesPage from "@/pages/resources";
import ReimbursementsPage from "@/pages/reimbursements";
import NotFound from "@/pages/not-found";
import {
  Bell, Check, CheckCheck, LogOut, Settings, User,
  IndianRupee, Plane, ShoppingCart, LifeBuoy, ClipboardCheck, CheckCircle2,
  XCircle, Cake, Gift, UserPlus, CalendarClock, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useLogout, ALL_ROLES } from "@/lib/auth";
import { getRoleLabel } from "@/lib/auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { useLocation as useWouterLocation } from "wouter";

// Default-avatar shades (brand colors) for employee DPs in notifications
const NOTIF_AVATAR_PALETTE = ["#206295", "#4BDCD9", "#FF6F62"];
function notifAvatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return NOTIF_AVATAR_PALETTE[h % NOTIF_AVATAR_PALETTE.length];
}

// Map a notification type to a clean icon + brand-tinted circular badge.
// Keyword-based so any type variant resolves to a sensible icon.
function notifVisual(type: string): { icon: any; cls: string } {
  const t = (type || "").toLowerCase();
  const TEAL = "bg-[#4BDCD9]/25 text-[#206295]";
  const BLUE = "bg-[#206295]/15 text-[#206295]";
  const CORAL = "bg-[#FF6F62]/15 text-[#FF6F62]";
  const GREY = "bg-[#6A7366]/15 text-[#6A7366]";
  if (t.includes("reject")) return { icon: XCircle, cls: CORAL };
  if (t.includes("reimburse")) return { icon: IndianRupee, cls: TEAL };
  if (t.includes("birthday")) return { icon: Cake, cls: TEAL };
  if (t.includes("anniversary")) return { icon: Gift, cls: BLUE };
  if (t.includes("leave") || t.includes("travel")) return { icon: Plane, cls: BLUE };
  if (t.includes("purchase")) return { icon: ShoppingCart, cls: TEAL };
  if (t.includes("ticket") || t.includes("support")) return { icon: LifeBuoy, cls: BLUE };
  if (t.includes("approved") || t.includes("fulfilled") || t.includes("done")) return { icon: CheckCircle2, cls: TEAL };
  if (t.includes("approval") || t.includes("pending") || t.includes("submitted")) return { icon: ClipboardCheck, cls: BLUE };
  if (t.includes("regulariz") || t.includes("attendance")) return { icon: CalendarClock, cls: BLUE };
  if (t.includes("employee") || t.includes("onboard") || t.includes("hr") || t.includes("invite")) return { icon: UserPlus, cls: BLUE };
  return { icon: Info, cls: GREY };
}

const NOTIF_EMPLOYEE_TYPES = ["leave", "reimburse", "travel", "purchase", "birthday", "anniversary", "employee", "onboard", "ticket"];
// Best-effort: pull a person's name from the notification text so we can show their DP.
function notifEmployeeName(n: any): string | null {
  const isEmpRelated = NOTIF_EMPLOYEE_TYPES.some((k) => (n.type || "").toLowerCase().includes(k));
  if (!isEmpRelated) return null;
  const text = `${n.body || ""} ${n.title || ""}`;
  let m = text.match(/\(([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,2})\)/);
  if (m) return m[1];
  m = text.match(/\b(?:by|from|for)\s+([A-Z][a-z]+\s[A-Z][a-z]+)/);
  if (m) return m[1];
  return null;
}

function NotificationBell() {
  const qc = useQueryClient();
  const [, navigate] = useWouterLocation();
  const [open, setOpen] = useState(false);

  const { data: notifs = [] } = useQuery<any[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 15000,
  });

  const unread = notifs.filter((n: any) => !n.readAt).length;

  const markRead = useMutation({
    mutationFn: (id: string) => apiRequest("PUT", `/api/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const markAll = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/notifications/read-all"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="btn-glass relative h-10 w-10 rounded-[16px] flex items-center justify-center text-muted-foreground hover:text-muted-foreground" data-testid="button-notifications">
          <Bell style={{ width: 22, height: 22 }} />
          {unread > 0 && (
            <Badge className="no-default-hover-elevate !absolute -bottom-1 -right-1 h-[18px] min-w-[18px] px-1 rounded-full text-[10px] leading-none flex items-center justify-center bg-destructive text-destructive-foreground border-2 border-background shadow-sm" data-testid="badge-notification-count">
              {unread > 9 ? "9+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 max-h-[70vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <h4 className="text-sm font-semibold">Notifications</h4>
          {unread > 0 && (
            <button
              onClick={() => markAll.mutate()}
              className="text-xs text-[#206295] hover:underline flex items-center gap-1"
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="h-3 w-3" /> Mark all read
            </button>
          )}
        </div>
        <ScrollArea className="flex-1 min-h-0">
          {notifs.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No notifications
            </div>
          ) : (
            <div className="list-divider">
              {notifs.map((n: any) => {
                const v = notifVisual(n.type);
                const empName = notifEmployeeName(n);
                const Icon = v.icon;
                const ac = empName ? notifAvatarColor(empName) : "";
                return (
                <div
                  key={n.id}
                  title={[n.title, n.body].filter(Boolean).join("\n")}
                  className={`group relative flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/40 ${!n.readAt ? "bg-[#206295]/[0.04]" : ""}`}
                  onClick={() => {
                    if (!n.readAt) markRead.mutate(n.id);
                    setOpen(false);
                    if (n.link) navigate(n.link);
                  }}
                  data-testid={`notification-${n.id}`}
                >
                  {empName ? (
                    <Avatar className="h-9 w-9 flex-shrink-0">
                      <AvatarFallback className="text-xs font-semibold" style={{ backgroundColor: `${ac}26`, color: ac }}>
                        {empName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${v.cls}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-sm font-semibold text-foreground leading-snug">{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 group-hover:line-clamp-none leading-snug">{n.body}</p>}
                    <p className="text-[11px] text-muted-foreground/70 mt-1">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  {!n.readAt && <span className="absolute top-3 right-4 h-2 w-2 rounded-full bg-[#206295]" />}
                </div>
                ); })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

// TEMPORARY: dev-only role switcher. Lets a super_admin preview the app as any
// role. Only rendered in dev builds and only when the real role is super_admin.
function DevRoleSwitcher({ auth }: { auth: any }) {
  const qc = useQueryClient();
  if (!import.meta.env.DEV) return null;
  if (auth?.realRole !== "super_admin") return null;

  async function switchRole(role: string) {
    await apiRequest("POST", "/api/auth/dev-role", { role });
    qc.clear(); // drop all role-scoped cached data so the whole app re-evaluates
    window.location.reload();
  }

  return (
    <Select value={auth?.user?.role} onValueChange={switchRole}>
      <SelectTrigger
        className="h-10 w-[160px] text-xs rounded-[16px] border-0 bg-transparent opacity-75 shadow-none"
        data-testid="select-dev-role"
      >
        <SelectValue placeholder="View as role" />
      </SelectTrigger>
      <SelectContent>
        {ALL_ROLES.map((r) => (
          <SelectItem key={r} value={r} className="text-xs">
            View as: {getRoleLabel(r)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Floating glassmorphic top header bar styling
const HEADER_STYLE: React.CSSProperties = {
  borderRadius: 20,
  background:
    "linear-gradient(rgba(255,255,255,0.10), rgba(255,255,255,0.10)), rgba(255,255,255,0.50)",
  backgroundBlendMode: "overlay",
  boxShadow:
    "0 0 8px rgba(44,62,98,0.15), inset 2px 2px 2px -2px #fff, inset -2px -2px 2px -2px #fff, 0 8px 12px rgba(0,0,0,0.08)",
};

// Blue gradient sat behind the floating header so the glass reads over color, not a white band
const SHELL_BG =
  "linear-gradient(188deg, #799EBB -3.37%, #D2DDE6 63.4%, #E1E8ED 72.85%, #799EBB 152.94%)";

function AppHeader() {
  const { data: auth } = useAuth();
  const logout = useLogout();

  const user = auth?.user;
  const emp = auth?.employee;
  const initials = emp ? `${emp.firstName[0]}${emp.lastName[0]}` : user?.username?.slice(0, 2).toUpperCase() || "U";
  const displayName = emp ? `${emp.firstName} ${emp.lastName}` : user?.username || "";

  return (
    <header
      className="h-14 flex items-center justify-between px-4 backdrop-blur-md absolute top-3 left-4 right-4 sm:left-6 sm:right-6 z-50"
      style={HEADER_STYLE}
    >
      <div className="flex items-center gap-2">
        <SidebarTrigger data-testid="button-sidebar-toggle" className="-ml-1" />
      </div>
      <div className="flex items-center gap-2">
        <DevRoleSwitcher auth={auth} />
        <NotificationBell />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2" data-testid="button-user-menu">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-sm font-medium leading-none">{displayName}</span>
                <span className="text-xs text-muted-foreground leading-none mt-0.5">
                  {getRoleLabel(user?.role as any)}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{displayName}</span>
                <span className="text-xs font-normal text-muted-foreground">{user?.username}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {emp && (
              <DropdownMenuItem asChild>
                <a href={`/employees/${emp.id}`} data-testid="link-my-profile">
                  <User className="h-4 w-4 mr-2" /> My Profile
                </a>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <a href="/payroll" data-testid="link-my-payslips">My Payslips</a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="/settings" data-testid="link-settings">
                <Settings className="h-4 w-4 mr-2" /> Settings
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout.mutate()} data-testid="button-logout" className="text-destructive">
              <LogOut className="h-4 w-4 mr-2" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3.5rem",
  };
  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        {/* relative so the floating header can overlay as an absolute child,
            letting <main> span the full height (scrollbar not cut off by the header) */}
        <div className="relative flex flex-col flex-1 overflow-hidden" style={{ background: SHELL_BG }}>
          <AppHeader />
          <main className="flex-1 overflow-y-auto bg-transparent pt-[76px]">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { data: auth, isLoading, error } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-3 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (error || !auth?.user) {
    return <Redirect to="/login" />;
  }

  return (
    <AuthenticatedLayout>
      <Component />
    </AuthenticatedLayout>
  );
}

function Router() {
  const { data: auth, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading && location !== "/login") {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto">
            <span className="text-primary-foreground font-bold text-lg">E</span>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-32 mx-auto" />
            <Skeleton className="h-3 w-24 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/invite/:token" component={() => <InviteAcceptPage mode="invite" />} />
      <Route path="/reset-password/:token" component={() => <InviteAcceptPage mode="reset" />} />
      <Route path="/" component={() => <Redirect to="/dashboard" />} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={DashboardPage} />} />
      <Route path="/employees" component={() => <ProtectedRoute component={EmployeesPage} />} />
      <Route path="/employees/:id" component={() => <ProtectedRoute component={EmployeeProfilePage} />} />
      <Route path="/attendance" component={() => <ProtectedRoute component={AttendancePage} />} />
      <Route path="/leave" component={() => <ProtectedRoute component={LeavePage} />} />
      <Route path="/holidays" component={() => <ProtectedRoute component={HolidaysPage} />} />
      <Route path="/payroll" component={() => <ProtectedRoute component={PayrollPage} />} />
      <Route path="/announcements" component={() => <ProtectedRoute component={AnnouncementsPage} />} />
      <Route path="/assets" component={() => <ProtectedRoute component={AssetsPage} />} />
      <Route path="/admin" component={() => <ProtectedRoute component={AdminPage} />} />
      <Route path="/audit" component={() => <ProtectedRoute component={AuditPage} />} />
      <Route path="/performance" component={() => <ProtectedRoute component={PerformancePage} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={SettingsPage} />} />
      <Route path="/shifts" component={() => <ProtectedRoute component={ShiftsPage} />} />
      <Route path="/onboarding" component={() => <ProtectedRoute component={OnboardingPage} />} />
      <Route path="/workspace/ats" component={() => <ProtectedRoute component={ATSPage} />} />
      <Route path="/workspace/hr-ops" component={() => <ProtectedRoute component={HROpsPage} />} />
      <Route path="/workspace/office" component={() => <ProtectedRoute component={OfficeAdminPage} />} />
      <Route path="/workspace/approvals" component={() => <ProtectedRoute component={ApprovalsPage} />} />
      <Route path="/company-workspace" component={() => <ProtectedRoute component={CompanyWorkspacePage} />} />
      <Route path="/my-approvals" component={() => <ProtectedRoute component={CompanyWorkspacePage} />} />
      <Route path="/my-approvals/reimbursement/:id" component={() => <ProtectedRoute component={ReimbursementReviewPage} />} />
      <Route path="/my-requests" component={() => <ProtectedRoute component={MyRequestsPage} />} />
      <Route path="/my-requests/:tab" component={() => <ProtectedRoute component={MyRequestsPage} />} />
      <Route path="/team-requests" component={() => <ProtectedRoute component={TeamRequestsPage} />} />
      <Route path="/logistics" component={() => <ProtectedRoute component={LogisticsPage} />} />
      <Route path="/requests" component={() => <ProtectedRoute component={RequestsPage} />} />
      <Route path="/approval-notes" component={() => <ProtectedRoute component={ApprovalNotesPage} />} />
      <Route path="/vehicles" component={() => <ProtectedRoute component={VehiclesPage} />} />
      <Route path="/resources" component={() => <ProtectedRoute component={ResourcesPage} />} />
      <Route path="/reimbursements" component={() => <ProtectedRoute component={ReimbursementsPage} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
