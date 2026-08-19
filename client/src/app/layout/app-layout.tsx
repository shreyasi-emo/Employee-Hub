import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { AppHeader } from "./app-header";

// Blue gradient sat behind the floating header so the glass reads over color, not a white band
const SHELL_BG =
  "linear-gradient(188deg, #799EBB -3.37%, #D2DDE6 63.4%, #E1E8ED 72.85%, #799EBB 152.94%)";

/** The signed-in chrome: sidebar + floating header + scrollable main. */
export function AppLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3.5rem",
  };
  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        {/* relative so the floating header can overlay as an absolute child,
            letting <main> span the full height (scrollbar not cut off by the header) */}
        <div className="relative flex flex-col flex-1 overflow-hidden" style={{ background: SHELL_BG }}>
          <AppHeader />
          <main className="flex-1 overflow-y-auto bg-transparent pt-[76px]">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
