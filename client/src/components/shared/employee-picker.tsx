import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserPlus, X, Check } from "lucide-react";

// Standard employee selector — matches the Dashboard "Add attendees" control.
// `multiple` toggles the Add All / Clear All header (present for multi, hidden for single-select).
// Works on employee objects and reports selection as an array of employee ids.

const NAME_PALETTE = [
  { avatar: "rgba(75, 220, 217, 0.35)", text: "#1F8F8C", chip: "rgba(75, 220, 217, 0.15)" },   // teal
  { avatar: "rgba(125, 133, 142, 0.32)", text: "#566069", chip: "rgba(125, 133, 142, 0.14)" }, // grey
  { avatar: "rgba(255, 111, 98, 0.32)", text: "#C24A3E", chip: "rgba(255, 111, 98, 0.14)" },   // coral
];
function nameColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h += name.charCodeAt(i);
  return NAME_PALETTE[h % NAME_PALETTE.length];
}
const initialsOf = (name: string) => name.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
const nameOf = (e: any) => `${e.firstName || ""} ${e.lastName || ""}`.trim() || e.username || "Employee";

export function EmployeePicker({ employees, selectedIds, onChange, multiple = true, buttonLabel = "Add attendees", lockedIds = [], modal = false }: {
  employees: any[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  multiple?: boolean;
  buttonLabel?: string;
  lockedIds?: string[]; // always-selected ids that can't be removed (e.g. the booker themselves)
  modal?: boolean; // set true when used inside a Dialog so the list wheel-scrolls (own scroll context)
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const list = (employees || []).filter((e) => e.firstName || e.lastName || e.username);
  const visible = list.filter((e) => nameOf(e).toLowerCase().includes(search.trim().toLowerCase()));
  const selectedSet = new Set(selectedIds);
  const lockedSet = new Set(lockedIds);
  const selectedEmps = selectedIds.map((id) => list.find((e) => e.id === id)).filter(Boolean) as any[];

  const toggle = (id: string) => {
    if (multiple) {
      if (selectedSet.has(id)) { if (lockedSet.has(id)) return; onChange(selectedIds.filter((x) => x !== id)); }
      else onChange([...selectedIds, id]);
    } else { onChange(selectedSet.has(id) ? [] : [id]); setOpen(false); }
  };

  return (
    <div className="flex flex-col items-start gap-2 w-full">
      <Popover open={open} onOpenChange={setOpen} modal={modal}>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="sm"
            className="text-xs rounded-[16px] border no-default-hover-elevate no-default-active-elevate"
            style={{ background: "transparent", borderColor: "rgba(29, 31, 32, 0.75)", boxShadow: "none" }}
            data-testid="employee-picker-trigger">
            <UserPlus className="h-3.5 w-3.5 mr-1" /> {buttonLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-2">
          {multiple && (
            <div className="flex items-center justify-between mb-1.5 px-1">
              <span className="text-xs font-semibold text-muted-foreground">{selectedIds.length} selected</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => onChange(list.map((e) => e.id))} className="text-xs font-medium text-primary hover:underline" data-testid="picker-add-all">Add All</button>
                <span className="text-muted-foreground/40 text-xs">|</span>
                <button type="button" onClick={() => onChange([...lockedIds])} className="text-xs font-medium text-muted-foreground hover:underline" data-testid="picker-clear-all">Clear All</button>
              </div>
            </div>
          )}
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people…" className="h-8 text-xs mb-1.5" data-testid="picker-search" />
          <div className="max-h-56 overflow-y-auto space-y-0.5">
            {list.length === 0 ? (
              <p className="text-xs text-muted-foreground px-1 py-2">No employees available</p>
            ) : visible.length === 0 ? (
              <p className="text-xs text-muted-foreground px-1 py-2">No matches for “{search}”</p>
            ) : (
              visible.map((e) => {
                const name = nameOf(e); const c = nameColor(name); const sel = selectedSet.has(e.id);
                return (
                  <button key={e.id} type="button" onClick={() => toggle(e.id)} className="w-full flex items-center gap-2 rounded-[12px] px-2 py-1.5 text-sm text-left hover-elevate" data-testid={`picker-item-${e.id}`}>
                    <Avatar className="h-6 w-6 flex-shrink-0">
                      {e.avatarUrl && <AvatarImage src={e.avatarUrl} />}
                      <AvatarFallback className="text-[9px]" style={{ backgroundColor: c.avatar, color: c.text }}>{initialsOf(name)}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate">{name}</span>
                    {sel && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {selectedEmps.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1 w-full">
          {selectedEmps.map((e) => {
            const name = nameOf(e); const c = nameColor(name);
            return (
              <span key={e.id} className="inline-flex items-center gap-1.5 rounded-full pl-1 pr-2 py-1" style={{ backgroundColor: c.chip }}>
                <Avatar className="h-[26px] w-[26px] flex-shrink-0">
                  {e.avatarUrl && <AvatarImage src={e.avatarUrl} />}
                  <AvatarFallback className="text-[10px]" style={{ backgroundColor: c.avatar, color: c.text }}>{initialsOf(name)}</AvatarFallback>
                </Avatar>
                <span className="text-xs text-foreground">{name}{lockedSet.has(e.id) ? " (you)" : ""}</span>
                {!lockedSet.has(e.id) && <button type="button" onClick={() => toggle(e.id)} aria-label={`Remove ${name}`}><X className="h-3 w-3 text-muted-foreground" /></button>}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
