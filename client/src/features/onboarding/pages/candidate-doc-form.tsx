import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUpload, type UploadedFile } from "@/components/shared/file-upload";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, ShieldCheck, User, Briefcase, Landmark, PackageX } from "lucide-react";

const BLOOD = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
type FileMap = Record<string, UploadedFile | null>;

// A labelled section, matching the request-form look.
function Section({ icon: Icon, title, subtitle, children }: { icon: any; title: string; subtitle?: string; children: any }) {
  return (
    <div className="card-surface rounded-2xl p-5 sm:p-6 space-y-4">
      <div className="flex items-start gap-3">
        <span className="h-9 w-9 rounded-xl bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0"><Icon className="h-4 w-4" /></span>
        <div>
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: boolean; children: any }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[13px]">{label} {required && <span className="text-[#FF6F62]">*</span>}</Label>
      {children}
      {error && <p className="text-[11px] text-[#FF6F62]">This field is required.</p>}
    </div>
  );
}

export default function CandidateDocForm() {
  const { token } = useParams();
  const [state, setState] = useState<"loading" | "ready" | "invalid" | "already" | "done">("loading");
  const [candidate, setCandidate] = useState<{ name?: string; email?: string; phone?: string }>({});
  const [form, setForm] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<FileMap>({});
  const [sameAddr, setSameAddr] = useState(false);
  const [tried, setTried] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const setFile = (k: string, v: UploadedFile | null) => setFiles((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/onboarding/collect/${token}`);
        if (!alive) return;
        if (res.status === 404) return setState("invalid");
        const data = await res.json();
        setCandidate({ name: data.candidateName, email: data.candidateEmail, phone: data.candidatePhone });
        setState(data.status === "submitted" ? "already" : "ready");
      } catch {
        if (alive) setState("invalid");
      }
    })();
    return () => { alive = false; };
  }, [token]);

  const permanent = sameAddr ? form.currentAddress || "" : form.permanentAddress || "";
  const REQUIRED_TEXT = ["currentAddress", "bloodGroup", "highestQualification", "emergencyPhone", "emergencyRelation", "accountHolderName", "accountNumber", "branchName", "ifsc"];
  const REQUIRED_FILES = ["pan", "aadhaar", "photoId", "bankProof"];
  const missing = (k: string) => (REQUIRED_TEXT.includes(k) && !(form[k] || "").trim()) || (k === "permanentAddress" && !permanent.trim());
  const fileMissing = (k: string) => REQUIRED_FILES.includes(k) && !files[k];

  const valid =
    REQUIRED_TEXT.every((k) => (form[k] || "").trim()) && permanent.trim() &&
    REQUIRED_FILES.every((k) => !!files[k]);

  const submit = async () => {
    setTried(true);
    setError("");
    if (!valid) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setSubmitting(true);
    try {
      const payload = {
        formData: {
          currentAddress: form.currentAddress, permanentAddress: permanent,
          bloodGroup: form.bloodGroup, highestQualification: form.highestQualification,
          emergencyPhone: form.emergencyPhone, emergencyRelation: form.emergencyRelation,
          previousOrganisations: form.previousOrganisations || null,
          accountHolderName: form.accountHolderName, accountNumber: form.accountNumber,
          branchName: form.branchName, ifsc: form.ifsc,
        },
        files,
      };
      const res = await fetch(`/api/onboarding/collect/${token}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      setState("done");
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  };

  // ---- Non-form states ----
  if (state === "loading") return <Shell><div className="space-y-3"><Skeleton className="h-8 w-56" /><Skeleton className="h-48 w-full" /></div></Shell>;
  if (state === "invalid") return <Shell><Centered icon={PackageX} title="This link isn’t valid" body="The onboarding link is invalid or has expired. Please contact HR for a fresh link." tone="error" /></Shell>;
  if (state === "already") return <Shell><Centered icon={CheckCircle2} title="Documents already submitted" body={`Thanks${candidate.name ? `, ${candidate.name}` : ""}! We’ve already received your documents. HR will reach out with the next steps.`} tone="success" /></Shell>;
  if (state === "done") return <Shell><Centered icon={CheckCircle2} title="Documents submitted 🎉" body={`Thank you${candidate.name ? `, ${candidate.name}` : ""}! Your documents are in. Our HR team has been notified and will be in touch soon.`} tone="success" /></Shell>;

  return (
    <Shell>
      <div className="space-y-1 mb-5">
        <h1 className="text-2xl font-bold text-foreground">Welcome{candidate.name ? `, ${candidate.name}` : ""} 👋</h1>
        <p className="text-sm text-muted-foreground">Please complete your details and upload the required documents to finish your onboarding. Fields marked <span className="text-[#FF6F62]">*</span> are required.</p>
      </div>

      {tried && !valid && <div className="mb-4 rounded-xl border border-[#FF6F62]/40 bg-[#FF6F62]/10 px-4 py-2.5 text-sm text-[#C4402F]">Please fill all required fields and upload the required documents.</div>}
      {error && <div className="mb-4 rounded-xl border border-[#FF6F62]/40 bg-[#FF6F62]/10 px-4 py-2.5 text-sm text-[#C4402F]">{error}</div>}

      <div className="space-y-4">
        {/* Personal */}
        <Section icon={User} title="Personal details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Current address" required error={tried && missing("currentAddress")}>
              <Textarea rows={2} value={form.currentAddress || ""} onChange={(e) => set("currentAddress", e.target.value)} placeholder="House / street, area, city, state, PIN" />
            </Field>
            <Field label="Permanent address" required error={tried && missing("permanentAddress")}>
              <Textarea rows={2} value={permanent} disabled={sameAddr} onChange={(e) => set("permanentAddress", e.target.value)} placeholder="House / street, area, city, state, PIN" />
              <label className="flex items-center gap-2 text-xs text-muted-foreground pt-1 cursor-pointer"><Checkbox checked={sameAddr} onCheckedChange={(c) => setSameAddr(!!c)} /> Same as current address</label>
            </Field>
            <Field label="Blood group" required error={tried && missing("bloodGroup")}>
              <Select value={form.bloodGroup || ""} onValueChange={(v) => set("bloodGroup", v)}><SelectTrigger className="h-10"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{BLOOD.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select>
            </Field>
            <Field label="Highest qualification" required error={tried && missing("highestQualification")}>
              <Input value={form.highestQualification || ""} onChange={(e) => set("highestQualification", e.target.value)} placeholder="e.g. B.Tech, MBA" />
            </Field>
            <Field label="Emergency contact number" required error={tried && missing("emergencyPhone")}>
              <Input type="tel" inputMode="tel" value={form.emergencyPhone || ""} onChange={(e) => set("emergencyPhone", e.target.value)} placeholder="Phone number" />
            </Field>
            <Field label="Relationship" required error={tried && missing("emergencyRelation")}>
              <Input value={form.emergencyRelation || ""} onChange={(e) => set("emergencyRelation", e.target.value)} placeholder="e.g. Father, Spouse" />
            </Field>
          </div>
        </Section>

        {/* Identity documents */}
        <Section icon={ShieldCheck} title="Identity documents" subtitle="Clear photo or PDF of each.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="PAN card" required error={tried && fileMissing("pan")}><FileUpload value={files.pan || null} onChange={(v) => setFile("pan", v)} label="Upload PAN" /></Field>
            <Field label="Aadhaar card" required error={tried && fileMissing("aadhaar")}><FileUpload value={files.aadhaar || null} onChange={(v) => setFile("aadhaar", v)} label="Upload Aadhaar" /></Field>
            <Field label="Passport / Driving Licence / Voter ID" required error={tried && fileMissing("photoId")}><FileUpload value={files.photoId || null} onChange={(v) => setFile("photoId", v)} label="Upload any one" /></Field>
          </div>
        </Section>

        {/* Employment history */}
        <Section icon={Briefcase} title="Employment history" subtitle="Skip if you're a fresher.">
          <Field label="Previous organisation name(s)"><Input value={form.previousOrganisations || ""} onChange={(e) => set("previousOrganisations", e.target.value)} placeholder="Comma-separated if more than one" /></Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Offer letter"><FileUpload value={files.offerLetter || null} onChange={(v) => setFile("offerLetter", v)} label="Upload" /></Field>
            <Field label="Increment letter(s)"><FileUpload value={files.incrementLetters || null} onChange={(v) => setFile("incrementLetters", v)} label="Upload" /></Field>
            <Field label="Relieving letter(s)"><FileUpload value={files.relievingLetters || null} onChange={(v) => setFile("relievingLetters", v)} label="Upload" /></Field>
            <Field label="Payslips — last 3 months"><FileUpload value={files.payslips || null} onChange={(v) => setFile("payslips", v)} label="Upload (combine into one PDF)" /></Field>
          </div>
        </Section>

        {/* Bank */}
        <Section icon={Landmark} title="Bank details" subtitle="For salary processing.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Account holder name" required error={tried && missing("accountHolderName")}><Input value={form.accountHolderName || ""} onChange={(e) => set("accountHolderName", e.target.value)} placeholder="As per bank records" /></Field>
            <Field label="Account number" required error={tried && missing("accountNumber")}><Input inputMode="numeric" value={form.accountNumber || ""} onChange={(e) => set("accountNumber", e.target.value.replace(/[^\d]/g, ""))} placeholder="Digits only" /></Field>
            <Field label="Branch name" required error={tried && missing("branchName")}><Input value={form.branchName || ""} onChange={(e) => set("branchName", e.target.value)} placeholder="e.g. Koramangala" /></Field>
            <Field label="IFSC code" required error={tried && missing("ifsc")}><Input value={form.ifsc || ""} onChange={(e) => set("ifsc", e.target.value.toUpperCase())} placeholder="e.g. HDFC0001234" /></Field>
            <Field label="Bank passbook / cancelled cheque" required error={tried && fileMissing("bankProof")}><FileUpload value={files.bankProof || null} onChange={(v) => setFile("bankProof", v)} label="Upload" /></Field>
          </div>
        </Section>
      </div>

      <div className="sticky bottom-0 mt-5 -mx-4 sm:mx-0 bg-background/80 backdrop-blur border-t border-border sm:border-0 sm:bg-transparent sm:backdrop-blur-0 px-4 sm:px-0 py-4 flex justify-end">
        <Button className="btn-primary-gradient w-full sm:w-auto" disabled={submitting} onClick={submit} data-testid="onboarding-submit">
          {submitting ? "Submitting…" : "Submit documents"}
        </Button>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: any }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#EAF1F7] to-[#F5F7FA] py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <span className="h-9 w-9 rounded-xl bg-[#206295] text-white flex items-center justify-center font-bold">E</span>
          <span className="font-semibold text-foreground">EMO Energy</span>
          <span className="w-px h-3.5 bg-border" />
          <span className="text-sm text-muted-foreground">Onboarding</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function Centered({ icon: Icon, title, body, tone }: { icon: any; title: string; body: string; tone: "success" | "error" }) {
  const color = tone === "success" ? "#0E7C7B" : "#C4402F";
  return (
    <div className="card-surface rounded-2xl p-10 text-center max-w-md mx-auto">
      <span className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto" style={{ backgroundColor: `${color}1a`, color }}><Icon className="h-7 w-7" /></span>
      <h1 className="text-xl font-bold text-foreground mt-4">{title}</h1>
      <p className="text-sm text-muted-foreground mt-2">{body}</p>
    </div>
  );
}
