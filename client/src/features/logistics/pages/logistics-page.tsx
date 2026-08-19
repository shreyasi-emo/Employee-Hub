import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { LOGISTICS_ROLES, isTerminal } from "../lib/movement-status";
import { useMovements, useLogisticsLocations, useMovementAction } from "../api/logistics.api";
import { LogisticsHeader, NoActiveMovements, MovementList } from "../components/logistics-sections";
import { RaiseMovementDialog } from "../components/raise-movement-dialog";

export default function LogisticsPage() {
  const { data: auth } = useAuth();
  const { toast } = useToast();
  const isHandler = LOGISTICS_ROLES.includes(auth?.user?.role || "");
  const [tab, setTab] = useState("active");
  const [open, setOpen] = useState(false);

  const { data: movements = [] } = useMovements();
  const { data: locations = [] } = useLogisticsLocations();
  const action = useMovementAction({
    onSuccess: () => toast({ title: "Updated" }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const active = movements.filter((m) => !isTerminal(m.status));
  const done = movements.filter((m) => isTerminal(m.status));

  return (
    <div className="p-6 space-y-6">
      <LogisticsHeader onRaise={() => setOpen(true)} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="done">Completed ({done.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="space-y-3 mt-4">
          {active.length === 0
            ? <NoActiveMovements />
            : <MovementList movements={active} isHandler={isHandler} onAction={(id, op) => action.mutate({ id, op })} />}
        </TabsContent>
        <TabsContent value="done" className="space-y-3 mt-4">
          <MovementList movements={done} isHandler={isHandler} onAction={() => {}} />
        </TabsContent>
      </Tabs>

      <RaiseMovementDialog open={open} onOpenChange={setOpen} locations={locations} />
    </div>
  );
}
