import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Car, Plus, Pencil, Trash2, Search, Upload, X, Check, ChevronDown, Settings, ArrowLeft, Hash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { manageStatusBadge, driverInitials, empName } from "../lib/booking-visuals";
import { useSaveVehicle, useDeleteVehicle } from "../api/vehicles.api";

// ============================ Manage Vehicles (HR) ============================
const BLANK_VEHICLE = { id: null, name: "", model: "", registrationNo: "", baseLocation: "", driverName: "", driverPhone: "", driverUserId: "", fuelType: "Electric", transmission: "", seatingCapacity: "5", status: "active", imageUrl: "" };

function DriverSelect({ employees, driverUserId, driverName, onSelect }: any) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const list = (employees as any[]).filter((e) => e.firstName || e.lastName || e.username);
  const current = list.find((e) => (driverUserId && e.userId === driverUserId) || empName(e) === driverName);
  const visible = list.filter((e) => empName(e).toLowerCase().includes(search.trim().toLowerCase()));
  const pick = (e: any) => { onSelect(e); setOpen(false); setSearch(""); };
  return (
    // `modal` gives the popover its own scroll context so the mouse wheel works even though it's
    // nested inside the Manage Vehicles Dialog (whose scroll-lock would otherwise block wheel events).
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        {current ? (
          <button type="button" className="w-full flex items-center gap-2 rounded-[16px] border-[1.5px] border-[#206295] bg-[#206295]/[0.06] px-2.5 py-1.5 text-left" data-testid="driver-select">
            <Avatar className="h-7 w-7 flex-shrink-0"><AvatarImage src={current.avatarUrl} /><AvatarFallback className="text-[10px] bg-[#206295]/15 text-[#206295]">{driverInitials(empName(current))}</AvatarFallback></Avatar>
            <span className="text-sm font-medium text-foreground truncate flex-1">{empName(current)}</span>
            <ChevronDown className="h-4 w-4 text-[#206295] flex-shrink-0" />
          </button>
        ) : (
          <button type="button" className="w-full flex items-center justify-between rounded-[16px] border-[1.5px] border-[#206295] bg-[#206295]/[0.06] px-3 py-2 text-sm font-medium text-[#206295]" data-testid="driver-select">
            <span className="inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Assign Driver</span>
            <ChevronDown className="h-4 w-4" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[14rem] p-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people…" className="h-8 text-xs mb-1.5" data-testid="driver-search" />
        <div className="max-h-56 overflow-y-auto space-y-0.5">
          {current && <button type="button" onClick={() => pick(null)} className="w-full text-left rounded-[12px] px-2 py-1.5 text-xs text-muted-foreground hover-elevate">Clear assignment</button>}
          {visible.length === 0 ? <p className="text-xs text-muted-foreground px-1 py-2">No matches</p> : visible.map((e) => {
            const name = empName(e); const sel = current?.id === e.id;
            return (
              <button key={e.id} type="button" onClick={() => pick(e)} className="w-full flex items-center gap-2 rounded-[12px] px-2 py-1.5 text-sm text-left hover-elevate" data-testid={`driver-opt-${e.id}`}>
                <Avatar className="h-6 w-6 flex-shrink-0"><AvatarImage src={e.avatarUrl} /><AvatarFallback className="text-[9px] bg-[#206295]/15 text-[#206295]">{driverInitials(name)}</AvatarFallback></Avatar>
                <span className="flex-1 truncate">{name}</span>
                {sel && <Check className="h-4 w-4 text-[#206295] flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ManageVehicleDialog({ open, onClose, vehicles, employees }: any) {
  const { toast } = useToast();
  const [screen, setScreen] = useState<"list" | "form">(vehicles.length ? "list" : "form");
  const [form, setForm] = useState<any>({ ...BLANK_VEHICLE });
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const editing = !!form.id;

  const startAdd = () => { setForm({ ...BLANK_VEHICLE }); setScreen("form"); };
  const startEdit = (v: any) => { setForm({ id: v.id, name: v.name || "", model: v.model || "", registrationNo: v.registrationNo || "", baseLocation: v.baseLocation || "", driverName: v.driverName || "", driverPhone: v.driverPhone || "", driverUserId: v.driverUserId || "", fuelType: v.fuelType || "", transmission: v.transmission || "", seatingCapacity: v.seatingCapacity != null ? String(v.seatingCapacity) : "", status: v.status || "active", imageUrl: v.imageUrl || "" }); setScreen("form"); };
  const backToList = () => { setForm({ ...BLANK_VEHICLE }); setScreen("list"); };

  const onMutationError = (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" });
  const save = useSaveVehicle({
    onSuccess: () => { toast({ title: editing ? "Vehicle updated" : "Vehicle added" }); backToList(); },
    onError: onMutationError,
  });
  const del = useDeleteVehicle({ onSuccess: () => toast({ title: "Vehicle deleted" }), onError: onMutationError });

  const onFile = async (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return toast({ title: "Unsupported image", description: "Use JPG, PNG or WebP.", variant: "destructive" });
    if (file.size > 3 * 1024 * 1024) return toast({ title: "Image too large", description: "Maximum size is 3 MB.", variant: "destructive" });
    const dataUrl: string = await new Promise((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result as string); fr.onerror = reject; fr.readAsDataURL(file); });
    set("imageUrl", dataUrl);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg h-[85vh] p-0 overflow-hidden gap-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-3 flex-shrink-0 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            {screen === "form" && vehicles.length > 0 && (
              <button onClick={backToList} className="inline-flex items-center text-muted-foreground hover:text-foreground" data-testid="manage-back"><ArrowLeft className="h-4 w-4" /></button>
            )}
            {screen === "form" ? (editing ? "Edit Vehicle" : "Add Vehicle") : "Manage Company Vehicles"}
          </DialogTitle>
        </DialogHeader>

        {screen === "list" ? (
          <>
            {/* Vehicle cards — Edit/Delete surface on hover in the top-right corner */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="px-6 pb-4 space-y-3">
                {vehicles.length === 0 ? (
                  <div className="text-center py-12"><Car className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm text-muted-foreground">No vehicles yet.</p></div>
                ) : vehicles.map((v: any) => (
                  <div key={v.id} className="group relative card-surface rounded-xl p-3 flex items-center gap-3" data-testid={`manage-vehicle-${v.id}`}>
                    <div className="h-14 w-20 rounded-lg bg-muted/40 overflow-hidden flex items-center justify-center border border-border/60 flex-shrink-0">
                      {v.imageUrl ? <img src={v.imageUrl} alt={v.name} className="max-h-full max-w-full object-contain" /> : <Car className="h-5 w-5 text-muted-foreground/40" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{v.model || v.name}</p>
                      <p className="text-xs text-muted-foreground truncate inline-flex items-center gap-1"><Hash className="h-3 w-3" />{v.registrationNo || "—"}</p>
                      <Badge className={`text-[10px] mt-1 capitalize ${manageStatusBadge(v.status)}`}>{v.status}</Badge>
                    </div>
                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(v)} className="h-7 w-7 rounded-lg bg-background border border-border flex items-center justify-center text-[#206295] hover:bg-[#206295]/10" title="Edit" data-testid={`edit-vehicle-${v.id}`}><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => { if (window.confirm(`Delete “${v.name}”? This cannot be undone.`)) del.mutate(v.id); }} disabled={del.isPending} className="h-7 w-7 rounded-lg bg-background border border-border flex items-center justify-center text-[#FF6F62] hover:bg-[#FF6F62]/10" title="Delete" data-testid={`delete-vehicle-${v.id}`}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            {/* Fixed action footer — same pattern as the reimbursement approval popup */}
            <div className="flex-shrink-0 border-t border-border bg-background px-6 py-4">
              <Button variant="secondaryB" className="w-full" style={{ borderRadius: "16px" }} onClick={startAdd} data-testid="add-vehicle"><Plus className="h-4 w-4 mr-1.5" /> Add Vehicle</Button>
            </div>
          </>
        ) : (
          <>
            <ScrollArea className="flex-1 min-h-0">
              <div className="px-6 pb-4 space-y-3">
                {/* Image upload + preview */}
                <div className="flex items-center gap-3">
                  {form.imageUrl
                    ? <img src={form.imageUrl} alt="preview" className="h-16 w-24 rounded-lg object-cover border border-border/60" />
                    : <div className="h-16 w-24 rounded-lg bg-muted flex items-center justify-center border border-border/60"><Car className="h-5 w-5 text-muted-foreground/50" /></div>}
                  <div className="flex flex-col gap-1.5">
                    <label className="inline-flex items-center gap-1.5 text-xs text-[#206295] cursor-pointer hover:underline">
                      <Upload className="h-3.5 w-3.5" /> {form.imageUrl ? "Change photo" : "Upload photo"}
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} data-testid="vehicle-image" />
                    </label>
                    {form.imageUrl && <button className="text-[11px] text-muted-foreground hover:text-[#FF6F62] text-left" onClick={() => set("imageUrl", "")}>Remove photo</button>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1 col-span-2"><Label className="text-xs">Model *</Label><Input value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="Toyota Innova Crysta" data-testid="vehicle-model" /></div>
                  <div className="space-y-1"><Label className="text-xs">Reg. No.</Label><Input value={form.registrationNo} onChange={(e) => set("registrationNo", e.target.value)} placeholder="MH-01-AB-1234" /></div>
                  <div className="space-y-1"><Label className="text-xs">Base Location</Label><Input value={form.baseLocation} onChange={(e) => set("baseLocation", e.target.value)} placeholder="HQ" /></div>
                  <div className="space-y-1"><Label className="text-xs">Seating Capacity</Label><Input type="number" min="1" value={form.seatingCapacity} onChange={(e) => set("seatingCapacity", e.target.value)} placeholder="5" data-testid="vehicle-seating" /></div>
                  <div className="space-y-1"><Label className="text-xs">Fuel Type</Label>
                    <Select value={form.fuelType} onValueChange={(v) => set("fuelType", v)}>
                      <SelectTrigger data-testid="vehicle-fuel"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{["Petrol", "Diesel", "Electric", "CNG", "Hybrid"].map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Transmission</Label>
                    <Select value={form.transmission} onValueChange={(v) => set("transmission", v)}>
                      <SelectTrigger data-testid="vehicle-transmission"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{["Manual", "Automatic"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 col-span-2"><Label className="text-xs">Assign Driver</Label>
                    <DriverSelect employees={employees} driverUserId={form.driverUserId} driverName={form.driverName}
                      onSelect={(e: any) => {
                        if (!e) { set("driverName", ""); set("driverUserId", ""); set("driverPhone", ""); return; }
                        set("driverName", empName(e));
                        set("driverUserId", e.userId || "");
                        // Auto-fetch the driver's phone from their employee record.
                        set("driverPhone", e.phone || e.personalPhone || e.contactNumber || e.mobile || "");
                      }} />
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Driver Phone</Label><Input type="tel" inputMode="tel" value={form.driverPhone} onChange={(e) => set("driverPhone", e.target.value)} placeholder="+91…" /></div>
                  <div className="space-y-1"><Label className="text-xs">Status</Label>
                    <Select value={form.status} onValueChange={(v) => set("status", v)}>
                      <SelectTrigger data-testid="vehicle-status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </ScrollArea>
            <div className="flex-shrink-0 border-t border-border bg-background px-6 py-4 flex items-center justify-end gap-3">
              <Button variant="outline" onClick={vehicles.length ? backToList : onClose}>Cancel</Button>
              <Button disabled={save.isPending || !form.model.trim()} onClick={() => save.mutate(form)} data-testid="save-vehicle">{save.isPending ? "Saving…" : editing ? "Update Vehicle" : "Add Vehicle"}</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

