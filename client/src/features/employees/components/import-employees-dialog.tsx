import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Download, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useImportEmployees } from "../api/employees.api";
import { downloadEmployeeTemplate, parseEmployeeFile, validateEmployeeRows, type ImportRow } from "../lib/employee-import";

export function ImportEmployeesDialog({ open, onOpenChange, departments, designations, employees = [] }: {
  open: boolean; onOpenChange: (v: boolean) => void; departments: any[]; designations: any[]; employees?: any[];
}) {
  const { toast } = useToast();
  const importEmployees = useImportEmployees();
  const [busy, setBusy] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setRows([]); setFileName(""); if (fileRef.current) fileRef.current.value = ""; };
  const valid = rows.filter((r) => r.payload);
  const problems = rows.filter((r) => r.errors.length);
  const withWarnings = rows.filter((r) => r.payload && r.warnings.length);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setFileName(f.name); setParsing(true); setRows([]);
    try {
      const parsed = await parseEmployeeFile(f);
      const deptByName = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]));
      const desigByName = new Map(designations.map((d) => [d.name.toLowerCase(), d.id]));
      const empIdByEmail = new Map((employees as any[]).filter((x) => x.email).map((x) => [String(x.email).toLowerCase(), x.id]));
      setRows(validateEmployeeRows(parsed, { deptByName, desigByName, empIdByEmail }));
    } catch (err: any) {
      toast({ title: "Couldn't read the file", description: err?.message || "Use the provided .xlsx template.", variant: "destructive" });
      reset();
    } finally { setParsing(false); }
  }

  async function doImport() {
    if (!valid.length) return;
    setBusy(true);
    const { ok, fail, failures } = await importEmployees(valid.map((r) => r.payload));
    setBusy(false);
    if (fail && ok === 0) {
      toast({ title: "Import failed", description: failures.slice(0, 3).map((f) => `${f.label}: ${f.message}`).join("; "), variant: "destructive" });
      return;
    }
    toast({ title: `Imported ${ok} employee${ok !== 1 ? "s" : ""}`, description: fail ? `${fail} row${fail !== 1 ? "s" : ""} rejected by the server.` : undefined });
    reset(); onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Import Employees</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Download the template, fill one employee per row, then upload it. Required columns:
            <span className="font-medium text-foreground"> First Name, Last Name, Email, Join Date</span>. Department, Designation and Manager Email must match existing records (unmatched values are left blank).
          </p>
          <Button variant="secondary" className="w-full" onClick={() => downloadEmployeeTemplate()} data-testid="button-download-template">
            <Download className="h-4 w-4 mr-1.5" /> Download Excel template (.xlsx)
          </Button>

          <label className="flex items-center gap-3 rounded-[16px] border border-border bg-background/60 p-2 cursor-pointer hover-elevate transition-colors">
            <span className="inline-flex items-center rounded-[12px] border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover-elevate transition-colors flex-shrink-0">Choose File</span>
            <span className="text-sm text-muted-foreground truncate">{fileName || "No file chosen (.xlsx / .csv)"}</span>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="hidden" data-testid="input-import-file" />
          </label>

          {parsing && <p className="text-sm text-muted-foreground">Reading file…</p>}

          {rows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <span className="inline-flex items-center gap-1.5 text-[#206295] font-medium"><CheckCircle2 className="h-4 w-4" /> {valid.length} ready</span>
                {problems.length > 0 && <span className="inline-flex items-center gap-1.5 text-[#C4402F] font-medium"><AlertTriangle className="h-4 w-4" /> {problems.length} with errors</span>}
              </div>
              {(problems.length > 0 || withWarnings.length > 0) && (
                <ScrollArea className="max-h-44 rounded-[12px] border border-border">
                  <ul className="divide-y divide-border text-xs">
                    {problems.map((r) => (
                      <li key={`e-${r.rowNum}`} className="px-3 py-1.5">
                        <span className="font-medium text-foreground">Row {r.rowNum} | {r.name}</span>
                        <span className="text-[#C4402F]"> — {r.errors.join("; ")}</span>
                      </li>
                    ))}
                    {withWarnings.map((r) => (
                      <li key={`w-${r.rowNum}`} className="px-3 py-1.5">
                        <span className="font-medium text-foreground">Row {r.rowNum} | {r.name}</span>
                        <span className="text-[#FFA962]"> — {r.warnings.join("; ")}</span>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
              {problems.length > 0 && <p className="text-[11px] text-muted-foreground">Rows with errors are skipped. Fix them in the sheet and re-upload to add them.</p>}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={doImport} disabled={busy || !valid.length} data-testid="button-do-import">{busy ? "Importing…" : `Import ${valid.length || ""}`}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
