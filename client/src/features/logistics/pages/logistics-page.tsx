import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Truck, Plus, Package } from "lucide-react";
import { LOGISTICS_ROLES, isTerminal } from "../lib/movement-status";
import { useMovements, useLogisticsLocations, useMovementAction } from "../api/logistics.api";
import { RaiseMovementDialog } from "../components/raise-movement-dialog";
import { MovementCard } from "../components/movement-card";

export default function LogisticsPage() {
  const { data: auth } = useAuth();
  const isHandler = LOGISTICS_ROLES.includes(auth?.user?.role || "");
  const [tab, setTab] = useState("active");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const { data: movements = [] } = useMovements();
  const { data: locations = [] } = useLogisticsLocations();

  const action = useMovementAction({
    onSuccess: () => toast({ title: "Updated" }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const active = movements.filter(m => !isTerminal(m.status));
  const done = movements.filter(m => isTerminal(m.status));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Truck className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-bold">Logistics</h1>
            <p className="text-sm text-muted-foreground">Material movement across sites</p>
          </div>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Raise Movement</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="done">Completed ({done.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="space-y-3 mt-4">
          {active.length === 0 ? <Card><CardContent className="p-8 text-center text-muted-foreground"><Package className="h-8 w-8 mx-auto mb-2 opacity-30" />No active movements</CardContent></Card>
            : active.map(m => <MovementCard key={m.id} m={m} isHandler={isHandler} onAction={(id: string, op: string) => action.mutate({ id, op })} />)}
        </TabsContent>
        <TabsContent value="done" className="space-y-3 mt-4">
          {done.map(m => <MovementCard key={m.id} m={m} isHandler={isHandler} onAction={() => {}} />)}
        </TabsContent>
      </Tabs>

      <RaiseMovementDialog open={open} onOpenChange={setOpen} locations={locations} />
    </div>
  );
}
