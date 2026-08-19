import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Phone, MapPin, Calendar, Edit } from "lucide-react";
import { format } from "date-fns";

// NOTE: intentionally a different palette from the directory's brand chips
// (lib/employee-constants.ts). Kept as-is to preserve the profile header's look.
const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  inactive: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  on_notice: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  exited: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

// Default-avatar shade — main brand colors only. Also intentionally distinct from
// the directory's hash-based avatarColor: this one sums the two initials.
const AVATAR_BRAND = ["#206295", "#4BDCD9", "#FF6F62"];

export function ProfileHeaderCard({ employee, dept, desig, canManage, onStatusChange, onEdit }: {
  employee: any; dept: any; desig: any; canManage: boolean;
  onStatusChange: (v: string) => void; onEdit: () => void;
}) {
  const initials = `${employee.firstName[0]}${employee.lastName[0]}`;
  const avColor = AVATAR_BRAND[(employee.firstName.charCodeAt(0) + employee.lastName.charCodeAt(0)) % AVATAR_BRAND.length];

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start gap-5 flex-wrap">
          <Avatar className="h-16 w-16 flex-shrink-0">
            <AvatarFallback className="text-xl font-bold" style={{ backgroundColor: `${avColor}26`, color: avColor }}>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  {employee.firstName} {employee.lastName}
                </h1>
                <p className="text-sm text-muted-foreground">{employee.employeeCode}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {desig && <Badge variant="secondary">{desig.name}</Badge>}
                  {dept && <Badge variant="outline">{dept.name}</Badge>}
                  <Badge className={`${statusColors[employee.employmentStatus] || ""}`}>
                    {employee.employmentStatus?.replace("_", " ")}
                  </Badge>
                </div>
              </div>
              {canManage && (
                <div className="flex gap-2 flex-wrap">
                  <Select value={employee.employmentStatus} onValueChange={onStatusChange}>
                    <SelectTrigger className="w-36 h-8 text-xs" data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["active", "inactive", "on_notice", "exited"].map(s => (
                        <SelectItem key={s} value={s} className="text-xs">
                          {s.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1"
                    onClick={onEdit}
                    data-testid="button-edit-profile"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    Edit Profile
                  </Button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4 mt-3 flex-wrap text-sm text-muted-foreground">
              {employee.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> {employee.email}
                </span>
              )}
              {employee.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> {employee.phone}
                </span>
              )}
              {employee.workLocation && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {employee.workLocation}
                </span>
              )}
              {employee.joinDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Joined {format(new Date(employee.joinDate), "MMM d, yyyy")}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
