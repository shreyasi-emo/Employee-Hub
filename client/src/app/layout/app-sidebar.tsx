import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton, SidebarHeader,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Building2, ChevronRight } from "lucide-react";
import { useAuth, hasWorkspaceAccess } from "@/lib/auth";
import BRAND from "@/lib/brand";
import { useCeoInboxCount } from "@/features/company-workspace/api/ceo-inbox.api";
import {
  navItems, companyItems, companyWorkspaceHub, companyWorkspaceChildren,
  workspaceItems, adminItems, accountItems,
  CEO_INBOX_HREF, type NavItem,
} from "./nav-items";

// Shared row look: airy height, rounded, larger plain icons, and an elevated "pill" when active.
// The two `!` overrides neutralise shadcn's built-in `[&>span:last-child]:truncate` so long labels
// (e.g. "Company Workspace") render in full instead of being clipped with an ellipsis.
const ROW_CLS =
  "h-auto min-h-[36px] py-2 gap-2.5 rounded-lg [&>svg]:size-[18px] " +
  "[&>span:last-child]:!whitespace-normal [&>span:last-child]:!overflow-visible [&>span:last-child]:leading-tight " +
  "data-[active=true]:bg-background data-[active=true]:font-semibold data-[active=true]:text-[#206295] " +
  "data-[active=true]:shadow-[0_1px_4px_rgba(44,62,98,0.14)]";

const SUB_ROW_CLS =
  "h-auto min-h-[32px] py-1.5 rounded-lg [&>span:last-child]:!whitespace-normal [&>span:last-child]:!overflow-visible " +
  "data-[active=true]:bg-background data-[active=true]:font-semibold " +
  "data-[active=true]:text-[#206295] data-[active=true]:shadow-[0_1px_4px_rgba(44,62,98,0.14)]";

// Per-item tree connector: a vertical segment (::before) + a horizontal tick (::after).
// Non-last items draw the full-height segment so the rail is continuous; the LAST item stops
// its segment at the tick (h-1/2) so the rail ends in an "└" instead of hanging below.
const BRANCH_CLS =
  "relative " +
  "before:absolute before:-left-[11px] before:top-0 before:h-full before:w-px before:bg-muted-foreground/35 before:content-[''] last:before:h-1/2 " +
  "after:absolute after:-left-[11px] after:top-1/2 after:h-px after:w-2.5 after:-translate-y-1/2 after:bg-muted-foreground/35 after:content-['']";

/** Client-side navigation for the sidebar's plain <a> links — keeps the href (for
 *  middle-click / open-in-new-tab / a11y) but intercepts a plain left-click so wouter
 *  navigates in-app instead of doing a full page reload. */
function handleNavClick(e: React.MouseEvent, href: string, navigate: (to: string) => void) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  navigate(href);
}

/** Small pill count badge (pending items). */
function CountBadge({ count, tone = "coral" }: { count: number; tone?: "coral" | "blue" | "teal" }) {
  const tones: Record<string, string> = {
    coral: "bg-[#FF6F62] text-white",
    blue: "bg-[#206295] text-white",
    teal: "bg-[#4BDCD9] text-[#0E7C7B]",
  };
  return (
    <span className={`ml-auto inline-flex items-center justify-center h-[18px] min-w-[18px] px-1.5 rounded-full text-[10px] font-bold leading-none tabular-nums flex-shrink-0 ${tones[tone]}`}>
      {count}
    </span>
  );
}

