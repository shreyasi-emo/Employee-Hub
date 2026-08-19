import { months, fmt } from "../lib/payroll-format";
import { Separator } from "@/components/ui/separator";

export function PayslipView({ payslip, employees }: { payslip: any; employees: any[] }) {
  const emp = employees.find(e => e.id === payslip.employeeId);
  const monthName = months[payslip.month - 1];

  return (
    <div className="p-4 space-y-4 text-sm">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-foreground">{emp ? `${emp.firstName} ${emp.lastName}` : "Unknown"}</h3>
          <p className="text-xs text-muted-foreground">{emp?.employeeCode}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold">{monthName} {payslip.year}</p>
          <p className="text-xs text-muted-foreground">{payslip.presentDays} / {payslip.totalWorkingDays} days</p>
          {parseFloat(payslip.lopDays) > 0 && (
            <p className="text-xs text-red-600">LOP: {payslip.lopDays} days</p>
          )}
        </div>
      </div>
      <Separator />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="font-semibold text-foreground mb-2">Earnings</p>
          <div className="space-y-1.5">
            {[
              { label: "Basic Salary", val: payslip.basicSalary },
              { label: "HRA", val: payslip.hra },
              { label: "Special Allowance", val: payslip.specialAllowance },
              { label: "Conveyance Allowance", val: payslip.conveyanceAllowance },
              { label: "Medical Allowance", val: payslip.medicalAllowance },
              { label: "Other Allowances", val: payslip.otherAllowances },
              { label: "Bonus", val: payslip.bonus },
            ].filter(e => parseFloat(e.val || "0") > 0).map(e => (
              <div key={e.label} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{e.label}</span>
                <span className="font-medium text-foreground">{fmt(e.val)}</span>
              </div>
            ))}
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between text-sm font-semibold">
            <span>Gross Salary</span>
            <span className="text-green-600">{fmt(payslip.grossSalary)}</span>
          </div>
        </div>
        <div>
          <p className="font-semibold text-foreground mb-2">Deductions</p>
          <div className="space-y-1.5">
            {[
              { label: "PF (Employee)", val: payslip.pfEmployee },
              { label: "PF (Employer)", val: payslip.pfEmployer },
              { label: "ESI (Employee)", val: payslip.esiEmployee },
              { label: "ESI (Employer)", val: payslip.esiEmployer },
              { label: "Professional Tax", val: payslip.professionalTax },
              { label: "TDS", val: payslip.tds },
              { label: "LOP Deduction", val: payslip.lopDeduction },
              { label: "Loan Recovery", val: payslip.loanRecovery },
              { label: "Other Deductions", val: payslip.otherDeductions },
            ].filter(e => parseFloat(e.val || "0") > 0).map(e => (
              <div key={e.label} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{e.label}</span>
                <span className="font-medium text-red-600">-{fmt(e.val)}</span>
              </div>
            ))}
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between text-sm font-semibold">
            <span>Total Deductions</span>
            <span className="text-red-600">-{fmt(payslip.totalDeductions)}</span>
          </div>
        </div>
      </div>
      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex justify-between items-center">
        <span className="font-bold text-foreground">Net Pay</span>
        <span className="text-lg font-bold text-primary">{fmt(payslip.netPay)}</span>
      </div>
    </div>
  );
}
