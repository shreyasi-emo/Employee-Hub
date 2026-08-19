import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ALL_ROLES, getRoleLabel } from "@/lib/auth";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// TEMPORARY: dev-only role switcher. Lets a super_admin preview the app as any
// role. Only rendered in dev builds and only when the real role is super_admin.
export function DevRoleSwitcher({ auth }: { auth: any }) {
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
