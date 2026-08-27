import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth, isAdmin } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { DateInput } from "@/components/shared/datetime-field";
import { CheckCircle2, User, Briefcase, CreditCard, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EMP_TYPES, EMP_STATUSES, GENDERS, SYSTEM_ROLES, MARITAL } from "../lib/employee-constants";
import {
  emptyForm, formSchema, formValuesFor, cleanPayload, makeDeptCode,
  loadLocations, saveLocations, type EmployeeFormValues,
} from "../lib/employee-form";
import { useSaveEmployee, useCreateDepartment, useCreateDesignation } from "../api/employees.api";
import { SelectWithAddNew } from "./select-with-add-new";

// Sectioned like the request forms: an icon badge + title over each grouped block.
function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="h-6 w-6 rounded-lg bg-[#206295]/10 text-[#206295] flex items-center justify-center flex-shrink-0"><Icon className="h-3.5 w-3.5" /></span>
        <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

/** Add + Edit employee, covering every DB field. Used by the directory and the profile. */
export function EmployeeFormDialog({ open, onOpenChange, employee, departments, designations, employees, knownLocations }: {
  open: boolean; onOpenChange: (v: boolean) => void; employee?: any;
  departments: any[]; designations: any[]; employees: any[]; knownLocations: string[];
}) {
  const { toast } = useToast();
  const { data: auth } = useAuth();
  const viewerRole = auth?.user?.role;
  // Only HR Admin + Super Admin may grant/alter a system role (HR Executive edits every other field).
  const canManageRoles = isAdmin(auth?.user ?? null);
  const roleOptions = SYSTEM_ROLES.filter((r) => r.value !== "super_admin" || viewerRole === "super_admin");
  const isEdit = !!employee;
  const [created, setCreated] = useState<{ name: string; email: string } | null>(null);
  const [customLocations, setCustomLocations] = useState<string[]>(() => loadLocations());
  const locations = Array.from(new Set([...knownLocations, ...customLocations]));

  const createDepartment = useCreateDepartment();
  const createDesignation = useCreateDesignation();

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(formSchema),
    values: employee ? formValuesFor(employee) : emptyForm,
  });

  const mutation = useSaveEmployee(employee?.id, {
    onSuccess: (data: any) => {
      if (isEdit) { toast({ title: "Employee updated" }); onOpenChange(false); }
      else setCreated({ name: `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim() || "The employee", email: data.email });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (created) {
    return (
      <Dialog open={open} onOpenChange={() => { setCreated(null); form.reset(emptyForm); onOpenChange(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Employee Created</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-[#0E7C7B] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">Employee account created successfully.</p>
                <p className="text-sm text-muted-foreground mt-1">They can now log in using their company Google account.</p>
                <p className="text-xs text-muted-foreground mt-2">{created.name} · {created.email}</p>
              </div>
            </div>
            <Button className="w-full" onClick={() => { setCreated(null); form.reset(emptyForm); onOpenChange(false); }}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const managerOptions = employees.filter((e) => e.id !== employee?.id).map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }));
  const T = (props: any) => <FormControl><Input {...props} /></FormControl>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? "Edit Employee" : "Add New Employee"}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(cleanPayload(d)))} className="space-y-5">
            <Section icon={User} title="Personal">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>First Name *</FormLabel>{T({ ...field })}<FormMessage /></FormItem>)} />
                <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Last Name *</FormLabel>{T({ ...field })}<FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email *</FormLabel>{T({ ...field, type: "email" })}<FormMessage /></FormItem>)} />
                <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone</FormLabel>{T({ ...field, type: "tel", inputMode: "tel" })}<FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormField control={form.control} name="dateOfBirth" render={({ field }) => (<FormItem><FormLabel>Date of Birth</FormLabel><DateInput value={field.value} onChange={field.onChange} /></FormItem>)} />
                <FormField control={form.control} name="gender" render={({ field }) => (<FormItem><FormLabel>Gender</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger></FormControl><SelectContent>{GENDERS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                <FormField control={form.control} name="maritalStatus" render={({ field }) => (<FormItem><FormLabel>Marital Status</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger></FormControl><SelectContent>{MARITAL.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select></FormItem>)} />
              </div>
            </Section>

            <Separator />

            <Section icon={Briefcase} title="Employment">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="joinDate" render={({ field }) => (<FormItem><FormLabel>Join Date *</FormLabel><DateInput value={field.value} onChange={field.onChange} /><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="confirmationDate" render={({ field }) => (<FormItem><FormLabel>Confirmation Date</FormLabel><DateInput value={field.value} onChange={field.onChange} /></FormItem>)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="departmentId" render={({ field }) => (<FormItem><FormLabel>Department</FormLabel><SelectWithAddNew value={field.value} onChange={field.onChange} placeholder="Select department" testId="select-department" options={departments.map((d) => ({ value: d.id, label: d.name }))} onCreate={(name) => createDepartment(name, makeDeptCode(name, departments))} /></FormItem>)} />
                <FormField control={form.control} name="designationId" render={({ field }) => (<FormItem><FormLabel>Designation</FormLabel><SelectWithAddNew value={field.value} onChange={field.onChange} placeholder="Select designation" testId="select-designation" options={designations.map((d) => ({ value: d.id, label: d.name }))} onCreate={(name) => createDesignation(name)} /></FormItem>)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="workLocation" render={({ field }) => (<FormItem><FormLabel>Location</FormLabel><SelectWithAddNew value={field.value} onChange={field.onChange} placeholder="Select location" testId="select-location" options={locations.map((l) => ({ value: l, label: l }))} onCreate={(name) => { if (!locations.includes(name)) { const next = [...customLocations, name]; setCustomLocations(next); saveLocations(next); } return name; }} /></FormItem>)} />
                <FormField control={form.control} name="managerId" render={({ field }) => (<FormItem><FormLabel>Manager</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger></FormControl><SelectContent>{managerOptions.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select></FormItem>)} />
              </div>
              {canManageRoles && (
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="systemRole" render={({ field }) => (<FormItem><FormLabel>System Role</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger data-testid="select-system-role"><SelectValue placeholder="Employee" /></SelectTrigger></FormControl><SelectContent>{roleOptions.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent></Select><p className="text-[11px] text-muted-foreground mt-1">Controls what this person can access in the app.</p></FormItem>)} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="employmentType" render={({ field }) => (<FormItem><FormLabel>Employment Type</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{EMP_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                <FormField control={form.control} name="employmentStatus" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{EMP_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></FormItem>)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="noticePeriodDays" render={({ field }) => (<FormItem><FormLabel>Notice Period (days)</FormLabel>{T({ ...field, type: "number" })}</FormItem>)} />
                <FormField control={form.control} name="probationDays" render={({ field }) => (<FormItem><FormLabel>Probation (days)</FormLabel>{T({ ...field, type: "number" })}</FormItem>)} />
              </div>
            </Section>

            <Separator />

            <Section icon={CreditCard} title="Statutory & Bank">
              <div className="grid grid-cols-3 gap-3">
                <FormField control={form.control} name="panNumber" render={({ field }) => (<FormItem><FormLabel>PAN</FormLabel>{T({ ...field })}</FormItem>)} />
                <FormField control={form.control} name="aadhaarMasked" render={({ field }) => (<FormItem><FormLabel>Aadhaar (masked)</FormLabel>{T({ ...field, inputMode: "numeric" })}</FormItem>)} />
                <FormField control={form.control} name="uan" render={({ field }) => (<FormItem><FormLabel>UAN</FormLabel>{T({ ...field, inputMode: "numeric" })}</FormItem>)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormField control={form.control} name="bankName" render={({ field }) => (<FormItem><FormLabel>Bank Name</FormLabel>{T({ ...field })}</FormItem>)} />
                <FormField control={form.control} name="bankAccountMasked" render={({ field }) => (<FormItem><FormLabel>Account (masked)</FormLabel>{T({ ...field, inputMode: "numeric" })}</FormItem>)} />
                <FormField control={form.control} name="ifscCode" render={({ field }) => (<FormItem><FormLabel>IFSC</FormLabel>{T({ ...field })}</FormItem>)} />
              </div>
              <div className="flex items-center gap-6">
                <FormField control={form.control} name="pfEligible" render={({ field }) => (<FormItem className="flex items-center gap-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="!mt-0">PF Eligible</FormLabel></FormItem>)} />
                <FormField control={form.control} name="esiEligible" render={({ field }) => (<FormItem className="flex items-center gap-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="!mt-0">ESI Eligible</FormLabel></FormItem>)} />
              </div>
            </Section>

            <Separator />

            <Section icon={MapPin} title="Address & Emergency">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="currentAddress" render={({ field }) => (<FormItem><FormLabel>Current Address</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>)} />
                <FormField control={form.control} name="permanentAddress" render={({ field }) => (<FormItem><FormLabel>Permanent Address</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormField control={form.control} name="emergencyContactName" render={({ field }) => (<FormItem><FormLabel>Emergency Name</FormLabel>{T({ ...field })}</FormItem>)} />
                <FormField control={form.control} name="emergencyContactPhone" render={({ field }) => (<FormItem><FormLabel>Emergency Phone</FormLabel>{T({ ...field, type: "tel", inputMode: "tel" })}</FormItem>)} />
                <FormField control={form.control} name="emergencyContactRelation" render={({ field }) => (<FormItem><FormLabel>Relation</FormLabel>{T({ ...field })}</FormItem>)} />
              </div>
            </Section>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-submit-employee">
                {mutation.isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Employee"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
