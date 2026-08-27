import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Plus, MapPin } from "lucide-react";
import { useSaveLocation } from "../api/logistics.api";

const BLANK = { name: "", type: "internal", city: "", address: "", contactPerson: "", contactPhone: "" };

export function ManageLocationsDialog({ open, onClose, locations = [] }: { open: boolean; onClose: () => void; locations?: any[] }) {
  const { toast } = useToast();
  const [f, setF] = useState<any>({ ...BLANK });
  const save = useSaveLocation({
    onSuccess: () => { toast({ title: "Location saved" }); setF({ ...BLANK }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[86vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-[#206295]" /> Common locations</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {locations.length > 0 && (
            <ScrollArea className="max-h-[30vh] pr-3 -mr-3">
              <div className="space-y-2">
                {locations.map((l: any) => (
                  <div key={l.id} className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0"><p className="text-sm font-medium text-foreground truncate">{l.name}</p><p className="text-xs text-muted-foreground truncate">{[l.city, l.address].filter(Boolean).join(" · ") || l.type}</p></div>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground flex-shrink-0">{l.type}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          <div className="border-t border-border pt-3 space-y-3">
            <p className="text-sm font-semibold text-foreground">Add a location</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-[11px]">Name <span className="text-[#FF6F62]">*</span></Label><Input className="h-9" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Bengaluru Warehouse" /></div>
              <div className="space-y-1">
                <Label className="text-[11px]">Type</Label>
                <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v })}>
                  <SelectTrigger className="h-9 capitalize"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Internal (office / warehouse)</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-[11px]">City</Label><Input className="h-9" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-[11px]">Contact person</Label><Input className="h-9" value={f.contactPerson} onChange={(e) => setF({ ...f, contactPerson: e.target.value })} /></div>
              <div className="space-y-1 col-span-2"><Label className="text-[11px]">Address</Label><Input className="h-9" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-[11px]">Contact phone</Label><Input className="h-9" type="tel" inputMode="tel" value={f.contactPhone} onChange={(e) => setF({ ...f, contactPhone: e.target.value })} /></div>
            </div>
            <div className="flex justify-end">
              <Button size="sm" className="btn-primary-gradient" disabled={!f.name.trim() || save.isPending} onClick={() => save.mutate({ data: { ...f, name: f.name.trim() } })}><Plus className="h-4 w-4 mr-1.5" /> Add location</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
