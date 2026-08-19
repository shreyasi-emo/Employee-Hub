import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateInput } from "@/components/shared/datetime-field";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCreateMovement } from "../api/logistics.api";

const BLANK = {
  movementType: "parts", priority: "normal", isIntercity: false,
  items: [{ description: "", quantity: 1 }], notes: "", area: "",
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

export function RaiseMovementDialog({ open, onOpenChange, locations }: any) {
  const { toast } = useToast();
  const [form, setForm] = useState<any>({ ...BLANK, items: [{ description: "", quantity: 1 }] });

  const create = useCreateMovement({
    onSuccess: () => {
      toast({ title: "Movement raised" });
      onOpenChange(false);
      setForm({ ...BLANK, items: [{ description: "", quantity: 1 }] });
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
