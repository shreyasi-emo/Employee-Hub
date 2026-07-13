import { useLocation } from "wouter";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, Users, Clock, Calendar, Plane, DollarSign,
  Megaphone, Package, Shield, Settings, LogOut, Building2,
  FileText, Target, ClipboardList, Briefcase, ShoppingCart,
  Car, CreditCard, TicketIcon, CheckSquare, Inbox, Store, Truck, BookOpen, ScrollText,
} from "lucide-react";
import { useAuth, useLogout, isHR, isAdmin, hasWorkspaceAccess, isCEOApprover } from "@/lib/auth";
import BRAND from "@/lib/brand";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { getRoleLabel } from "@/lib/auth";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
}

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Employees", href: "/employees", icon: Users, roles: ["super_admin", "hr_admin", "hr_executive", "manager", "hr_ops"] },
  { title: "My Profile", href: "/employees/me", icon: Users, roles: ["employee", "recruiter", "interviewer"] },
  { title: "Attendance", href: "/attendance", icon: Clock },
  { title: "Leave", href: "/leave", icon: Plane },
  { title: "Holidays", href: "/holidays", icon: Calendar },
  { title: "Payroll", href: "/payroll", icon: DollarSign, roles: ["super_admin", "hr_admin", "finance", "employee", "manager", "hr_ops"] },
  { title: "Performance", href: "/performance", icon: Target },
  { title: "Announcements", href: "/announcements", icon: Megaphone },
  { title: "Assets", href: "/assets", icon: Package, roles: ["super_admin", "hr_admin", "hr_executive", "manager", "office_admin"] },
  { title: "Shifts", href: "/shifts", icon: Clock, roles: ["super_admin", "hr_admin", "hr_executive", "manager", "hr_ops"] },
  { title: "Onboarding", href: "/onboarding", icon: ClipboardList, roles: ["super_admin", "hr_admin", "hr_executive", "manager", "hr_ops"] },
];

const companyItems: NavItem[] = [
  { title: "Service Catalog", href: "/company-workspace", icon: Store },
  { title: "My Requests", href: "/my-requests", icon: ClipboardList },
  { title: "Team Requests", href: "/team-requests", icon: Users, roles: ["super_admin", "hr_admin", "hr_executive", "manager", "hr_ops", "office_admin", "ceo_approver"] },
  { title: "Requests", href: "/requests", icon: Inbox },
  { title: "Logistics", href: "/logistics", icon: Truck },
  { title: "Vehicles", href: "/vehicles", icon: Car },
  { title: "Resources", href: "/resources", icon: BookOpen },
  { title: "Approval Notes", href: "/approval-notes", icon: ScrollText, roles: ["super_admin", "ceo_approver", "hr_admin", "hr_executive", "hr_ops", "office_admin", "logistics", "finance"] },
];

const workspaceItems: NavItem[] = [
  { title: "ATS / Recruitment", href: "/workspace/ats", icon: Briefcase, roles: ["super_admin", "hr_admin", "hr_executive", "recruiter", "hr_ops"] },
  { title: "HR Ops", href: "/workspace/hr-ops", icon: CheckSquare, roles: ["super_admin", "hr_admin", "hr_executive", "hr_ops"] },
  { title: "Office Admin", href: "/workspace/office", icon: ShoppingCart, roles: ["super_admin", "hr_admin", "office_admin"] },
  { title: "CEO Inbox", href: "/workspace/approvals", icon: Inbox, roles: ["super_admin", "ceo_approver"] },
];

const adminItems: NavItem[] = [
  { title: "Admin Settings", href: "/admin", icon: Settings, roles: ["super_admin", "hr_admin", "hr_executive", "finance"] },
  { title: "Audit Logs", href: "/audit", icon: Shield, roles: ["super_admin", "hr_admin"] },
];

const accountItems: NavItem[] = [
  { title: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { data: auth } = useAuth();
  const logout = useLogout();
  const user = auth?.user;
  const emp = auth?.employee;

  const { data: pendingApprovals = [] } = useQuery<any[]>({
    queryKey: ["/api/workspace/approvals/pending"],
    enabled: isCEOApprover(user ?? null),
    refetchInterval: 60000,
  });

  const displayName = emp ? `${emp.firstName} ${emp.lastName}` : user?.username || "";
  const initials = emp ? `${emp.firstName[0]}${emp.lastName[0]}` : user?.username?.slice(0, 2).toUpperCase() || "U";

  const isActive = (href: string) => {
    if (href === "/") return location === "/" || location === "/dashboard";
    if (href === "/employees/me") return location.startsWith("/employees/") && location !== "/employees";
    return location.startsWith(href);
  };

  const canSee = (item: NavItem) => {
    if (!item.roles) return true;
    if (!user) return false;
    return item.roles.includes(user.role);
  };

  const roleLabel = getRoleLabel(user?.role as any) || "Employee";

  return (
    <Sidebar variant="sidebar">
      <SidebarHeader className="p-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Building2 className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-sm text-foreground leading-tight">{BRAND.APP_NAME}</span>
            <span className="text-xs text-muted-foreground leading-tight">{BRAND.COMPANY_NAME}</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-2 mb-1">Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {navItems.filter(canSee).map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                    className="rounded-md"
                  >
                    <a href={item.href} className="flex items-center gap-2.5 py-1.5">
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm">{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {companyItems.some(canSee) && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-2 mb-1">Company Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {companyItems.filter(canSee).map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href)}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                      className="rounded-md"
                    >
                      <a href={item.href} className="flex items-center gap-2.5 py-1.5">
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                        <span className="text-sm">{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {hasWorkspaceAccess(user ?? null) && workspaceItems.some(canSee) && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-2 mb-1">HR/Admin Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {workspaceItems.filter(canSee).map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href)}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                      className="rounded-md"
                    >
                      <a href={item.href} className="flex items-center gap-2.5 py-1.5">
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                        <span className="text-sm flex-1">{item.title}</span>
                        {item.href === "/workspace/approvals" && (pendingApprovals as any[]).length > 0 && (
                          <Badge className="h-4 min-w-4 px-1 text-[10px] bg-destructive text-destructive-foreground border-0 flex-shrink-0">
                            {(pendingApprovals as any[]).length}
                          </Badge>
                        )}
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {adminItems.some(canSee) && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-2 mb-1">Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {adminItems.filter(canSee).map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href)}
                      data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                      className="rounded-md"
                    >
                      <a href={item.href} className="flex items-center gap-2.5 py-1.5">
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                        <span className="text-sm">{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-2 mb-1">Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {accountItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                    className="rounded-md"
                  >
                    <a href={item.href} className="flex items-center gap-2.5 py-1.5">
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm">{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2.5 p-2 rounded-lg bg-sidebar-accent/50">
          <Avatar className="h-7 w-7 flex-shrink-0">
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-medium text-sidebar-foreground truncate leading-tight">{displayName}</span>
            <span className="text-xs text-muted-foreground leading-tight">{roleLabel}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0 text-muted-foreground"
            onClick={() => logout.mutate()}
            data-testid="button-sidebar-logout"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