/** One labelled group of sidebar links. `renderBadge` renders a trailing count pill. */
function NavSection({ label, items, isActive, renderBadge }: {
  label: string;
  items: NavItem[];
  isActive: (href: string) => boolean;
  renderBadge?: (item: NavItem) => React.ReactNode;
}) {
  const [, navigate] = useLocation();
  return (
    <SidebarGroup className="py-1">
      <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-2 mb-1">{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-1">
          {items.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={isActive(item.href)}
                data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                className={ROW_CLS}
              >
                <a href={item.href} onClick={(e) => handleNavClick(e, item.href, navigate)}>
                  <item.icon className="flex-shrink-0" />
                  <span className="text-[14px] flex-1 leading-tight">{item.title}</span>
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

/** Company Workspace as a collapsible dropdown (reference: a category header with a connected
 *  sub-list). The row navigates to the hub page; the chevron on the right toggles the sub-menu
 *  (never navigates → never reloads). Children hang off a left rail with branch ticks. */
function CompanyWorkspaceSection({ hub, subItems, items, isActive }: {
  hub: NavItem; subItems: NavItem[]; items: NavItem[]; isActive: (href: string) => boolean;
}) {
  const [, navigate] = useLocation();
  const childActive = subItems.some((c) => isActive(c.href));
  const hubActive = isActive(hub.href);
  const [open, setOpen] = useState(childActive || hubActive);
  useEffect(() => { if (childActive || hubActive) setOpen(true); }, [childActive, hubActive]);

  return (
    <SidebarGroup className="py-1">
      <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-2 mb-1">Company</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-1">
          {subItems.length > 0 ? (
            <Collapsible open={open} onOpenChange={setOpen} asChild>
              <SidebarMenuItem>
                {/* Row navigates to the hub; only active on the hub page itself (not when a child is). */}
                <SidebarMenuButton asChild isActive={hubActive} className={`${ROW_CLS} pr-8`} data-testid="nav-company-workspace">
                  <a href={hub.href} onClick={(e) => handleNavClick(e, hub.href, navigate)}>
                    <hub.icon className="flex-shrink-0" />
                    <span className="text-[14px] flex-1 leading-tight">{hub.title}</span>
                  </a>
                </SidebarMenuButton>
                {/* Chevron toggle — a full-row-height button so the chevron is vertically centered with the icon + label. */}
                <button
                  type="button"
                  onClick={() => setOpen((o) => !o)}
                  aria-label="Toggle Company Workspace sub-menu"
                  aria-expanded={open}
                  className="absolute right-1 top-0 flex h-9 w-7 items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
                </button>
                <CollapsibleContent>
                  <SidebarMenuSub className="mr-0 gap-0 border-l-0">
                    {subItems.map((c) => (
                      <SidebarMenuSubItem key={c.href} className={BRANCH_CLS}>
                        <SidebarMenuSubButton asChild isActive={isActive(c.href)} className={SUB_ROW_CLS} data-testid={`nav-${c.title.toLowerCase().replace(/\s+/g, "-")}`}>
                          <a href={c.href} onClick={(e) => handleNavClick(e, c.href, navigate)}>
                            <c.icon className="h-4 w-4 flex-shrink-0" />
                            <span className="text-[13px] leading-tight">{c.title}</span>
                          </a>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          ) : (
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={hubActive} className={ROW_CLS} data-testid="nav-company-workspace">
                <a href={hub.href} onClick={(e) => handleNavClick(e, hub.href, navigate)}>
                  <hub.icon className="flex-shrink-0" />
                  <span className="text-[14px] flex-1 leading-tight">{hub.title}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {items.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton asChild isActive={isActive(item.href)} className={ROW_CLS} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                <a href={item.href} onClick={(e) => handleNavClick(e, item.href, navigate)}>
                  <item.icon className="flex-shrink-0" />
                  <span className="text-[14px] flex-1 leading-tight">{item.title}</span>
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
  const user = auth?.user;

  // CEO Inbox badge — the count itself is request-domain logic, so it lives in
  // features/requests; the sidebar just renders the number.
  const ceoInboxCount = useCeoInboxCount(user?.role === "super_admin");

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

        <CompanyWorkspaceSection
          hub={companyWorkspaceHub}
          subItems={companyWorkspaceChildren.filter(canSee)}
          items={companyNav}
          isActive={isActive}
        />

        {hasWorkspaceAccess(user ?? null) && workspaceNav.length > 0 && (
          <NavSection
            label="HR/Admin Workspace"
            items={workspaceNav}
            isActive={isActive}
            renderBadge={(item) =>
              item.href === CEO_INBOX_HREF && ceoInboxCount > 0 ? <CountBadge count={ceoInboxCount} tone="coral" /> : null
            }
          />
        )}

        {adminNav.length > 0 && (
          <NavSection label="Admin" items={adminNav} isActive={isActive} />
        )}

        <NavSection label="Account" items={accountItems} isActive={isActive} />
      </SidebarContent>
    </Sidebar>
  );
}
