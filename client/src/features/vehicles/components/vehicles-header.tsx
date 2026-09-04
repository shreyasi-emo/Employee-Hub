import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Car, BarChart3, Settings, MoreVertical } from "lucide-react";

/** Title bar. HR also gets the Manage Bookings / Rental Requests mode toggle and
 *  the two admin actions. */
export function VehiclesHeader({ isHrAdmin, mode, onMode, pendingRentalCount, onTrackUsage, onManageVehicles }: {
  isHrAdmin: boolean;
  mode: "calendar" | "requests";
  onMode: (m: "calendar" | "requests") => void;
  pendingRentalCount: number;
  onTrackUsage: () => void;
  onManageVehicles: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3">
        <span className="h-10 w-10 rounded-xl bg-[#206295]/10 text-[#206295] flex items-center justify-center"><Car className="h-5 w-5" /></span>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vehicles</h1>
          <p className="text-sm text-muted-foreground">Book the company car directly, or request a rental</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {isHrAdmin && (
          <>
            <div className="segmented-toggle inline-flex p-0.5 h-10">
              <button onClick={() => onMode("calendar")} className={`px-3 h-full rounded-[10px] text-xs font-medium ${mode === "calendar" ? "btn-primary-gradient text-white" : "text-foreground/70"}`} data-testid="mode-calendar">Manage Bookings</button>
              <button onClick={() => onMode("requests")} className={`px-3 h-full rounded-[10px] text-xs font-medium ${mode === "requests" ? "btn-primary-gradient text-white" : "text-foreground/70"}`} data-testid="mode-requests">Rental Requests{pendingRentalCount ? ` (${pendingRentalCount})` : ""}</button>
            </div>
            {/* Desktop: divider + the two secondary actions inline (unchanged). */}
            <div className="hidden sm:flex items-center gap-2">
              <Separator orientation="vertical" className="self-stretch bg-border mx-1" />
              <Button variant="outline" size="sm" className="h-10" onClick={onTrackUsage} data-testid="track-usage"><BarChart3 className="h-4 w-4 mr-1.5" /> Track Usage</Button>
              <Button variant="outline" size="sm" className="h-10" onClick={onManageVehicles} data-testid="manage-vehicle"><Settings className="h-4 w-4 mr-1.5" /> Manage Vehicles</Button>
            </div>
            {/* Mobile: the two admin actions fold into a kebab beside the mode toggle. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-10 w-10 sm:hidden" aria-label="More actions" data-testid="vehicles-more"><MoreVertical className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onTrackUsage} data-testid="menu-track-usage"><BarChart3 className="h-4 w-4 mr-2" /> Track Usage</DropdownMenuItem>
                <DropdownMenuItem onClick={onManageVehicles} data-testid="menu-manage-vehicle"><Settings className="h-4 w-4 mr-2" /> Manage Vehicles</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </div>
  );
}
