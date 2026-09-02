import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Briefcase, Building2, MapPin, UserRound, Mail, Phone, BadgeCheck, Camera, Copy, Check, Trash2 } from "lucide-react";
import { statusColors } from "../lib/employee-constants";
import { avatarColor, initials } from "../lib/employee-helpers";
import { AvatarCropDialog } from "./avatar-crop-dialog";

function JobRow({ icon: Icon, label, value, copyable }: { icon: any; label: string; value?: string | null; copyable?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!value) return;
    navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }).catch(() => {});
  };
  return (
    <div className="flex-1 flex items-center gap-3 min-h-[3rem]">
      <span className="h-8 w-8 rounded-lg bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.65px] text-muted-foreground leading-tight">{label}</p>
        {/* copyable values (email/phone) truncate to one clean line instead of breaking mid-word;
            the copy button + hover title still give the full value. */}
        <p className={`text-sm font-medium text-foreground leading-snug ${copyable ? "truncate" : "break-words"}`} title={copyable && value ? value : undefined}>{value || "—"}</p>
      </div>
      {copyable && value && (
        <button
          type="button"
          onClick={copy}
          className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 text-muted-foreground hover:text-[#206295] hover-elevate"
          aria-label={`Copy ${label.toLowerCase()}`}
          title={copied ? "Copied" : `Copy ${label.toLowerCase()}`}
          data-testid={`copy-${label.toLowerCase().replace(/\s+/g, "-")}`}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-[#0E7C7B]" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  );
}

// LEFT bento (full height): photo-led identity, then a "Job Details" list. These job coordinates
// live ONLY here — the Employment section in the middle never repeats them.
export function ProfileSummaryCard({ employee, dept, desig, manager, canEditPhoto, onAvatarChange }: {
  employee: any; dept: any; desig: any; manager: any;
  canEditPhoto: boolean; onAvatarChange: (dataUrl: string | null) => void;
}) {
  const c = avatarColor(employee.id);
  const status = employee.employmentStatus as string;
  const fileRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(String(reader.result)); // open the crop/adjust step first
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <>
    <Card className="h-full flex flex-col overflow-hidden">
      <CardContent className="p-4 flex flex-col h-full min-h-0">
        {/* Identity */}
        <div className="flex flex-col items-center text-center flex-shrink-0">
          <div className="relative">
            {/* key forces a remount when the photo is added/removed so Radix reliably falls back
                to the letter avatar after a Remove (its load-status would otherwise stay "loaded"). */}
            <Avatar key={employee.avatarUrl || "letter"} className="h-24 w-24">
              {employee.avatarUrl && <AvatarImage src={employee.avatarUrl} />}
              <AvatarFallback className="text-2xl font-bold" style={{ backgroundColor: `${c}26`, color: c }}>{initials(employee.firstName, employee.lastName)}</AvatarFallback>
            </Avatar>
            {canEditPhoto && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="absolute -bottom-1 left-1.5 h-8 w-8 rounded-lg bg-[#206295] text-white flex items-center justify-center border-2 border-background hover:bg-[#1a5280] transition-colors"
                      aria-label="Photo options"
                      data-testid="upload-avatar"
                    >
                      <Camera className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44">
                    <DropdownMenuItem onClick={() => fileRef.current?.click()} data-testid="avatar-change"><Camera className="h-4 w-4 mr-2" /> {employee.avatarUrl ? "Change photo" : "Upload photo"}</DropdownMenuItem>
                    {employee.avatarUrl && (
                      <DropdownMenuItem onClick={() => onAvatarChange(null)} className="text-[#C4402F] focus:text-[#C4402F]" data-testid="avatar-remove"><Trash2 className="h-4 w-4 mr-2" /> Remove photo</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFile} />
              </>
            )}
          </div>
          <div className="mt-3 flex items-center justify-center gap-1.5">
            <h2 className="text-lg font-bold text-foreground leading-tight">{employee.firstName} {employee.lastName}</h2>
            <BadgeCheck className="h-4 w-4 text-[#206295] flex-shrink-0" />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">Employee ID: <span className="font-medium text-foreground">{employee.employeeCode}</span></p>
          <Badge className={`mt-2.5 ${statusColors[status] || statusColors.inactive}`}><span className="capitalize">{status?.replace("_", " ")}</span></Badge>
        </div>

        <div className="h-px bg-border my-4 flex-shrink-0" />

        {/* Job Details — rows distribute to fill the bento when there's room; on short viewports the
            list scrolls instead of getting clipped (flex-1 rows + overflow-y-auto = fill OR scroll). */}
        <h3 className="text-sm font-semibold text-foreground flex-shrink-0">Job Details</h3>
        <div className="mt-2 flex-1 min-h-0 overflow-y-auto flex flex-col divide-y divide-border">
          <JobRow icon={Briefcase} label="Designation" value={desig?.name} />
          <JobRow icon={Building2} label="Department" value={dept?.name} />
          <JobRow icon={MapPin} label="Work Location" value={employee.workLocation} />
          <JobRow icon={UserRound} label="Reports to" value={manager ? `${manager.firstName} ${manager.lastName}` : null} />
          <JobRow icon={Mail} label="Company Email" value={employee.email} copyable />
          <JobRow icon={Phone} label="Phone" value={employee.phone} copyable />
        </div>
      </CardContent>
    </Card>
    <AvatarCropDialog
      open={!!cropSrc}
      src={cropSrc}
      onOpenChange={(o) => { if (!o) setCropSrc(null); }}
      onCropped={(url) => { onAvatarChange(url); setCropSrc(null); }}
    />
    </>
  );
}
