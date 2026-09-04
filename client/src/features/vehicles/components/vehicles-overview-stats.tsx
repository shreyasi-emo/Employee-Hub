import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Car, CircleCheck, Clock, ShieldCheck } from "lucide-react";

function OverviewStat({ icon: Icon, heading, value, sub, badge, valueClass = "text-foreground" }: any) {
  return (
    <div className="flex-1 min-w-[130px]">
      <div className="flex items-center gap-1.5 text-muted-foreground"><Icon className="h-4 w-4" /><span className="text-[11px] uppercase tracking-wide font-medium">{heading}</span></div>
      {badge ? (
        <div className="mt-1.5">{badge}</div>
      ) : (
        <p className="mt-1 flex items-baseline gap-1.5"><span className={`text-2xl font-bold tracking-tight tabular-nums ${valueClass}`}>{value}</span><span className="text-xs text-muted-foreground">{sub}</span></p>
      )}
    </div>
  );
}

/** Fleet size · confirmed today · free slots this week · whether rentals are on offer. */
export function VehiclesOverviewStats({ vehicleCount, confirmedToday, slotsThisWeek, rentalAvailable }: {
  vehicleCount: number; confirmedToday: number; slotsThisWeek: number; rentalAvailable: boolean;
}) {
  return (
    <Card className="border-0">
      <CardContent className="p-4 flex flex-wrap items-stretch gap-4">
        <OverviewStat icon={Car} heading="Company Vehicles" value={vehicleCount} sub="total" valueClass="text-[#206295]" />
        <Separator orientation="vertical" className="h-12 self-center bg-foreground/25 hidden md:block" />
        <OverviewStat icon={CircleCheck} heading="Confirmed" value={confirmedToday} sub="today" />
        <Separator orientation="vertical" className="h-12 self-center bg-foreground/25 hidden md:block" />
        <OverviewStat icon={Clock} heading="Slots Available" value={slotsThisWeek} sub="this week" valueClass="text-[#0E7C7B]" />
        <Separator orientation="vertical" className="h-12 self-center bg-foreground/25 hidden md:block" />
        <OverviewStat icon={ShieldCheck} heading="Rental Backup"
          badge={<Badge className={rentalAvailable ? "bg-[#4BDCD9]/25 text-[#0E7C7B]" : "bg-[#64748B]/15 text-[#64748B]"}>{rentalAvailable ? "Available on request" : "Unavailable"}</Badge>} />
      </CardContent>
    </Card>
  );
}
