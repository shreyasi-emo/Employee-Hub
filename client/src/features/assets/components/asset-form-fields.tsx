import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateInput } from "@/components/shared/datetime-field";
import { categoryColors, conditionColors } from "../lib/asset-taxonomy";

/** The shared field set behind both Add Asset and Edit Asset. */
export function AssetFormFields({ form, setForm, employees }: { form: any; setForm: any; employees: any[] }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Asset Name *</label>
          <Input value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} className="mt-1" data-testid="input-asset-name" />
        </div>
        <div>
          <label className="text-sm font-medium">Asset Code *</label>
          <Input value={form.assetCode} onChange={e => setForm((f: any) => ({ ...f, assetCode: e.target.value.toUpperCase() }))} className="mt-1" placeholder="e.g. LAPTOP-042" data-testid="input-asset-code" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Category</label>
          <Select value={form.category} onValueChange={v => setForm((f: any) => ({ ...f, category: v }))}>
            <SelectTrigger className="mt-1" data-testid="select-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(categoryColors).map(c => (
                <SelectItem key={c} value={c} className="capitalize">{c.replace("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Condition</label>
          <Select value={form.condition} onValueChange={v => setForm((f: any) => ({ ...f, condition: v }))}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(conditionColors).map(c => (
                <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Serial Number</label>
        <Input value={form.serialNumber} onChange={e => setForm((f: any) => ({ ...f, serialNumber: e.target.value }))} className="mt-1" placeholder="e.g. SN-XXXXX" />
      </div>
      <div>
        <label className="text-sm font-medium">Assign To Employee</label>
        <Select value={form.employeeId || "unassigned"} onValueChange={v => setForm((f: any) => ({ ...f, employeeId: v === "unassigned" ? "" : v }))}>
          <SelectTrigger className="mt-1" data-testid="select-employee">
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {employees.map((e: any) => (
              <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Purchase Date</label>
          <DateInput value={form.purchaseDate} onChange={v => setForm((f: any) => ({ ...f, purchaseDate: v }))} className="mt-1" />
        </div>
        <div>
          <label className="text-sm font-medium">Purchase Value (₹)</label>
          <Input type="number" value={form.purchaseValue} onChange={e => setForm((f: any) => ({ ...f, purchaseValue: e.target.value }))} className="mt-1" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Status</label>
        <Select value={form.status} onValueChange={v => setForm((f: any) => ({ ...f, status: v }))}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="retired">Retired</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium">Description</label>
        <Input value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} className="mt-1" placeholder="Optional notes" />
      </div>
    </div>
  );
}
