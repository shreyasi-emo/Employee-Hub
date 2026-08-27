import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Truck, Plus } from "lucide-react";
import { useLogisticsRequests, useLogisticsLocations } from "../api/logistics.api";
import { RaiseLogisticsDialog } from "../components/raise-logistics-dialog";
import { LogisticsRequestCard } from "../components/logistics-request-card";
import { LogisticsDetailDialog } from "../components/logistics-detail-dialog";

const HANDLER_ROLES = ["super_admin", "logistics"];
const ACTIVE = ["pending", "in_progress"];

export default function LogisticsPage() {
  const { data: auth } = useAuth();
  const role = auth?.user?.role || "";
  const isHandler = HANDLER_ROLES.includes(role);
  const [tab, setTab] = useState("active");
  const [raise, setRaise] = useState(false);
  const [detail, setDetail] = useState<any>(null);

  const { data: requests = [] } = useLogisticsRequests();
  const { data: locations = [] } = useLogisticsLocations();
  const locName = (id: string) => locations.find((l: any) => l.id === id)?.name;

  const active = requests.filter((r) => ACTIVE.includes(r.status));
  const done = requests.filter((r) => !ACTIVE.includes(r.status));

  const List = ({ rows }: { rows: any[] }) => rows.length === 0
    ? <div className="card-surface rounded-2xl py-16 text-center"><Truck className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-sm text-muted-foreground">No logistics requests here.</p></div>
    : <div className="space-y-3">{rows.map((r) => <LogisticsRequestCard key={r.id} r={r} locName={locName} onOpen={setDetail} />)}</div>;

  return (
    <div className="p-6 space-y-6 max-w-[92rem] mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-xl bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0"><Truck className="h-5 w-5" /></span>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Logistics</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{isHandler ? "Process inward & outward movement requests" : "Raise and track your movement requests"}</p>
          </div>
        </div>
        <Button className="btn-primary-gradient" onClick={() => setRaise(true)} data-testid="logistics-raise"><Plus className="h-4 w-4 mr-1.5" /> Raise Request</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="done">Completed ({done.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-4"><List rows={active} /></TabsContent>
        <TabsContent value="done" className="mt-4"><List rows={done} /></TabsContent>
      </Tabs>

      <RaiseLogisticsDialog open={raise} onClose={() => setRaise(false)} locations={locations} />
      {detail && <LogisticsDetailDialog request={detail} isHandler={isHandler} isOwner={detail.requesterId === auth?.user?.id} locName={locName} onClose={() => setDetail(null)} />}
    </div>
  );
}
