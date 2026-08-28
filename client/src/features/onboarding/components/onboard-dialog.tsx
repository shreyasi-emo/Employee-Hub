import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DateInput } from "@/components/shared/datetime-field";
import { FileUpload, type UploadedFile } from "@/components/shared/file-upload";
import { useToast } from "@/hooks/use-toast";
import { FileText, UserCheck, CalendarClock } from "lucide-react";
import { format } from "date-fns";

const LABEL = "text-[10px] uppercase tracking-wide text-muted-foreground font-medium";
const Bar = () => <span className="w-px h-3 bg-border shrink-0" />;
const fmt = (d: any) => { if (!d) return "—"; const s = String(d); const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); return format(m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s), "d MMM yyyy"); };

function Detail({ label, value }: { label: string; value: any }) {
  if (!value) return null;
  return <div className="min-w-0"><p className={LABEL}>{label}</p><p className="text-sm text-foreground mt-0.5 break-words">{value}</p></div>;
}

const DOC_DEFS: [string, string][] = [
  ["pan", "PAN Card"], ["aadhaar", "Aadhaar Card"], ["photoId", "Photo ID"],
  ["offerLetter", "Previous Offer Letter"], ["incrementLetters", "Increment Letter(s)"],
  ["relievingLetters", "Relieving Letter(s)"], ["payslips", "Payslips (3 months)"], ["bankProof", "Bank Passbook / Cheque"],
];

export function OnboardDialog({ requestId, open, onClose }: { requestId: string | null; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [joinDate, setJoinDate] = useState("");
  const [offer, setOffer] = useState<UploadedFile | null>(null);

  const { data: r, isLoading } = useQuery<any>({ queryKey: [`/api/onboarding/doc-requests/${requestId}`], enabled: open && !!requestId });

  useEffect(() => {
    if (r) { setJoinDate(r.joinDate || ""); setOffer(r.offerLetter || null); }
  }, [r]);

  const patch = useMutation({
    mutationFn: (body: any) => apiRequest("PATCH", `/api/onboarding/doc-requests/${requestId}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/onboarding/doc-requests/${requestId}`] }),
  });
  const onboard = useMutation({
    mutationFn: () => apiRequest("POST", `/api/onboarding/doc-requests/${requestId}/onboard`, {}),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/onboarding/doc-requests"] });
      qc.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: `Onboarded as ${data.employeeCode}`, description: "Documents moved to the employee record." });
      onClose();
    },
    onError: (e: any) => toast({ title: "Couldn't onboard", description: e.message, variant: "destructive" }),
  });

  const fd = r?.formData || {};
  const files = r?.files || {};
  const onboarded = r?.status === "onboarded";
  const canOnboard = !!joinDate && !!offer && !onboarded;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[88vh] p-0 gap-0 overflow-hidden flex flex-col rounded-[16px]">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b border-border space-y-0">
          <DialogTitle className="flex items-center gap-2 flex-wrap pr-8">
            <span className="text-lg font-bold text-foreground">{r?.candidateName || "Candidate"}</span>
            <Badge className={`text-[11px] px-2 py-0 border-transparent ${onboarded ? "bg-[#4BDCD9]/25 text-[#0E7C7B]" : "bg-[#206295]/15 text-[#206295]"}`}>{onboarded ? `Onboarded · ${r?.employeeCode}` : "Submitted"}</Badge>
          </DialogTitle>
          {r?.candidateEmail && <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground"><span>{r.candidateEmail}</span>{r.candidatePhone && <><Bar /><span>{r.candidatePhone}</span></>}</div>}
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
          {isLoading ? <Skeleton className="h-40 w-full" /> : (
            <>
              {/* Submitted details */}
              <div>
                <p className={`${LABEL} mb-2`}>Submitted details</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <Detail label="Current address" value={fd.currentAddress} />
                  <Detail label="Permanent address" value={fd.permanentAddress} />
                  <Detail label="Blood group" value={fd.bloodGroup} />
                  <Detail label="Highest qualification" value={fd.highestQualification} />
                  <Detail label="Emergency contact" value={fd.emergencyPhone ? `${fd.emergencyPhone}${fd.emergencyRelation ? ` (${fd.emergencyRelation})` : ""}` : null} />
                  <Detail label="Previous organisation(s)" value={fd.previousOrganisations} />
                  <Detail label="Account holder" value={fd.accountHolderName} />
                  <Detail label="Account number" value={fd.accountNumber} />
                  <Detail label="Branch" value={fd.branchName} />
                  <Detail label="IFSC" value={fd.ifsc} />
                </div>
              </div>

              {/* Documents */}
              <div>
                <p className={`${LABEL} mb-2`}>Documents</p>
                <div className="rounded-[16px] border border-border divide-y divide-border">
                  {DOC_DEFS.filter(([k]) => files[k]?.fileData).map(([k, label]) => (
                    <a key={k} href={files[k].fileData} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2.5 text-sm hover-elevate">
                      <FileText className="h-4 w-4 text-[#206295] flex-shrink-0" />
                      <span className="text-foreground flex-1 truncate">{label}</span>
                      <span className="text-xs text-[#206295]">View</span>
                    </a>
                  ))}
                  {!DOC_DEFS.some(([k]) => files[k]?.fileData) && <p className="px-3 py-2.5 text-sm text-muted-foreground">No documents uploaded.</p>}
                </div>
              </div>

              {/* HR action zone */}
              <div className="rounded-[16px] border border-border bg-muted/30 p-4 space-y-4">
                <p className="text-sm font-semibold text-foreground inline-flex items-center gap-2"><UserCheck className="h-4 w-4 text-[#206295]" /> Finalise onboarding</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[13px]">Date of joining {!onboarded && <span className="text-[#FF6F62]">*</span>}</Label>
                    <DateInput value={joinDate} onChange={(v) => { setJoinDate(v); patch.mutate({ joinDate: v }); }} disabled={onboarded} testId="onboard-joindate" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[13px]">Signed offer letter {!onboarded && <span className="text-[#FF6F62]">*</span>}</Label>
                    <FileUpload value={offer} onChange={(v) => { setOffer(v); patch.mutate({ offerLetter: v }); }} label="Upload signed offer letter" />
                  </div>
                </div>
                {!onboarded && !canOnboard && <p className="text-[11px] text-muted-foreground">Enter the date of joining and upload the signed offer letter to enable onboarding.</p>}
              </div>
            </>
          )}
        </div>

        <div className="flex-shrink-0 border-t border-border bg-background px-6 py-4 flex items-center justify-end gap-2">
          {onboarded ? (
            <Button size="sm" className="btn-primary-gradient" onClick={() => { onClose(); navigate(`/employees/${r.employeeId}`); }}>View employee</Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
              <Button size="sm" className="btn-primary-gradient" disabled={!canOnboard || onboard.isPending} onClick={() => onboard.mutate()} data-testid="onboard-confirm">
                <CalendarClock className="h-4 w-4 mr-1.5" /> {onboard.isPending ? "Onboarding…" : "Onboard"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
