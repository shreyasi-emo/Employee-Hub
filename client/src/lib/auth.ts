import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "./queryClient";

export type UserRole =
  | "super_admin" | "hr_admin" | "hr_executive" | "finance" | "manager" | "employee"
  | "recruiter" | "hr_ops" | "office_admin" | "ceo_approver" | "interviewer" | "logistics";

export interface CurrentUser {
  id: string;
  username: string;
  role: UserRole;
  employeeId?: string;
  isActive: boolean;
}

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeCode: string;
  departmentId?: string;
  designationId?: string;
  managerId?: string;
  workLocation?: string;
  employmentStatus: string;
  avatarUrl?: string;
}

export interface AuthState {
  user: CurrentUser | null;
  employee: Employee | null;
  realRole?: UserRole;   // actual logged-in role (before dev impersonation)
  devRole?: UserRole | null; // role currently being impersonated, if any
}

// Roles that can be ASSIGNED. Not the same as the DB enum:
//  - "logistics" is the Logistics Manager role — sees & processes all logistics requests.
//  - "office_admin" is retired. It stays in the DB enum (Postgres cannot drop an enum value)
//    and keeps its label + colour below so historical rows still render — it simply cannot be
//    handed out any more. Its module now belongs to super_admin / hr_admin / hr_executive.
//    To bring it back: add it here and to ROLE_OPTIONS in features/employees/lib/employee-constants.
export const ALL_ROLES: UserRole[] = [
  "super_admin", "hr_admin", "hr_executive", "finance", "manager", "employee",
  "recruiter", "hr_ops", "ceo_approver", "interviewer", "logistics",
];

export function useAuth() {
  return useQuery<AuthState | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: Infinity,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { username: string; password: string }) =>
      apiRequest("POST", "/api/auth/login", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/auth/me"] }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/logout", {}),
    onSuccess: () => {
      qc.clear();
      window.location.href = "/login";
    },
  });
}

export function hasRole(user: CurrentUser | null, ...roles: UserRole[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}

export function isHR(user: CurrentUser | null): boolean {
  return hasRole(user, "super_admin", "hr_admin", "hr_executive", "hr_ops");
}

export function isAdmin(user: CurrentUser | null): boolean {
  return hasRole(user, "super_admin", "hr_admin");
}

export function isFinance(user: CurrentUser | null): boolean {
  return hasRole(user, "super_admin", "hr_admin", "finance");
}

export function isManager(user: CurrentUser | null): boolean {
  return hasRole(user, "super_admin", "hr_admin", "hr_executive", "manager");
}

export function hasWorkspaceAccess(user: CurrentUser | null): boolean {
  return hasRole(user, "super_admin", "hr_admin", "hr_executive", "recruiter", "hr_ops", "ceo_approver");
}

export function isCEOApprover(user: CurrentUser | null): boolean {
  return hasRole(user, "super_admin", "ceo_approver");
}

export function getRoleBadgeColor(role: UserRole): string {
  // Brand palette only (mirrors lib/status.ts): blue = leadership, teal = HR/ops,
  // coral = finance, grey = everyone else. Labels carry the finer distinction.
  const BLUE = "bg-[#206295]/15 text-[#206295]";
  const TEAL = "bg-[#4BDCD9]/25 text-[#0E7C7B]";
  const CORAL = "bg-[#FF6F62]/20 text-[#FF6F62]";
  const GREY = "bg-[#64748B]/15 text-[#64748B]";
  const colors: Record<string, string> = {
    super_admin: TEAL,
    ceo_approver: TEAL,
    hr_admin: BLUE,
    hr_executive: BLUE,
    hr_ops: BLUE,
    office_admin: BLUE,
    finance: CORAL,
    manager: GREY,
    recruiter: GREY,
    interviewer: GREY,
    logistics: GREY,
    employee: GREY,
  };
  return colors[role] || GREY;
}

export function getRoleLabel(role: UserRole): string {
  const labels: Record<string, string> = {
    super_admin: "Super Admin",
    hr_admin: "HR Admin",
    hr_executive: "HR Executive",
    hr_ops: "HR Ops",
    finance: "Finance",
    manager: "Manager",
    recruiter: "Recruiter",
    office_admin: "Office Admin",
    ceo_approver: "CEO / Approver",
    interviewer: "Interviewer",
    logistics: "Logistics",
    employee: "Employee",
  };
  return labels[role] || role;
}
