// Sidebar navigation configuration.
//
// Single source of truth for what appears in the sidebar and which roles may see
// it. `roles` omitted means "everyone"; otherwise the user's role must be listed.
// Groups render in the order declared here (see app-sidebar.tsx).

import {
  LayoutDashboard, Users, Clock, Calendar, Plane, DollarSign,
  Megaphone, Package, Shield, Settings, Target, ClipboardList,
  Briefcase, ShoppingCart, Car, CheckSquare, Inbox, Store, Truck,
  BookOpen, ScrollText,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
}

// vercel-deploy build: Payroll, Performance, Assets, Shifts, Onboarding, Approval
// Notes, ATS, HR Ops and Audit are hidden here (routes removed in routes.tsx too).
// Admin Settings IS shown. Backend is untouched — this only trims the UI surface.
export const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Employees", href: "/employees", icon: Users, roles: ["super_admin", "hr_admin", "hr_executive"] },
  // A manager is scoped to their own team — direct reports only, no org-wide directory or dept filter.
  { title: "My Team", href: "/my-team", icon: Users, roles: ["manager"] },
  { title: "My Profile", href: "/employees/me", icon: Users, roles: ["employee", "recruiter", "interviewer"] },
  { title: "Attendance", href: "/attendance", icon: Clock },
  { title: "Leave", href: "/leave", icon: Plane },
  { title: "Holidays", href: "/holidays", icon: Calendar },
  { title: "Announcements", href: "/announcements", icon: Megaphone },
];

// The Company Workspace hub tab + its personal sub-pages. The sidebar renders these as a
// collapsible "Company Workspace" dropdown: My Requests always, My Approvals only for people
// who approve anything (office purchases / reimbursements / travel / CEO). Both are reachable
// from the /company-workspace hub too, so they don't need their own top-level nav entries.
export const companyWorkspaceHub: NavItem = { title: "Company Workspace", href: "/company-workspace", icon: Store };
export const companyWorkspaceChildren: NavItem[] = [
  { title: "My Requests", href: "/my-requests", icon: ClipboardList },
  { title: "Team Requests", href: "/team-requests", icon: Users, roles: ["super_admin", "hr_admin", "hr_executive", "manager", "hr_ops", "ceo_approver"] },
  { title: "My Approvals", href: "/my-approvals", icon: CheckSquare, roles: ["super_admin", "ceo_approver", "hr_admin", "hr_executive", "hr_ops", "finance"] },
];

export const companyItems: NavItem[] = [
  { title: "Logistics", href: "/logistics", icon: Truck },
  { title: "Vehicles", href: "/vehicles", icon: Car },
  { title: "Resources", href: "/resources", icon: BookOpen },
];

export const workspaceItems: NavItem[] = [
  { title: "CEO Inbox", href: "/workspace/approvals", icon: Inbox, roles: ["super_admin"] },
];

export const adminItems: NavItem[] = [
  { title: "Admin Settings", href: "/admin", icon: Settings, roles: ["super_admin", "hr_admin", "hr_executive", "finance"] },
];

// The nav item whose badge shows the CEO Inbox count.
export const CEO_INBOX_HREF = "/workspace/approvals";
