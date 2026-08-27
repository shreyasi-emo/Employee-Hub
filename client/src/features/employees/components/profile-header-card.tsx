import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Mail, Phone, MapPin, Calendar, Edit, BadgeCheck, MoreVertical, CheckCircle2, Check } from "lucide-react";
import { format } from "date-fns";
import { statusColors, typeLabel } from "../lib/employee-constants";
import { avatarColor, initials } from "../lib/employee-helpers";

const STATUS_OPTS = ["active", "on_notice", "inactive", "exited"];

// Profile header — the reference layout (avatar · name · role/dept · status pills · contact row · actions)
// rendered in our own styling: the app's Card, brand status colours (teal Active, not green), brand tokens.
export function ProfileHeaderCard({ employee, dept, desig, canManage, onStatusChange, onEdit }: {
  employee: any; dept: any; desig: any; canManage: boolean;
  onStatusChange: (v: string) => void; onEdit: () => void;
}) {
  const c = avatarColor(employee.id);
  const status = employee.employmentStatus as string;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start gap-5 flex-wrap">
          <Avatar className="h-20 w-20 flex-shrink-0">
            <AvatarFallback className="text-2xl font-bold" style={{ backgroundColor: `${c}26`, color: c }}>{initials(employee.firstName, employee.lastName)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-foreground truncate">{employee.firstName} {employee.lastName}</h1>
                  <BadgeCheck className="h-5 w-5 text-[#206295] flex-shrink-0" />
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{desig?.name || "—"}{dept ? ` · ${dept.name}` : ""}</p>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <Badge className={`gap-1 ${statusColors[status] || statusColors.inactive}`}><CheckCircle2 className="h-3.5 w-3.5" /><span className="capitalize">{status?.replace("_", " ")}</span></Badge>
                  <Badge className="bg-[#206295]/10 text-[#206295] hover:bg-[#206295]/10">Employee ID: {employee.employeeCode}</Badge>
                  <Badge variant="secondary">{typeLabel(employee.employmentType)}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {canManage && <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={onEdit} data-testid="button-edit-profile"><Edit className="h-3.5 w-3.5" /> Edit Profile</Button>}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" data-testid="profile-more"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    {employee.email && <DropdownMenuItem onClick={() => { window.location.href = `mailto:${employee.email}`; }}><Mail className="h-4 w-4 mr-2" /> Send email</DropdownMenuItem>}
                    {canManage && (
                      <>
                        {employee.email && <DropdownMenuSeparator />}
                        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Set status</DropdownMenuLabel>
                        {STATUS_OPTS.map((s) => (
                          <DropdownMenuItem key={s} onClick={() => onStatusChange(s)} data-testid={`set-status-${s}`}>
                            <span className="capitalize">{s.replace("_", " ")}</span>
                            {status === s && <Check className="h-3.5 w-3.5 ml-auto text-[#206295]" />}
                          </DropdownMenuItem>
                        ))}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-4 flex-wrap text-sm text-muted-foreground">
              {[
                employee.email && <span key="e" className="flex items-center gap-1.5"><Mail className="h-4 w-4 flex-shrink-0" /> {employee.email}</span>,
                employee.phone && <span key="p" className="flex items-center gap-1.5"><Phone className="h-4 w-4 flex-shrink-0" /> {employee.phone}</span>,
                employee.workLocation && <span key="l" className="flex items-center gap-1.5"><MapPin className="h-4 w-4 flex-shrink-0" /> {employee.workLocation}</span>,
                employee.joinDate && <span key="j" className="flex items-center gap-1.5"><Calendar className="h-4 w-4 flex-shrink-0" /> Joined {format(new Date(employee.joinDate), "MMM d, yyyy")}</span>,
              ].filter(Boolean).map((node, i) => (
                <div key={i} className="flex items-center gap-3">
                  {i > 0 && <Separator orientation="vertical" className="h-4" />}
                  {node}
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
