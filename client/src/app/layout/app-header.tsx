import { LogOut, User } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth, useLogout, getRoleLabel } from "@/lib/auth";
import { NotificationBell } from "@/features/notifications/components/notification-bell";

// Floating glassmorphic top header bar styling
const HEADER_STYLE: React.CSSProperties = {
  borderRadius: 20,
  background:
    "linear-gradient(rgba(255,255,255,0.10), rgba(255,255,255,0.10)), rgba(255,255,255,0.50)",
  backgroundBlendMode: "overlay",
  boxShadow:
    "0 0 8px rgba(44,62,98,0.15), inset 2px 2px 2px -2px #fff, inset -2px -2px 2px -2px #fff, 0 8px 12px rgba(0,0,0,0.08)",
};

export function AppHeader() {
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
