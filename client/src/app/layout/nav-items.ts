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

export const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Employees", href: "/employees", icon: Users, roles: ["super_admin", "hr_admin", "hr_executive", "manager"] },
  { title: "My Profile", href: "/employees/me", icon: Users, roles: ["employee", "recruiter", "interviewer"] },
  { title: "Attendance", href: "/attendance", icon: Clock },
  { title: "Leave", href: "/leave", icon: Plane },
  { title: "Holidays", href: "/holidays", icon: Calendar },
  { title: "Payroll", href: "/payroll", icon: DollarSign, roles: ["super_admin", "hr_admin", "finance", "employee", "manager", "hr_ops"] },
  { title: "Performance", href: "/performance", icon: Target },
  { title: "Announcements", href: "/announcements", icon: Megaphone },
  { title: "Assets", href: "/assets", icon: Package, roles: ["super_admin", "hr_admin", "hr_executive", "manager"] },
  { title: "Shifts", href: "/shifts", icon: Clock, roles: ["super_admin", "hr_admin", "hr_executive", "manager", "hr_ops"] },
  { title: "Onboarding", href: "/onboarding", icon: ClipboardList, roles: ["super_admin", "hr_admin", "hr_executive", "manager", "hr_ops"] },
];

export const companyItems: NavItem[] = [
  { title: "Company Workspace", href: "/company-workspace", icon: Store },
  { title: "My Requests", href: "/my-requests", icon: ClipboardList },
  { title: "Team Requests", href: "/team-requests", icon: Users, roles: ["super_admin", "hr_admin", "hr_executive", "manager", "hr_ops", "ceo_approver"] },
  { title: "Requests", href: "/requests", icon: Inbox },
  { title: "Logistics", href: "/logistics", icon: Truck },
  { title: "Vehicles", href: "/vehicles", icon: Car },
  { title: "Resources", href: "/resources", icon: BookOpen },
  { title: "Approval Notes", href: "/approval-notes", icon: ScrollText, roles: ["super_admin", "ceo_approver", "hr_admin", "hr_executive", "hr_ops", "logistics", "finance"] },
];

export const workspaceItems: NavItem[] = [
  { title: "ATS / Recruitment", href: "/workspace/ats", icon: Briefcase, roles: ["super_admin", "hr_admin", "hr_executive", "recruiter", "hr_ops"] },
  { title: "HR Ops", href: "/workspace/hr-ops", icon: CheckSquare, roles: ["super_admin", "hr_admin", "hr_executive", "hr_ops"] },
  // Vendors, purchase requests and payments. Was the office_admin role's module; that role is
  // retired, so it belongs to the HR side now. finance is listed because the API already grants
  // it access — the link was previously missing, so finance could call it but never see it.
  { title: "Office Admin", href: "/workspace/office", icon: ShoppingCart, roles: ["super_admin", "hr_admin", "hr_executive", "finance"] },
  { title: "CEO Inbox", href: "/workspace/approvals", icon: Inbox, roles: ["super_admin"] },
];

export const adminItems: NavItem[] = [
  { title: "Admin Settings", href: "/admin", icon: Settings, roles: ["super_admin", "hr_admin", "hr_executive", "finance"] },
  { title: "Audit Logs", href: "/audit", icon: Shield, roles: ["super_admin", "hr_admin"] },
];

export const accountItems: NavItem[] = [
  { title: "Settings", href: "/settings", icon: Settings },
];

// The nav item whose badge shows the CEO Inbox count.
export const CEO_INBOX_HREF = "/workspace/approvals";
