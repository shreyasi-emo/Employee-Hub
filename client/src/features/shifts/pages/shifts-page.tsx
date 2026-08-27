import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, isHR } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Clock, Plus, Trash2, Users, X } from "lucide-react";
import { format, addDays, startOfWeek } from "date-fns";
import { DAYS, SHORT_DAYS } from "../lib/days";
import { ShiftFormDialog } from "../components/shift-form-dialog";
import { AssignShiftDialog } from "../components/assign-shift-dialog";

export default function ShiftsPage() {
  const { data: auth } = useAuth();
  const user = auth?.user;
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [editShift, setEditShift] = useState<any>(null);

  const { data: shifts = [], isLoading: shiftsLoading } = useQuery<any[]>({ queryKey: ["/api/shifts"] });
  const { data: assignments = [], isLoading: assignLoading } = useQuery<any[]>({ queryKey: ["/api/shift-assignments"] });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });

  const deleteShift = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/shifts/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/shifts"] }); toast({ title: "Shift deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteAssignment = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/shift-assignments/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/shift-assignments"] }); toast({ title: "Assignment removed" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const hrUser = isHR(user!);

  // Roster: current week
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getEmployeeAssignment = (empId: string, date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return assignments.find((a: any) => {
      if (a.employeeId !== empId) return false;
      if (a.effectiveFrom > dateStr) return false;
      if (a.effectiveTo && a.effectiveTo < dateStr) return false;
      return true;
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Shifts & Assignments</h1>
          <p className="text-sm text-muted-foreground">{shifts.length} shifts defined</p>
        </div>
        {hrUser && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowAssign(true)} data-testid="button-assign-shift">
              <Users className="h-4 w-4 mr-2" /> Assign Shift
            </Button>
            <Button onClick={() => setShowCreate(true)} data-testid="button-create-shift">
              <Plus className="h-4 w-4 mr-2" /> Create Shift
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="shifts">
        <TabsList>
          <TabsTrigger value="shifts" data-testid="tab-shifts">Shift Definitions</TabsTrigger>
          <TabsTrigger value="assignments" data-testid="tab-assignments">Assignments</TabsTrigger>
          <TabsTrigger value="roster" data-testid="tab-roster">Weekly Roster</TabsTrigger>
        </TabsList>

        <TabsContent value="shifts" className="mt-4">
          {shiftsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3].map(i => <Skeleton key={i} className="h-40" />)}
            </div>
          ) : shifts.length === 0 ? (
            <div className="text-center py-16">
              <Clock className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No shifts defined</h3>
              {hrUser && <Button className="mt-4" onClick={() => setShowCreate(true)}>Create First Shift</Button>}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {shifts.map((shift: any) => (
                <Card key={shift.id} className="hover-elevate" data-testid={`shift-${shift.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Clock className="h-4 w-4 text-primary" />
                      </div>
                      {hrUser && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditShift(shift); setShowCreate(true); }} data-testid={`button-edit-shift-${shift.id}`}>
                            <span className="text-xs">✏️</span>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => window.confirm(`Delete "${shift.name}"?`) && deleteShift.mutate(shift.id)}
                            data-testid={`button-delete-shift-${shift.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="mt-3">
                      <p className="font-semibold text-foreground">{shift.name}</p>
                      <p className="text-sm text-muted-foreground">{shift.startTime} – {shift.endTime}</p>
                      {shift.graceMinutes > 0 && (
                        <p className="text-xs text-muted-foreground">{shift.graceMinutes}min grace</p>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {DAYS.map((day, i) => (
                        <span key={day} className={`text-xs px-1.5 py-0.5 rounded ${shift.weeklyOff?.includes(day) ? "bg-destructive/10 text-destructive" : "bg-[#4BDCD9]/25 text-[#0E7C7B]"}`}>
                          {SHORT_DAYS[i]}
                        </span>
                      ))}
                    </div>
                    {shift.description && <p className="text-xs text-muted-foreground mt-2">{shift.description}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="assignments" className="mt-4">
          {assignLoading ? (
            <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-14" />)}</div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-16">
              <Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No shift assignments</h3>
              {hrUser && <Button className="mt-4" onClick={() => setShowAssign(true)}>Assign Shift</Button>}
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <DataTable
                columns={[
                  { key: "employee", header: "Employee", render: (a: any) => { const emp = employees.find((e: any) => e.id === a.employeeId); return emp ? `${emp.firstName} ${emp.lastName}` : a.employeeId; } },
                  { key: "shift", header: "Shift", render: (a: any) => { const shift = shifts.find((s: any) => s.id === a.shiftId); return shift ? <div><span className="font-medium">{shift.name}</span><span className="text-muted-foreground ml-2 text-xs">{shift.startTime}–{shift.endTime}</span></div> : a.shiftId; } },
                  { key: "from", header: "Effective From", render: (a: any) => a.effectiveFrom },
                  { key: "to", header: "Effective To", cellClassName: "text-muted-foreground", render: (a: any) => a.effectiveTo || "—" },
                  ...(hrUser ? [{ key: "__action", header: "", align: "right" as const, render: (a: any) => <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => deleteAssignment.mutate(a.id)} data-testid={`button-remove-assignment-${a.id}`}><X className="h-3.5 w-3.5" /></Button> }] as DataTableColumn<any>[] : []),
                ]}
                rows={assignments}
                getRowKey={(a: any) => a.id}
                testIdPrefix="assignment"
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="roster" className="mt-4">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-48">Employee</th>
                  {weekDays.map(d => (
                    <th key={d.toISOString()} className="px-3 py-3 text-center font-medium text-muted-foreground min-w-20">
                      <div>{format(d, "EEE")}</div>
                      <div className="text-xs font-normal">{format(d, "d MMM")}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {employees.map((emp: any) => (
                  <tr key={emp.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2">
                      <div className="font-medium text-sm">{emp.firstName} {emp.lastName}</div>
                      <div className="text-xs text-muted-foreground">{emp.employeeCode}</div>
                    </td>
                    {weekDays.map(day => {
                      const assignment = getEmployeeAssignment(emp.id, day);
                      const shift = assignment ? shifts.find((s: any) => s.id === assignment.shiftId) : null;
                      const dayName = DAYS[day.getDay()];
                      const isOff = shift?.weeklyOff?.includes(dayName);
                      return (
                        <td key={day.toISOString()} className="px-2 py-2 text-center">
                          {shift ? (
                            isOff ? (
                              <span className="text-xs text-muted-foreground">Off</span>
                            ) : (
                              <Badge className="text-xs bg-primary/10 text-primary hover:bg-primary/10 border-0">
                                {shift.name.slice(0, 8)}
                              </Badge>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Week of {format(weekStart, "MMM d, yyyy")}</p>
        </TabsContent>
      </Tabs>

      {showCreate && (
        <ShiftFormDialog
          open={showCreate}
          onOpenChange={(v) => { setShowCreate(v); if (!v) setEditShift(null); }}
          editShift={editShift}
        />
      )}
      <AssignShiftDialog open={showAssign} onOpenChange={setShowAssign} employees={employees} shifts={shifts} />
    </div>
  );
}
