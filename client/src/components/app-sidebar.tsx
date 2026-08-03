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

// MVP navigation: HR (Employees/Attendance/Leave), Company Workspace
// (Service Catalog + Reimbursement, My Requests, Company Car booking), Account.
const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Employees", href: "/employees", icon: Users, roles: ["super_admin", "hr_admin"] },
  { title: "My Profile", href: "/employees/me", icon: Users, roles: ["employee", "finance", "ceo_approver"] },
  { title: "Attendance", href: "/attendance", icon: Clock },
  { title: "Leave", href: "/leave", icon: Plane },
];

const companyItems: NavItem[] = [
  { title: "Service Catalog", href: "/company-workspace", icon: Store },
  { title: "My Requests", href: "/my-requests", icon: ClipboardList },
  { title: "Vehicles", href: "/vehicles", icon: Car },
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
