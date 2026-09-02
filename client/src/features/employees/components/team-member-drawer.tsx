import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Briefcase, Building2, MapPin, UserRound, Mail, Phone, BadgeCheck, Copy, Check, User, Heart, Droplet, Cake } from "lucide-react";
import { format } from "date-fns";
import { statusColors } from "../lib/employee-constants";
import { avatarColor, initials } from "../lib/employee-helpers";

const cap = (s?: string | null) => (s ? s.replace(/\b\w/g, (c) => c.toUpperCase()) : s);
const fmtDate = (d: any) => (d ? format(new Date(d), "MMM d, yyyy") : null);

function Row({ icon: Icon, label, value, copyable }: { icon: any; label: string; value?: string | null; copyable?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { if (value) navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }).catch(() => {}); };
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="h-8 w-8 rounded-lg bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.65px] text-muted-foreground leading-tight">{label}</p>
        <p className="text-sm font-medium text-foreground leading-snug break-words">{value || "—"}</p>
      </div>
      {copyable && value && (
        <button type="button" onClick={copy} className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 text-muted-foreground hover:text-[#206295] hover-elevate" aria-label={`Copy ${label.toLowerCase()}`} title={copied ? "Copied" : `Copy ${label.toLowerCase()}`}>
          {copied ? <Check className="h-3.5 w-3.5 text-[#0E7C7B]" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  );
}

// Read-only right drawer for a manager's team member — basic info + personal details, no page nav.
export function TeamMemberDrawer({ open, onOpenChange, employee, dept, desig, manager }: {
  open: boolean; onOpenChange: (v: boolean) => void; employee: any | null; dept?: any; desig?: any; manager?: any;
}) {
  const e = employee;
  const c = e ? avatarColor(e.id) : "#206295";
  const status = e?.employmentStatus as string;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col gap-0">
        <SheetHeader className="px-6 pt-6 pb-3 flex-shrink-0 border-b border-border">
          <SheetTitle>Team Member</SheetTitle>
        </SheetHeader>
        {e && (
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-6">
            {/* Identity */}
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-24 w-24">
                {e.avatarUrl && <AvatarImage src={e.avatarUrl} />}
                <AvatarFallback className="text-2xl font-bold" style={{ backgroundColor: `${c}26`, color: c }}>{initials(e.firstName, e.lastName)}</AvatarFallback>
              </Avatar>
              <div className="mt-3 flex items-center justify-center gap-1.5">
                <h2 className="text-lg font-bold text-foreground leading-tight">{e.firstName} {e.lastName}</h2>
                <BadgeCheck className="h-4 w-4 text-[#206295] flex-shrink-0" />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">Employee ID: <span className="font-medium text-foreground">{e.employeeCode}</span></p>
              {status && <Badge className={`mt-2.5 ${statusColors[status] || statusColors.inactive}`}><span className="capitalize">{status.replace("_", " ")}</span></Badge>}
            </div>

            {/* Job Details */}
            <div>
              <h3 className="text-sm font-semibold text-foreground">Job Details</h3>
              <div className="mt-1 divide-y divide-border">
                <Row icon={Briefcase} label="Designation" value={desig?.name} />
                <Row icon={Building2} label="Department" value={dept?.name} />
                <Row icon={MapPin} label="Work Location" value={e.workLocation} />
                <Row icon={UserRound} label="Reports to" value={manager ? `${manager.firstName} ${manager.lastName}` : null} />
                <Row icon={Mail} label="Company Email" value={e.email} copyable />
                <Row icon={Phone} label="Phone" value={e.phone} copyable />
              </div>
            </div>

            {/* Personal Details */}
            <div>
              <h3 className="text-sm font-semibold text-foreground">Personal Details</h3>
              <div className="mt-1 divide-y divide-border">
                <Row icon={Cake} label="Date of Birth" value={fmtDate(e.dateOfBirth)} />
                <Row icon={User} label="Gender" value={cap(e.gender)} />
                <Row icon={Heart} label="Marital Status" value={cap(e.maritalStatus)} />
                <Row icon={Droplet} label="Blood Group" value={e.bloodGroup} />
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
