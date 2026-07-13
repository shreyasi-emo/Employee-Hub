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

// Roles that exist in the DB enum (note: "logistics" is UI-only, not a valid DB role)
export const ALL_ROLES: UserRole[] = [
  "super_admin", "hr_admin", "hr_executive", "finance", "manager", "employee",
  "recruiter", "hr_ops", "office_admin", "ceo_approver", "interviewer",
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
  return hasRole(user, "super_admin", "hr_admin", "hr_executive", "recruiter", "hr_ops", "office_admin", "ceo_approver");
}

export function isCEOApprover(user: CurrentUser | null): boolean {
  return hasRole(user, "super_admin", "ceo_approver");
}

export function getRoleBadgeColor(role: UserRole): string {
  const colors: Record<string, string> = {
    super_admin: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    hr_admin: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    hr_executive: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    hr_ops: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
    finance: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    manager: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    recruiter: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
    office_admin: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    ceo_approver: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
    interviewer: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
    employee: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  };
  return colors[role] || colors.employee;
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
