import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";

const ADD_NEW = "__add_new__";

/** A Select whose last option switches to an inline "create it now" input.
 *  `onCreate` returns the new option's value (may be async). */
export function SelectWithAddNew({ value, onChange, options, placeholder, onCreate, testId }: {
  value?: string; onChange: (v: string) => void; options: { value: string; label: string }[];
  placeholder?: string; onCreate: (name: string) => Promise<string> | string; testId?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    const name = text.trim(); if (!name) return;
    setBusy(true);
    try { const v = await onCreate(name); onChange(v); setText(""); setAdding(false); } finally { setBusy(false); }
  }

  if (adding) {
    return (
      <div className="space-y-2">
        <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); create(); } }} placeholder="Type a new name…" data-testid={testId ? `${testId}-new-input` : undefined} />
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={create} disabled={busy}>{busy ? "Creating…" : "Create"}</Button>
          <Button type="button" size="icon" variant="outline" className="h-10 w-10 flex-shrink-0" onClick={() => { setAdding(false); setText(""); }} aria-label="Cancel"><X className="h-4 w-4" /></Button>
        </div>
      </div>
    );
  }
  return (
    <Select value={value} onValueChange={(v) => (v === ADD_NEW ? setAdding(true) : onChange(v))}>
      <SelectTrigger data-testid={testId}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        <SelectItem value={ADD_NEW} className="text-primary font-medium border-t border-border mt-1">+ Add New</SelectItem>
      </SelectContent>
    </Select>
  );
}
