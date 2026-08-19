import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/shared/datetime-field";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Truck, Plus, Trash2, MapPin, Package, ArrowRight } from "lucide-react";
import { format } from "date-fns";

const LOGISTICS_ROLES = ["super_admin", "logistics", "hr_admin"];

const statusColors: Record<string, string> = {
  submitted: "bg-blue-500/10 text-blue-700",
  needs_approval: "bg-amber-500/10 text-amber-700",
  approved: "bg-green-500/10 text-green-700",
  rejected: "bg-red-500/10 text-red-700",
  accepted: "bg-emerald-500/10 text-emerald-700",
  dispatched: "bg-violet-500/10 text-violet-700",
  in_transit: "bg-indigo-500/10 text-indigo-700",
  delivered: "bg-teal-500/10 text-teal-700",
  cancelled: "bg-gray-500/10 text-gray-700",
};

function ItemRow({ item, onChange, onRemove }: any) {
  return (
    <div className="grid grid-cols-12 gap-2 items-end">
      <div className="col-span-4">
        <Input placeholder="Description" value={item.description || ""}
          onChange={e => onChange({ ...item, description: e.target.value })} />
      </div>
      <div className="col-span-2">
        <Input type="number" placeholder="Qty" value={item.quantity ?? ""}
          onChange={e => onChange({ ...item, quantity: Number(e.target.value) })} />
      </div>
      <div className="col-span-2">
        <Input type="number" step="0.001" placeholder="Wt (kg)" value={item.weightKg ?? ""}
          onChange={e => onChange({ ...item, weightKg: Number(e.target.value) })} />
      </div>
      <div className="col-span-3">
        <Input placeholder="L×W×H (cm)" value={item.dimensions || ""}
          onChange={e => onChange({ ...item, dimensions: e.target.value })} />
      </div>
      <div className="col-span-1">
        <Button variant="ghost" size="icon" onClick={onRemove}><Trash2 className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

function RaiseMovementDialog({ open, onOpenChange, locations }: any) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({
    movementType: "parts", priority: "normal", isIntercity: false,
    items: [{ description: "", quantity: 1 }], notes: "", area: "",
  });

  const create = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/logistics/movements", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/logistics/movements"] });
      toast({ title: "Movement raised" });
      onOpenChange(false);
      setForm({ movementType: "parts", priority: "normal", isIntercity: false, items: [{ description: "", quantity: 1 }], notes: "", area: "" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const totalWeight = form.items.reduce((s: number, it: any) => s + (Number(it.weightKg) || 0), 0);
  const totalQty = form.items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Raise Movement Request</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">From</label>
              <Select value={form.fromLocationId || ""} onValueChange={v => setForm((f: any) => ({ ...f, fromLocationId: v }))}>
                <SelectTrigger><SelectValue placeholder="Pick location" /></SelectTrigger>
                <SelectContent>
                  {locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input className="mt-1" placeholder="…or type address" value={form.fromLocationText || ""}
                onChange={e => setForm((f: any) => ({ ...f, fromLocationText: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">To</label>
              <Select value={form.toLocationId || ""} onValueChange={v => setForm((f: any) => ({ ...f, toLocationId: v }))}>
                <SelectTrigger><SelectValue placeholder="Pick location" /></SelectTrigger>
                <SelectContent>
                  {locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input className="mt-1" placeholder="…or type address" value={form.toLocationText || ""}
                onChange={e => setForm((f: any) => ({ ...f, toLocationText: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium">Type</label>
              <Select value={form.movementType} onValueChange={v => setForm((f: any) => ({ ...f, movementType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="parts">Parts / components</SelectItem>
                  <SelectItem value="battery_transfer">Battery transfer</SelectItem>
                  <SelectItem value="customer_shipment">Customer shipment</SelectItem>
                  <SelectItem value="return">Return</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Priority</label>
              <Select value={form.priority} onValueChange={v => setForm((f: any) => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Needed by</label>
              <DateInput value={form.requestedDate || ""} onChange={v => setForm((f: any) => ({ ...f, requestedDate: v }))} />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Area</label>
            <Input value={form.area} onChange={e => setForm((f: any) => ({ ...f, area: e.target.value }))} placeholder="e.g. R&D, Service, Customer" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Items</label>
              <div className="text-xs text-muted-foreground">Total qty: {totalQty} · Total wt: {totalWeight.toFixed(2)} kg</div>
            </div>
            <div className="space-y-2">
              {form.items.map((it: any, i: number) => (
                <ItemRow key={i} item={it}
                  onChange={(v: any) => setForm((f: any) => ({ ...f, items: f.items.map((x: any, j: number) => j === i ? v : x) }))}
                  onRemove={() => setForm((f: any) => ({ ...f, items: f.items.filter((_: any, j: number) => j !== i) }))} />
              ))}
              <Button size="sm" variant="outline" onClick={() => setForm((f: any) => ({ ...f, items: [...f.items, { description: "", quantity: 1 }] }))}>
                <Plus className="h-3 w-3 mr-1" /> Add item
              </Button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Notes</label>
            <Textarea value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} rows={2} />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => create.mutate({ ...form, totalWeightKg: totalWeight, totalQuantity: totalQty })} disabled={create.isPending}>
              {create.isPending ? "Raising…" : "Raise Movement"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MovementCard({ m, isHandler, onAction }: any) {
  const fromLabel = m.fromLocationText || m.fromLocationId || "—";
  const toLabel = m.toLocationText || m.toLocationId || "—";
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{m.reference}</span>
              <Badge className={statusColors[m.status] || ""}>{m.status.replace(/_/g, " ")}</Badge>
              {m.priority !== "normal" && <Badge variant="outline">{m.priority}</Badge>}
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm">
              <MapPin className="h-3 w-3" /> {fromLabel}
              <ArrowRight className="h-3 w-3" /> {toLabel}
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {m.requestedDate && <div>Needed {format(new Date(m.requestedDate), "d MMM")}</div>}
            <div>{format(new Date(m.createdAt), "d MMM yyyy")}</div>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {(m.items || []).length} item(s) · {m.totalQuantity ?? 0} units · {m.totalWeightKg ?? 0} kg
        </div>
        {m.notes && <p className="text-sm">{m.notes}</p>}
        {isHandler && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {m.status === "submitted" && <>
              <Button size="sm" onClick={() => onAction(m.id, "accept")}>Accept</Button>
              <Button size="sm" variant="outline" onClick={() => onAction(m.id, "escalate")}>Escalate to CEO</Button>
              <Button size="sm" variant="ghost" onClick={() => onAction(m.id, "reject")}>Reject</Button>
            </>}
            {m.status === "accepted" && <Button size="sm" onClick={() => onAction(m.id, "dispatch")}>Mark dispatched</Button>}
            {m.status === "dispatched" && <Button size="sm" onClick={() => onAction(m.id, "in-transit")}>Mark in transit</Button>}
            {(m.status === "dispatched" || m.status === "in_transit") && <Button size="sm" onClick={() => onAction(m.id, "deliver")}>Mark delivered</Button>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function LogisticsPage() {
  const { data: auth } = useAuth();
  const isHandler = LOGISTICS_ROLES.includes(auth?.user?.role || "");
  const [tab, setTab] = useState("active");
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: movements = [] } = useQuery<any[]>({ queryKey: ["/api/logistics/movements"] });
  const { data: locations = [] } = useQuery<any[]>({ queryKey: ["/api/logistics/locations"] });

  const action = useMutation({
    mutationFn: ({ id, op }: any) => apiRequest("POST", `/api/logistics/movements/${id}/${op}`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/logistics/movements"] }); toast({ title: "Updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const active = movements.filter(m => !["delivered", "cancelled", "rejected"].includes(m.status));
  const done = movements.filter(m => ["delivered", "cancelled", "rejected"].includes(m.status));

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
