import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useImportEmployees } from "../api/employees.api";

/** Minimal CSV parse — first row is the (lower-cased) header row. */
function parseCSV(text: string) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const o: any = {}; headers.forEach((h, i) => (o[h] = cells[i] || "")); return o;
  });
}

/** Map a CSV row onto an employee payload, resolving department/designation by name. */
function rowToPayload(r: any, deptByName: Map<string, string>, desigByName: Map<string, string>) {
  return {
    firstName: r.firstname || r["first name"], lastName: r.lastname || r["last name"], email: r.email,
    phone: r.phone || undefined, joinDate: r.joindate || r["join date"] || new Date().toISOString().split("T")[0],
    workLocation: r.location || undefined, employmentType: r.employmenttype || r.type || "full_time",
    departmentId: deptByName.get((r.department || "").toLowerCase()),
    designationId: desigByName.get((r.designation || "").toLowerCase()),
  };
}

export function ImportEmployeesDialog({ open, onOpenChange, departments, designations }: {
  open: boolean; onOpenChange: (v: boolean) => void; departments: any[]; designations: any[];
}) {
  const { toast } = useToast();
  const importEmployees = useImportEmployees();
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setFileName(f.name);
    const text = await f.text();
    setRows(parseCSV(text));
  }

  async function doImport() {
    if (!rows.length) return;
    setBusy(true);
    const deptByName = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]));
    const desigByName = new Map(designations.map((d) => [d.name.toLowerCase(), d.id]));
    const { ok, fail } = await importEmployees(rows.map((r) => rowToPayload(r, deptByName, desigByName)));
    setBusy(false); setRows([]); setFileName(""); if (fileRef.current) fileRef.current.value = "";
    toast({ title: `Imported ${ok} employee${ok !== 1 ? "s" : ""}${fail ? `, ${fail} skipped` : ""}` });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Import Employees</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Upload a <span className="font-medium text-[#206295]">.csv</span> file with columns:
            <span className="font-mono text-xs"> firstName, lastName, email, phone, joinDate, department, designation, location, employmentType</span>.
          </p>
          <label className="flex items-center gap-3 rounded-[16px] border border-border bg-background/60 p-2 cursor-pointer hover-elevate transition-colors">
            <span className="inline-flex items-center rounded-[12px] border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover-elevate transition-colors flex-shrink-0">Choose File</span>
            <span className="text-sm text-muted-foreground truncate">{fileName || "No file chosen"}</span>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" data-testid="input-import-file" />
          </label>
          {rows.length > 0 && <p className="text-sm text-foreground"><span className="font-semibold text-[#206295]">{rows.length}</span> rows detected.</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={doImport} disabled={busy || !rows.length}>{busy ? "Importing…" : `Import ${rows.length || ""}`}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
