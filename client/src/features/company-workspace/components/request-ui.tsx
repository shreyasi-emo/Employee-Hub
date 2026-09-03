import { formatDate } from "../shared/request-format";
import { submittedInfo } from "../shared/submitted-info";
import { CheckCircle2, CircleDot, CircleDashed, XCircle } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

// Small shared pieces for the request screens: field errors, the submitted/resubmitted
// label, a label-value row, and the approval timeline rail.
// Coral validation styling shared by the inline request forms (mirrors the reimbursement form).
export const ERR_BORDER = "border-[#FF6F62] focus-visible:ring-[#FF6F62]";

export const FieldError = ({ show, msg }: { show: any; msg: string }) => (show ? <p className="text-[11px] text-[#FF6F62] mt-0.5">{msg}</p> : null);

// Renders the "Submitted on"/"Re-submitted On" label; when re-submitted, the label gets a dotted
// underline and a hover tooltip with the original creation date (portal-rendered, so layout is safe).
export function SubmittedLabel({ info, className = "" }: { info: ReturnType<typeof submittedInfo>; className?: string }) {
  if (!info.resubmitted) return <span className={className}>{info.label}</span>;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`underline decoration-dotted underline-offset-2 cursor-help ${className}`}>{info.label}</span>
        </TooltipTrigger>
        <TooltipContent>Originally created {formatDate(info.originalDate)}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Clean label/value row inside a fixed-layout table so values always wrap (no horizontal scroll).
export function Row({ label, value }: { label: string; value: any }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <tr className="border-b border-border/50 last:border-0 align-top">
      <td className="py-2 pr-4 text-xs text-muted-foreground w-[38%]">{label}</td>
      <td className="py-2 text-sm text-foreground break-words">{value}</td>
    </tr>
  );
}

export function Timeline({ steps, cancelled }: { steps: any[]; cancelled?: boolean }) {
  return (
    <ol className="flex items-start">
      {steps.map((s, i) => (
        <li key={i} className="flex-1 flex flex-col items-center text-center min-w-0">
          <div className="flex items-center w-full">
            <span className={`h-px flex-1 ${i === 0 ? "opacity-0" : s.state === "upcoming" ? "bg-border" : "bg-[#0E7C7B]/40"}`} />
            {s.state === "done" ? <CheckCircle2 className="h-[18px] w-[18px] text-[#0E7C7B] flex-shrink-0" />
              : s.state === "current" ? <CircleDot className="h-[18px] w-[18px] text-[#206295] flex-shrink-0" />
              : s.state === "rejected" ? <XCircle className="h-[18px] w-[18px] text-[#FF6F62] flex-shrink-0" />
              : <CircleDashed className="h-[18px] w-[18px] text-muted-foreground/40 flex-shrink-0" />}
            <span className={`h-px flex-1 ${i === steps.length - 1 ? "opacity-0" : steps[i + 1].state === "upcoming" ? "bg-border" : "bg-[#0E7C7B]/40"}`} />
          </div>
          <div className="mt-2 px-1">
            <p className={`text-[13px] font-medium leading-tight ${s.state === "upcoming" ? "text-muted-foreground" : "text-foreground"}`}>{s.label}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{s.state === "current" ? (cancelled ? "—" : "In progress") : s.state === "rejected" ? "Rejected" : (s.date || "—")}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

// Vertical rule between the stat columns — hidden on mobile where the columns stack.
export const colDivider = <div className="hidden lg:block w-px self-stretch bg-foreground/15 flex-shrink-0" />;
