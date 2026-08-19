import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Truck, Plus, Package } from "lucide-react";
import { MovementCard } from "./movement-card";

export function LogisticsHeader({ onRaise }: { onRaise: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Truck className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">Logistics</h1>
          <p className="text-sm text-muted-foreground">Material movement across sites</p>
        </div>
      </div>
      <Button onClick={onRaise}><Plus className="h-4 w-4 mr-1" /> Raise Movement</Button>
    </div>
  );
}

export function NoActiveMovements() {
  return (
    <Card><CardContent className="p-8 text-center text-muted-foreground">
      <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />No active movements
    </CardContent></Card>
  );
}

export function MovementList({ movements, isHandler, onAction }: {
  movements: any[]; isHandler: boolean; onAction: (id: string, op: string) => void;
}) {
  return (
    <>
      {movements.map((m) => <MovementCard key={m.id} m={m} isHandler={isHandler} onAction={onAction} />)}
    </>
  );
}
