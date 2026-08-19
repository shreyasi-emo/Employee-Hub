import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { format } from "date-fns";
import { statusColors, typeLabel } from "../lib/employee-constants";
import { avatarColor, initials } from "../lib/employee-helpers";

/** Table view of the directory. Gains a leading checkbox column in select mode. */
export function EmployeesTable({ rows, departments, designations, selectionMode, selected, allSelected, onToggle, onToggleAll }: {
  rows: any[];
  departments: any[];
  designations: any[];
  selectionMode: boolean;
  selected: Set<string>;
  allSelected: boolean;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
}) {
  const [, navigate] = useLocation();

  const columns: DataTableColumn<any>[] = [
    ...(selectionMode ? [{ key: "__sel", header: <Checkbox checked={allSelected} onCheckedChange={onToggleAll} />, render: (e: any) => <Checkbox checked={selected.has(e.id)} onClick={(ev: any) => ev.stopPropagation()} onCheckedChange={() => onToggle(e.id)} /> }] as DataTableColumn<any>[] : []),
    { key: "name", header: "Name", render: (e: any) => <div className="flex items-center gap-2"><Avatar className="h-7 w-7"><AvatarFallback className="text-[10px]" style={{ backgroundColor: `${avatarColor(e.id)}26`, color: avatarColor(e.id) }}>{initials(e.firstName, e.lastName)}</AvatarFallback></Avatar><div><p className="font-medium text-foreground">{e.firstName} {e.lastName}</p><p className="text-xs text-muted-foreground">{e.employeeCode}</p></div></div> },
    { key: "dept", header: "Dept", cellClassName: "text-muted-foreground", render: (e: any) => departments.find((d) => d.id === e.departmentId)?.name || "—" },
    { key: "designation", header: "Designation", cellClassName: "text-muted-foreground", render: (e: any) => designations.find((d) => d.id === e.designationId)?.name || "—" },
    { key: "location", header: "Location", cellClassName: "text-muted-foreground", render: (e: any) => e.workLocation || "—" },
    { key: "type", header: "Type", cellClassName: "text-muted-foreground", render: (e: any) => typeLabel(e.employmentType) },
    { key: "joinDate", header: "Join Date", cellClassName: "text-muted-foreground", render: (e: any) => e.joinDate ? format(new Date(e.joinDate), "dd MMM yyyy") : "—" },
    { key: "status", header: "Status", render: (e: any) => <Badge className={`text-xs ${statusColors[e.employmentStatus] || statusColors.inactive}`}>{e.employmentStatus.replace("_", " ")}</Badge> },
  ];

  return (
    <Card className="border-0"><CardContent className="p-0">
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(e: any) => e.id}
        onRowClick={(e: any) => (selectionMode ? onToggle(e.id) : navigate(`/employees/${e.id}`))}
        testIdPrefix="employee-row"
      />
    </CardContent></Card>
  );
}
