import { useLocation } from "wouter";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { LogOut, Building2 } from "lucide-react";
import { useAuth, useLogout, hasWorkspaceAccess, getRoleLabel } from "@/lib/auth";
import BRAND from "@/lib/brand";
import { useCeoInboxCount } from "@/features/requests/api/ceo-inbox.api";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  navItems, companyItems, workspaceItems, adminItems, accountItems,
  CEO_INBOX_HREF, type NavItem,
} from "./nav-items";

/** One labelled group of sidebar links. `renderBadge` opts the group into the
 *  badge slot (which also makes the label flex so the badge sits right-aligned). */
function NavSection({ label, items, isActive, renderBadge }: {
  label: string;
  items: NavItem[];
  isActive: (href: string) => boolean;
  renderBadge?: (item: NavItem) => React.ReactNode;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-2 mb-1">{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {items.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={isActive(item.href)}
                data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                className="rounded-md"
              >
                <a href={item.href} className="flex items-center gap-2.5 py-1.5">
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  <span className={renderBadge ? "text-sm flex-1" : "text-sm"}>{item.title}</span>
                  {renderBadge?.(item)}
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const [location] = useLocation();
  const { data: auth } = useAuth();
  const logout = useLogout();
  const user = auth?.user;
  const emp = auth?.employee;

  // CEO Inbox badge — the count itself is request-domain logic, so it lives in
  // features/requests; the sidebar just renders the number.
  const ceoInboxCount = useCeoInboxCount(user?.role === "super_admin");

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

  const companyNav = companyItems.filter(canSee);
  const workspaceNav = workspaceItems.filter(canSee);
  const adminNav = adminItems.filter(canSee);

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
        <NavSection label="Main Menu" items={navItems.filter(canSee)} isActive={isActive} />

        {companyNav.length > 0 && (
          <NavSection label="Company Workspace" items={companyNav} isActive={isActive} />
        )}

        {hasWorkspaceAccess(user ?? null) && workspaceNav.length > 0 && (
          <NavSection
            label="HR/Admin Workspace"
            items={workspaceNav}
            isActive={isActive}
            renderBadge={(item) =>
              item.href === CEO_INBOX_HREF && ceoInboxCount > 0 ? (
                <span className="inline-flex items-center justify-center h-[18px] min-w-[18px] px-1 rounded-full text-[10px] font-bold leading-none tabular-nums bg-[#FF6F62] text-white flex-shrink-0">
                  {ceoInboxCount}
                </span>
              ) : null
            }
          />
        )}

        {adminNav.length > 0 && (
          <NavSection label="Admin" items={adminNav} isActive={isActive} />
        )}

        <NavSection label="Account" items={accountItems} isActive={isActive} />
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
