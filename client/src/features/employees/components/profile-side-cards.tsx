import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { FileText, ExternalLink, Plane, Pencil, ShieldCheck, FileClock, Plus, MoreVertical, RefreshCw, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { EMPLOYEE_DOC_GROUPS } from "../lib/employee-constants";

const MAX_DOC_MB = 5;
const hasFile = (f: any) => !!(f && (f.fileData || f.fileUrl));
// Profile Docs surface only collects Identity + Bank (no Previous Employment).
const DOC_GROUPS = EMPLOYEE_DOC_GROUPS.filter((g) => g.group === "Identity" || g.group === "Bank");
const DOC_TYPES = DOC_GROUPS.flatMap((g) => g.docs);

// ===== Docs bento — every standard onboarding document, present or as a placeholder =====
// Managing (add / replace / remove) is HR + Super Admin only; everyone with profile access sees
// what's on file and what's still missing.
export function ProfileDocsCard({ documents, canManage = false, onSave }: {
  documents: Record<string, any> | null | undefined;
  canManage?: boolean;
  onSave?: (nextDocs: Record<string, any>) => void;
}) {
  const docs = documents || {};
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const presentCount = DOC_TYPES.filter((d) => hasFile(docs[d.key])).length;

  const pickFor = (key: string) => { setPendingKey(key); fileRef.current?.click(); };
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const key = pendingKey;
    e.target.value = "";
    setPendingKey(null);
    if (!file || !key) return;
    if (file.size > MAX_DOC_MB * 1024 * 1024) { toast({ title: `File too large (max ${MAX_DOC_MB} MB)`, variant: "destructive" }); return; }
    const reader = new FileReader();
    reader.onload = () => onSave?.({ ...docs, [key]: { fileName: file.name, fileType: file.type, fileData: String(reader.result) } });
    reader.readAsDataURL(file);
  };
  const remove = (key: string, label: string) => {
    if (!window.confirm(`Remove ${label}?`)) return;
    const next = { ...docs }; delete next[key];
    onSave?.(next);
  };

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="pt-4 pb-2 flex flex-row items-center justify-between gap-1 space-y-0">
        <CardTitle className="text-base font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /> Docs</CardTitle>
        <span className="text-xs text-muted-foreground tabular-nums">{presentCount}/{DOC_TYPES.length}</span>
      </CardHeader>
      <CardContent className="px-3 pb-3 flex-1 min-h-0">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,application/pdf" className="hidden" onChange={onFile} />
        <ScrollArea className="h-full">
          <div className="space-y-3 pr-1">
            {DOC_GROUPS.map((g) => (
              <div key={g.group} className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80 px-0.5">{g.group}</p>
                {g.docs.map((d) => {
                  const f = docs[d.key];
                  const present = hasFile(f);
                  const href = present ? (f.fileData || f.fileUrl) : undefined;
                  return (
                    <div
                      key={d.key}
                      className={`flex items-center gap-2.5 rounded-xl border p-2.5 ${present ? "border-border/60" : "border-dashed border-border/70 bg-muted/20"}`}
                      data-testid={`doc-${d.key}`}
                    >
                      <span className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${present ? "bg-[#206295]/10 text-[#206295]" : "bg-muted text-muted-foreground/60"}`}>
                        <FileText className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium truncate ${present ? "text-foreground" : "text-muted-foreground"}`}>{d.label}</p>
                        <p className="text-[11px] text-muted-foreground/70 truncate">{present ? (f.fileName || "Uploaded") : "Not uploaded"}</p>
                      </div>
                      {present ? (
                        <div className="flex items-center flex-shrink-0">
                          <a href={href} target="_blank" rel="noopener noreferrer" className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-[#206295] hover-elevate" aria-label={`Open ${d.label}`} title="Open">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                          {canManage && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button type="button" className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover-elevate" aria-label={`Manage ${d.label}`}><MoreVertical className="h-3.5 w-3.5" /></button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem onClick={() => pickFor(d.key)} data-testid={`doc-replace-${d.key}`}><RefreshCw className="h-4 w-4 mr-2" /> Replace</DropdownMenuItem>
                                <DropdownMenuItem className="text-[#FF6F62] focus:text-[#FF6F62]" onClick={() => remove(d.key, d.label)} data-testid={`doc-remove-${d.key}`}><Trash2 className="h-4 w-4 mr-2" /> Remove</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      ) : canManage ? (
                        <Button type="button" variant="secondary" size="sm" className="h-7 px-2 flex-shrink-0 gap-1" onClick={() => pickFor(d.key)} data-testid={`doc-add-${d.key}`}>
                          <Plus className="h-3.5 w-3.5" /> Add
                        </Button>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs flex-shrink-0 pr-1">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ===== Recent Activities — audit trail (profile changes) + the employee's leave requests =====
type Activity = { id: string; when: Date; icon: any; color: string; text: string };

export function ProfileActivityCard({ auditLogs, leaveRequests, leaveTypes }: { auditLogs: any[]; leaveRequests: any[]; leaveTypes: any[] }) {
  const ltName = (id: string) => (leaveTypes || []).find((l: any) => l.id === id)?.name || "leave";

  const items: Activity[] = [];
  for (const log of auditLogs || []) {
    if (!log.createdAt) continue;
    const action = String(log.action || "").replace(/_/g, " ").toLowerCase();
    items.push({
      id: `audit-${log.id}`, when: new Date(log.createdAt),
      icon: action.includes("role") ? ShieldCheck : Pencil, color: "#206295",
      text: action.replace(/\b\w/g, (c) => c.toUpperCase()),
    });
  }
  for (const r of leaveRequests || []) {
    if (!r.createdAt) continue;
    const range = r.startDate === r.endDate ? format(new Date(r.startDate), "MMM d") : `${format(new Date(r.startDate), "MMM d")} – ${format(new Date(r.endDate), "MMM d")}`;
    items.push({
      id: `leave-${r.id}`, when: new Date(r.createdAt),
      icon: Plane, color: "#0E7C7B",
      text: `${ltName(r.leaveTypeId)} · ${range} — ${r.status}`,
    });
  }
  items.sort((a, b) => +b.when - +a.when);

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="pt-4 pb-2 flex flex-row items-center gap-2 space-y-0">
        <CardTitle className="text-base font-semibold flex items-center gap-2"><FileClock className="h-4 w-4 text-muted-foreground" /> Recent Activities</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 flex-1 min-h-0">
        {items.length === 0 ? (
          <div className="h-full flex items-center justify-center py-8"><p className="text-sm text-muted-foreground text-center">No recorded activity yet.</p></div>
        ) : (
          <ScrollArea className="h-full">
            <div className="space-y-3 pr-1">
              {items.slice(0, 40).map((it) => (
                <div key={it.id} className="flex items-start gap-3">
                  <span className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: `${it.color}1a`, color: it.color }}><it.icon className="h-3.5 w-3.5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground leading-snug capitalize">{it.text}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{format(it.when, "MMM d, yyyy 'at' h:mm a")}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
