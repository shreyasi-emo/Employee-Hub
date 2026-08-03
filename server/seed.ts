import { db } from "./db";
import { storage, DEFAULT_LEAVE_BALANCES } from "./storage";
import { hashPassword } from "./shared/auth";
import {
  users, employees, departments, designations, leaveTypes,
  leaveBalances, holidays, statutoryConfig, announcements, assets, payrollRuns, payslips,
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { randomBytes } from "crypto";

// Seed accounts share one password, supplied via the SEED_PASSWORD env var.
// If unset, a random one is generated and printed once — so no credential is
// ever hardcoded in source (previous hardcoded demo passwords were removed after
// a secret-scanning alert on the public repo).
const SEED_PASSWORD = process.env.SEED_PASSWORD || randomBytes(9).toString("base64url");
const seedPw = () => hashPassword(SEED_PASSWORD);

export async function seed() {
  // Check if already seeded
  const existingUsers = await db.select().from(users).limit(1);
  if (existingUsers.length > 0) return;

  console.log("Seeding database...");

  // Create departments
  const [engineeringDept] = await db.insert(departments).values({ name: "Engineering", code: "ENG" }).returning();
  const [hrDept] = await db.insert(departments).values({ name: "Human Resources", code: "HR" }).returning();
  const [financeDept] = await db.insert(departments).values({ name: "Finance & Accounts", code: "FIN" }).returning();
  const [salesDept] = await db.insert(departments).values({ name: "Sales & Marketing", code: "SAL" }).returning();
  const [opsDept] = await db.insert(departments).values({ name: "Operations", code: "OPS" }).returning();

  // Create designations
  const [cto] = await db.insert(designations).values({ name: "Chief Technology Officer", grade: "L8", departmentId: engineeringDept.id }).returning();
  const [seniorEng] = await db.insert(designations).values({ name: "Senior Software Engineer", grade: "L5", departmentId: engineeringDept.id }).returning();
  const [engDes] = await db.insert(designations).values({ name: "Software Engineer", grade: "L4", departmentId: engineeringDept.id }).returning();
  const [hrManager] = await db.insert(designations).values({ name: "HR Manager", grade: "L6", departmentId: hrDept.id }).returning();
  const [hrExec] = await db.insert(designations).values({ name: "HR Executive", grade: "L4", departmentId: hrDept.id }).returning();
  const [cfo] = await db.insert(designations).values({ name: "Chief Financial Officer", grade: "L8", departmentId: financeDept.id }).returning();
  const [finAnalyst] = await db.insert(designations).values({ name: "Finance Analyst", grade: "L4", departmentId: financeDept.id }).returning();
  const [salesManager] = await db.insert(designations).values({ name: "Sales Manager", grade: "L6", departmentId: salesDept.id }).returning();
  const [salesExec] = await db.insert(designations).values({ name: "Sales Executive", grade: "L4", departmentId: salesDept.id }).returning();
  const [opsManager] = await db.insert(designations).values({ name: "Operations Manager", grade: "L6", departmentId: opsDept.id }).returning();

  // Create Super Admin user first (no employee record)
  const superAdminUser = await storage.createUser({
    username: "superadmin",
    password: seedPw(),
    role: "super_admin",
  });

  // Create employees
  const emp1 = await db.insert(employees).values({
    employeeCode: "EMO001",
    firstName: "Arjun",
    lastName: "Sharma",
    email: "arjun.sharma@emo.com",
    phone: "+91-9876543210",
    dateOfBirth: "1985-03-15",
    gender: "male",
    maritalStatus: "married",
    joinDate: "2018-01-15",
    confirmationDate: "2018-04-15",
    employmentType: "full_time",
    employmentStatus: "active",
    designationId: cto.id,
    departmentId: engineeringDept.id,
    workLocation: "Mumbai",
    panNumber: "ABCDE1234F",
    aadhaarMasked: "XXXX-XXXX-4567",
    uan: "100123456789",
    pfEligible: true,
    esiEligible: false,
    bankName: "HDFC Bank",
    bankAccountMasked: "XXXX-XXXX-5678",
    ifscCode: "HDFC0001234",
    currentAddress: "101, Andheri West, Mumbai - 400053",
    permanentAddress: "101, Andheri West, Mumbai - 400053",
    emergencyContactName: "Priya Sharma",
    emergencyContactPhone: "+91-9876543200",
    emergencyContactRelation: "Spouse",
  }).returning();

  const emp2 = await db.insert(employees).values({
    employeeCode: "EMO002",
    firstName: "Priya",
    lastName: "Nair",
    email: "priya.nair@emo.com",
    phone: "+91-9876543211",
    dateOfBirth: "1990-07-22",
    gender: "female",
    maritalStatus: "single",
    joinDate: "2020-06-01",
    confirmationDate: "2020-09-01",
    employmentType: "full_time",
    employmentStatus: "active",
    designationId: hrManager.id,
    departmentId: hrDept.id,
    workLocation: "Mumbai",
    panNumber: "PQRST5678G",
    aadhaarMasked: "XXXX-XXXX-1234",
    uan: "100234567890",
    pfEligible: true,
    esiEligible: false,
    bankName: "SBI",
    bankAccountMasked: "XXXX-XXXX-9012",
    ifscCode: "SBIN0001234",
    currentAddress: "45, Bandra East, Mumbai - 400051",
    permanentAddress: "Trivandrum, Kerala",
    emergencyContactName: "Suresh Nair",
    emergencyContactPhone: "+91-9876540001",
    emergencyContactRelation: "Father",
  }).returning();

  const emp3 = await db.insert(employees).values({
    employeeCode: "EMO003",
    firstName: "Rahul",
    lastName: "Gupta",
    email: "rahul.gupta@emo.com",
    phone: "+91-9876543212",
    dateOfBirth: "1992-11-30",
    gender: "male",
    maritalStatus: "married",
    joinDate: "2021-03-15",
    confirmationDate: "2021-06-15",
    employmentType: "full_time",
    employmentStatus: "active",
    designationId: seniorEng.id,
    departmentId: engineeringDept.id,
    managerId: emp1[0].id,
    workLocation: "Pune",
    panNumber: "GHIJK9012H",
    aadhaarMasked: "XXXX-XXXX-7890",
    uan: "100345678901",
    pfEligible: true,
    esiEligible: true,
    bankName: "ICICI Bank",
    bankAccountMasked: "XXXX-XXXX-3456",
    ifscCode: "ICIC0001234",
    currentAddress: "78, Koregaon Park, Pune - 411001",
    permanentAddress: "Lucknow, UP",
    emergencyContactName: "Sunita Gupta",
    emergencyContactPhone: "+91-9876540002",
    emergencyContactRelation: "Spouse",
  }).returning();

  const emp4 = await db.insert(employees).values({
    employeeCode: "EMO004",
    firstName: "Sneha",
    lastName: "Patel",
    email: "sneha.patel@emo.com",
    phone: "+91-9876543213",
    dateOfBirth: "1994-04-18",
    gender: "female",
    maritalStatus: "single",
    joinDate: "2022-01-10",
    confirmationDate: "2022-04-10",
    employmentType: "full_time",
    employmentStatus: "active",
    designationId: engDes.id,
    departmentId: engineeringDept.id,
    managerId: emp3[0].id,
    workLocation: "Mumbai",
    pfEligible: true,
    esiEligible: true,
    bankName: "Axis Bank",
    bankAccountMasked: "XXXX-XXXX-7890",
    ifscCode: "UTIB0001234",
    currentAddress: "23, Malad West, Mumbai - 400064",
    permanentAddress: "Ahmedabad, Gujarat",
    emergencyContactName: "Ramesh Patel",
    emergencyContactPhone: "+91-9876540003",
    emergencyContactRelation: "Father",
  }).returning();

  const emp5 = await db.insert(employees).values({
    employeeCode: "EMO005",
    firstName: "Vikram",
    lastName: "Singh",
    email: "vikram.singh@emo.com",
    phone: "+91-9876543214",
    dateOfBirth: "1988-09-05",
    gender: "male",
    maritalStatus: "married",
    joinDate: "2019-07-01",
    confirmationDate: "2019-10-01",
    employmentType: "full_time",
    employmentStatus: "active",
    designationId: cfo.id,
    departmentId: financeDept.id,
    workLocation: "Mumbai",
    pfEligible: true,
    esiEligible: false,
    bankName: "Kotak Mahindra",
    bankAccountMasked: "XXXX-XXXX-2345",
    ifscCode: "KKBK0001234",
    currentAddress: "55, Powai, Mumbai - 400076",
    permanentAddress: "Jaipur, Rajasthan",
    emergencyContactName: "Meena Singh",
    emergencyContactPhone: "+91-9876540004",
    emergencyContactRelation: "Spouse",
  }).returning();

  const emp6 = await db.insert(employees).values({
    employeeCode: "EMO006",
    firstName: "Ananya",
    lastName: "Reddy",
    email: "ananya.reddy@emo.com",
    phone: "+91-9876543215",
    dateOfBirth: "1996-02-14",
    gender: "female",
    maritalStatus: "single",
    joinDate: "2023-01-02",
    confirmationDate: "2023-04-02",
    employmentType: "full_time",
    employmentStatus: "active",
    designationId: hrExec.id,
    departmentId: hrDept.id,
    managerId: emp2[0].id,
    workLocation: "Hyderabad",
    pfEligible: true,
    esiEligible: true,
    bankName: "SBI",
    bankAccountMasked: "XXXX-XXXX-6789",
    ifscCode: "SBIN0002345",
    currentAddress: "12, Banjara Hills, Hyderabad - 500034",
    permanentAddress: "Vijayawada, AP",
    emergencyContactName: "Krishna Reddy",
    emergencyContactPhone: "+91-9876540005",
    emergencyContactRelation: "Father",
  }).returning();

  const emp7 = await db.insert(employees).values({
    employeeCode: "EMO007",
    firstName: "Karthik",
    lastName: "Menon",
    email: "karthik.menon@emo.com",
    phone: "+91-9876543216",
    dateOfBirth: "1991-06-25",
    gender: "male",
    maritalStatus: "married",
    joinDate: "2020-09-15",
    confirmationDate: "2020-12-15",
    employmentType: "full_time",
    employmentStatus: "active",
    designationId: salesManager.id,
    departmentId: salesDept.id,
    workLocation: "Chennai",
    pfEligible: true,
    esiEligible: false,
    bankName: "Federal Bank",
    bankAccountMasked: "XXXX-XXXX-3456",
    ifscCode: "FDRL0001234",
    currentAddress: "34, Anna Nagar, Chennai - 600040",
    permanentAddress: "Kochi, Kerala",
    emergencyContactName: "Lakshmi Menon",
    emergencyContactPhone: "+91-9876540006",
    emergencyContactRelation: "Spouse",
  }).returning();

  const emp8 = await db.insert(employees).values({
    employeeCode: "EMO008",
    firstName: "Divya",
    lastName: "Krishnan",
    email: "divya.krishnan@emo.com",
    phone: "+91-9876543217",
    dateOfBirth: "1993-12-08",
    gender: "female",
    maritalStatus: "single",
    joinDate: "2021-11-01",
    confirmationDate: "2022-02-01",
    employmentType: "full_time",
    employmentStatus: "active",
    designationId: finAnalyst.id,
    departmentId: financeDept.id,
    managerId: emp5[0].id,
    workLocation: "Mumbai",
    pfEligible: true,
    esiEligible: true,
    bankName: "HDFC Bank",
    bankAccountMasked: "XXXX-XXXX-8901",
    ifscCode: "HDFC0002345",
    currentAddress: "67, Thane West, Mumbai - 400601",
    permanentAddress: "Coimbatore, TN",
    emergencyContactName: "Rajan Krishnan",
    emergencyContactPhone: "+91-9876540007",
    emergencyContactRelation: "Father",
  }).returning();

  // Create user accounts for employees.
  // MVP: only the 5 active roles are assigned (super_admin, hr_admin, finance,
  // ceo_approver, employee). Former manager / hr_executive users become employees.
  const employeeData = [
    { emp: emp1[0], role: "employee" as const, username: "arjun.sharma" },
    { emp: emp2[0], role: "hr_admin" as const, username: "priya.nair" },
    { emp: emp3[0], role: "employee" as const, username: "rahul.gupta" },
    { emp: emp4[0], role: "employee" as const, username: "sneha.patel" },
    { emp: emp5[0], role: "finance" as const, username: "vikram.singh" },
    { emp: emp6[0], role: "employee" as const, username: "ananya.reddy" },
    { emp: emp7[0], role: "employee" as const, username: "karthik.menon" },
    { emp: emp8[0], role: "employee" as const, username: "divya.krishnan" },
  ];

  for (const { emp, role, username } of employeeData) {
    const user = await storage.createUser({
      username,
      password: seedPw(),
      role,
      employeeId: emp.id,
    });
    await db.update(employees).set({ userId: user.id }).where(eq(employees.id, emp.id));
  }

  // Salary structures
  const salaryData = [
    { empId: emp1[0].id, basic: 120000, hra: 48000, special: 32000, ctc: 2400000 },
    { empId: emp2[0].id, basic: 80000, hra: 32000, special: 20000, ctc: 1560000 },
    { empId: emp3[0].id, basic: 90000, hra: 36000, special: 24000, ctc: 1800000 },
    { empId: emp4[0].id, basic: 55000, hra: 22000, special: 13000, ctc: 1080000 },
    { empId: emp5[0].id, basic: 110000, hra: 44000, special: 26000, ctc: 2160000 },
    { empId: emp6[0].id, basic: 40000, hra: 16000, special: 9000, ctc: 780000 },
    { empId: emp7[0].id, basic: 85000, hra: 34000, special: 21000, ctc: 1680000 },
    { empId: emp8[0].id, basic: 50000, hra: 20000, special: 12000, ctc: 984000 },
  ];

  for (const s of salaryData) {
    await storage.createSalaryStructure({
      employeeId: s.empId,
      effectiveFrom: "2024-01-01",
      basicSalary: String(s.basic),
      hra: String(s.hra),
      specialAllowance: String(s.special),
      conveyanceAllowance: "1600",
      medicalAllowance: "1250",
      otherAllowances: "0",
      ctc: String(s.ctc),
      notes: "Annual revision 2024",
    });
  }

  // Leave types
  await db.insert(leaveTypes).values([
    { name: "Casual Leave", code: "CL", color: "#3B82F6", isPaid: true, isCarryForward: false, maxDaysPerYear: 12, requiresApproval: true, description: "For casual/personal needs" },
    { name: "Sick Leave", code: "SL", color: "#EF4444", isPaid: true, isCarryForward: false, maxDaysPerYear: 10, requiresApproval: false, description: "For medical illness" },
    { name: "Earned Leave", code: "EL", color: "#10B981", isPaid: true, isCarryForward: true, maxCarryForwardDays: 30, isEncashable: true, maxDaysPerYear: 18, requiresApproval: true, description: "Accrued earned leave" },
    { name: "Maternity Leave", code: "ML", color: "#EC4899", isPaid: true, isCarryForward: false, maxDaysPerYear: 182, requiresApproval: true, description: "As per Maternity Benefit Act" },
    { name: "Paternity Leave", code: "PL", color: "#8B5CF6", isPaid: true, isCarryForward: false, maxDaysPerYear: 15, requiresApproval: true, description: "For fathers on birth of child" },
    { name: "Comp Off", code: "CO", color: "#F59E0B", isPaid: true, isCarryForward: false, maxDaysPerYear: 10, requiresApproval: true, description: "Compensatory off for extra work" },
    { name: "Loss of Pay", code: "LOP", color: "#6B7280", isPaid: false, isCarryForward: false, maxDaysPerYear: 365, requiresApproval: true, description: "Unpaid leave" },
  ]);

  // Seed leave balances for all employees
  const allLeaveTypes = await storage.getLeaveTypes();
  const allEmployees = await storage.getEmployees({ status: "active" });
  const currentYear = new Date().getFullYear();

  const balances = DEFAULT_LEAVE_BALANCES;

  // Give the super admin an employee profile so admin can use employee-scoped features
  const [adminEmp] = await db.insert(employees).values({
    employeeCode: "EMO000",
    firstName: "Super",
    lastName: "Admin",
    email: "software@emoenergy.in",
    joinDate: `${currentYear}-01-01`,
    employmentType: "full_time",
    employmentStatus: "active",
    userId: superAdminUser.id,
  }).returning();
  await storage.updateUser(superAdminUser.id, { employeeId: adminEmp.id });

  // Dedicated Finance and CEO profiles for the reimbursement approval workflow
  const [financeEmp] = await db.insert(employees).values({
    employeeCode: "EMO0F1", firstName: "Neha", lastName: "Verma", email: "finance@emoenergy.in",
    joinDate: `${currentYear}-01-01`, employmentType: "full_time", employmentStatus: "active", departmentId: financeDept?.id ?? null,
  }).returning();
  const financeUser = await storage.createUser({ username: "finance@emoenergy.in", password: seedPw(), role: "finance", employeeId: financeEmp.id, isActive: true, accountStatus: "active" } as any);
  await db.update(employees).set({ userId: financeUser.id }).where(eq(employees.id, financeEmp.id));

  const [ceoEmp] = await db.insert(employees).values({
    employeeCode: "EMO0C1", firstName: "Rajesh", lastName: "Khanna", email: "ceo@emoenergy.in",
    joinDate: `${currentYear}-01-01`, employmentType: "full_time", employmentStatus: "active",
  }).returning();
  const ceoUser = await storage.createUser({ username: "ceo@emoenergy.in", password: seedPw(), role: "ceo_approver", employeeId: ceoEmp.id, isActive: true, accountStatus: "active" } as any);
  await db.update(employees).set({ userId: ceoUser.id }).where(eq(employees.id, ceoEmp.id));

  // MVP: legacy role profiles (recruiter / hr_ops / office_admin / interviewer)
  // are intentionally not seeded — only the 5 active roles exist.

  for (const emp_ of [...allEmployees, adminEmp, financeEmp, ceoEmp]) {
    for (const lt of allLeaveTypes) {
      const bal = balances[lt.code] || 0;
      if (bal > 0) {
        await storage.upsertLeaveBalance({
          employeeId: emp_.id,
          leaveTypeId: lt.id,
          year: currentYear,
          openingBalance: "0",
          accrued: String(bal),
          taken: "0",
          adjusted: "0",
          closingBalance: String(bal),
        });
      }
    }
  }

  // Holidays for Mumbai & All India
  const year = currentYear;
  await db.insert(holidays).values([
    { name: "New Year's Day", date: `${year}-01-01`, location: "all", year, isOptional: false },
    { name: "Republic Day", date: `${year}-01-26`, location: "all", year, isOptional: false },
    { name: "Holi", date: `${year}-03-14`, location: "all", year, isOptional: false },
    { name: "Good Friday", date: `${year}-04-18`, location: "all", year, isOptional: true },
    { name: "Dr. Ambedkar Jayanti", date: `${year}-04-14`, location: "all", year, isOptional: false },
    { name: "Maharashtra Day", date: `${year}-05-01`, location: "Mumbai", year, isOptional: false },
    { name: "Independence Day", date: `${year}-08-15`, location: "all", year, isOptional: false },
    { name: "Ganesh Chaturthi", date: `${year}-08-27`, location: "Mumbai", year, isOptional: false },
    { name: "Gandhi Jayanti", date: `${year}-10-02`, location: "all", year, isOptional: false },
    { name: "Dussehra", date: `${year}-10-02`, location: "all", year, isOptional: false },
    { name: "Diwali", date: `${year}-10-20`, location: "all", year, isOptional: false },
    { name: "Diwali Laxmi Puja", date: `${year}-10-21`, location: "all", year, isOptional: false },
    { name: "Christmas", date: `${year}-12-25`, location: "all", year, isOptional: false },
  ]);

  // Announcements
  await db.insert(announcements).values([
    {
      title: "Welcome to EMO HRIS!",
      content: "We are excited to launch our new HR Information System. You can now manage your attendance, leave requests, and view your payslips all in one place. Please reach out to HR if you need any assistance.",
      category: "general",
      isActive: true,
    },
    {
      title: "Q4 2024 Performance Reviews",
      content: "Annual performance reviews for Q4 2024 will begin from January 15th. Managers are requested to complete self-appraisals by January 10th. HR will share detailed guidelines shortly.",
      category: "hr",
      isActive: true,
    },
    {
      title: "Updated Leave Policy 2025",
      content: "Please note that the leave policy for 2025 has been updated. Earned Leave accrual will now be monthly (1.5 days/month). Unused Casual Leaves cannot be carried forward to the next year. Please review the updated policy document in the Documents section.",
      category: "policy",
      isActive: true,
    },
  ]);

  // Statutory config
  const configs = [
    { key: "pf_employee_rate", value: "0.12", description: "PF Employee contribution rate (12%)" },
    { key: "pf_employer_rate", value: "0.12", description: "PF Employer contribution rate (12%)" },
    { key: "pf_ceiling", value: "15000", description: "PF wage ceiling (INR 15,000)" },
    { key: "esi_employee_rate", value: "0.0075", description: "ESI Employee rate (0.75%)" },
    { key: "esi_employer_rate", value: "0.0325", description: "ESI Employer rate (3.25%)" },
    { key: "esi_ceiling", value: "21000", description: "ESI gross salary ceiling (INR 21,000)" },
    { key: "pt_maharashtra_threshold", value: "10000", description: "PT threshold for Maharashtra (INR 10,000)" },
    { key: "pt_maharashtra_amount", value: "200", description: "PT amount for Maharashtra (INR 200/month)" },
    { key: "gratuity_rate", value: "0.0481", description: "Gratuity rate (4.81% of basic)" },
  ];

  for (const cfg of configs) {
    await storage.setStatutoryConfig(cfg.key, cfg.value, cfg.description);
  }

  // Assets
  await db.insert(assets).values([
    { assetCode: "ASSET001", name: "MacBook Pro 14\"", category: "laptop", serialNumber: "FVFXX1234YZ", assignedTo: emp1[0].id, assignedDate: "2022-01-15", condition: "excellent" },
    { assetCode: "ASSET002", name: "iPhone 14 Pro", category: "phone", serialNumber: "DNPXX5678AB", assignedTo: emp1[0].id, assignedDate: "2022-06-01", condition: "good" },
    { assetCode: "ASSET003", name: "Dell Inspiron 15", category: "laptop", serialNumber: "DELLXX9012CD", assignedTo: emp3[0].id, assignedDate: "2021-03-20", condition: "good" },
    { assetCode: "ASSET004", name: "Access Card #1042", category: "access_card", serialNumber: "AC1042", assignedTo: emp4[0].id, assignedDate: "2022-01-12", condition: "good" },
    { assetCode: "ASSET005", name: "HP EliteBook 840", category: "laptop", serialNumber: "HPXX3456EF", assignedTo: emp5[0].id, assignedDate: "2020-01-05", condition: "good" },
    { assetCode: "ASSET006", name: "ThinkPad T14", category: "laptop", serialNumber: "LNVXX7890GH", assignedTo: emp2[0].id, assignedDate: "2020-06-10", condition: "excellent" },
  ]);

  // Seed some attendance for current month
  const today = new Date();
  const empIds = [emp1[0].id, emp2[0].id, emp3[0].id, emp4[0].id, emp5[0].id];
  const statuses = ["present", "present", "present", "present", "wfh", "present", "half_day"];

  for (const empId of empIds) {
    for (let d = 1; d <= Math.min(today.getDate() - 1, 28); d++) {
      const date = new Date(today.getFullYear(), today.getMonth(), d);
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      const status = statuses[d % statuses.length];
      const checkIn = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0, 0);
      const checkOut = status === "half_day" ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 13, 30, 0)
        : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 18, 30, 0);
      await storage.upsertAttendance({
        employeeId: empId,
        date: date.toISOString().split("T")[0],
        checkIn,
        checkOut,
        totalHours: status === "half_day" ? "4.5" : "9.5",
        status: status as any,
        source: "manual",
      });
    }
  }

  // Seed a payroll run for last month
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const lmMonth = lastMonth.getMonth() + 1;
  const lmYear = lastMonth.getFullYear();

  const payrollRun = await storage.createPayrollRun({
    month: lmMonth, year: lmYear, status: "locked", createdBy: superAdminUser.id,
    totalEmployees: 8,
    totalGross: "631100",
    totalDeductions: "68142",
    totalNetPay: "562958",
  });

  await db.update(payrollRuns).set({ lockedAt: new Date(), lockedBy: superAdminUser.id }).where(eq(payrollRuns.id, payrollRun.id));

  // Sample payslips
  const payslipData = [
    { empId: emp1[0].id, basic: 120000, hra: 48000, special: 32000, gross: 203850, net: 180850, pf: 14400, pt: 200 },
    { empId: emp2[0].id, basic: 80000, hra: 32000, special: 20000, gross: 134850, net: 119450, pf: 9600, pt: 200 },
    { empId: emp3[0].id, basic: 90000, hra: 36000, special: 24000, gross: 153850, net: 136450, pf: 10800, pt: 200 },
    { empId: emp4[0].id, basic: 55000, hra: 22000, special: 13000, gross: 93850, net: 80762, pf: 6600, pt: 200, esi: 704 },
    { empId: emp5[0].id, basic: 110000, hra: 44000, special: 26000, gross: 183850, net: 162850, pf: 13200, pt: 200 },
  ];

  for (const pd of payslipData) {
    await db.insert(payslips).values({
      payrollRunId: payrollRun.id,
      employeeId: pd.empId,
      month: lmMonth,
      year: lmYear,
      totalWorkingDays: 22,
      presentDays: "21",
      lopDays: "0",
      basicSalary: String(pd.basic),
      hra: String(pd.hra),
      specialAllowance: String(pd.special),
      conveyanceAllowance: "1600",
      medicalAllowance: "1250",
      otherAllowances: "0",
      bonus: "0",
      grossSalary: String(pd.gross),
      pfEmployee: String(pd.pf),
      pfEmployer: String(pd.pf),
      esiEmployee: String(pd.esi || 0),
      esiEmployer: String((pd.esi || 0) * (3.25 / 0.75)),
      professionalTax: String(pd.pt),
      tds: "0",
      loanRecovery: "0",
      otherDeductions: "0",
      lopDeduction: "0",
      totalDeductions: String(pd.pf + (pd.esi || 0) + pd.pt),
      netPay: String(pd.net),
      adjustments: [],
    });
  }

  // Single shared company vehicle for the /vehicles hybrid booking flow.
  await storage.createCompanyVehicle({ name: "Company Car", model: "Toyota Innova Crysta", registrationNo: "MH-01-AB-1234", baseLocation: "Head Office", status: "active" });

  console.log("Seeding complete! MVP demo accounts (all share one password):");
  console.log(`  Password    : ${SEED_PASSWORD} ${process.env.SEED_PASSWORD ? "(from SEED_PASSWORD env var)" : "(randomly generated — set SEED_PASSWORD to choose your own)"}`);
  console.log("  Super Admin : superadmin");
  console.log("  HR          : priya.nair");
  console.log("  Finance     : finance@emoenergy.in");
  console.log("  CEO         : ceo@emoenergy.in");
  console.log("  Employee    : sneha.patel");
}
