import { db } from "./db";
import { eq, and, desc, sql, gte, lte, like, or, isNull, asc } from "drizzle-orm";
import {
  users, employees, departments, designations,
  salaryStructures, attendanceRecords, regularizationRequests,
  leaveTypes, leaveBalances, leaveLedger, leaveRequests,
  holidays, payrollRuns, payslips, statutoryConfig,
  documents, announcements, assets, auditLogs,
  ratingScales, performanceCycles, goals, goalProgressUpdates, reviews, calibrationSessions,
  notifications, shifts, shiftAssignments, employmentHistory,
  onboardingTemplates, onboardingTasks, onboardingInstances, onboardingTaskItems,
  movementLocations, logisticsMovements, movementEvents, logisticsRequests,
  companyVehicles, vehicleBookings, reimbursements, officePurchases, procurementRequests, tripRequests,
  zohoConfig, zohoSyncJobs, requests as requestsTable, requestComments,
  ceoApprovalNotes, referenceDocs,

  approvalWorkflows, approvalSteps, approvalRequests, approvalDecisions,
  recruitmentAgencies, pipelineStages, jobRequisitions, candidates, applications, applicationTimeline, candidateDocRequests,
  interviews, interviewFeedback, offers, vendors, purchaseRequests, travelRequests, travelBookings,
  workspacePayments, adminTickets, adminTicketComments, hrTasks,
  type User, type InsertUser, type Employee, type InsertEmployee,
  type Department, type InsertDepartment, type Designation, type InsertDesignation,
  type SalaryStructure, type InsertSalaryStructure,
  type AttendanceRecord, type InsertAttendance,
  type RegularizationRequest, type InsertRegularization,
  type LeaveType, type InsertLeaveType,
  type LeaveBalance, type InsertLeaveBalance,
  type LeaveLedgerEntry, type InsertLeaveLedger,
  type LeaveRequest, type InsertLeaveRequest,
  type Holiday, type InsertHoliday,
  type PayrollRun, type InsertPayrollRun,
  type Payslip, type InsertPayslip,
  type Announcement, type InsertAnnouncement,
  type Asset, type InsertAsset,
  type AuditLog,
  type RatingScale, type InsertRatingScale,
  type PerformanceCycle, type InsertPerformanceCycle,
  type Goal, type InsertGoal,
  type GoalProgressUpdate, type InsertGoalProgress,
  type Review, type InsertReview,
  type CalibrationSession, type InsertCalibration,
  type InsertNotification, type InsertShift, type InsertShiftAssignment,
  type InsertEmploymentHistory, type InsertOnboardingTemplate, type InsertOnboardingTask,
  type InsertOnboardingInstance, type InsertOnboardingTaskItem,
} from "@shared/schema";

// Default annual leave balances granted to every employee (by leave-type code).
// Casual Leave (CL) is the headline default of 12 days.
export const DEFAULT_LEAVE_BALANCES: Record<string, number> = {
  CL: 12, SL: 8, EL: 15, ML: 0, PL: 0, CO: 3, LOP: 0,
};

// Short, year-less reference codes, e.g. LR-4Q7X. Uses an unambiguous alphabet (no 0/O/1/I)
// and retries against the table so codes stay unique.
const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function shortRefCode(len = 4) {
  let s = "";
  for (let i = 0; i < len; i++) s += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)];
  return s;
}
async function genRef(prefix: string, table: any): Promise<string> {
  for (let i = 0; i < 25; i++) {
    const ref = `${prefix}-${shortRefCode(4)}`;
    const hit = await db.select({ id: table.id }).from(table).where(eq(table.reference, ref)).limit(1);
    if (!hit.length) return ref;
  }
  return `${prefix}-${shortRefCode(6)}`; // extremely unlikely fallback
}

export const storage = {
  // ====== USERS ======
  async getUser(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  },

  async getUserByUsername(username: string) {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  },

  async getUserByUsernameOrEmail(identifier: string) {
    const normalised = identifier.trim().toLowerCase();
    const [byUsername] = await db.select().from(users).where(eq(users.username, normalised));
    if (byUsername) return byUsername;
    const [byEmail] = await db.select().from(users).where(eq(users.username, normalised));
    if (byEmail) return byEmail;
    const allUsers = await db.select().from(users);
    return allUsers.find(u => u.username === normalised || u.username + "@emoenergy.in" === normalised) ?? null;
  },

  async createUser(data: InsertUser) {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  },

  async updateUser(id: string, data: Partial<InsertUser>) {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  },

  async getAllUsers() {
    return db.select().from(users).orderBy(users.createdAt);
  },

  async getUserByInviteToken(token: string) {
    const [user] = await db.select().from(users).where(eq(users.inviteToken, token));
    return user;
  },

  async getUserByResetToken(token: string) {
    const [user] = await db.select().from(users).where(eq(users.resetToken, token));
    return user;
  },

  // ====== DEPARTMENTS ======
  async getDepartments() {
    return db.select().from(departments).orderBy(departments.name);
  },

  async getDepartment(id: string) {
    const [dept] = await db.select().from(departments).where(eq(departments.id, id));
    return dept;
  },

  async createDepartment(data: InsertDepartment) {
    const [dept] = await db.insert(departments).values(data).returning();
    return dept;
  },

  async updateDepartment(id: string, data: Partial<InsertDepartment>) {
    const [dept] = await db.update(departments).set(data).where(eq(departments.id, id)).returning();
    return dept;
  },

  async deleteDepartment(id: string) {
    await db.delete(departments).where(eq(departments.id, id));
  },

  async countEmployeesInDepartment(id: string) {
    const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(employees).where(eq(employees.departmentId, id));
    return r?.n ?? 0;
  },

  async countDesignationsInDepartment(id: string) {
    const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(designations).where(eq(designations.departmentId, id));
    return r?.n ?? 0;
  },

  // ====== DESIGNATIONS ======
  async getDesignations() {
    return db.select().from(designations).orderBy(designations.name);
  },

  async createDesignation(data: InsertDesignation) {
    const [d] = await db.insert(designations).values(data).returning();
    return d;
  },

  async deleteDesignation(id: string) {
    await db.delete(designations).where(eq(designations.id, id));
  },

  async countEmployeesWithDesignation(id: string) {
    const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(employees).where(eq(employees.designationId, id));
    return r?.n ?? 0;
  },

  // ====== EMPLOYEES ======
  async getEmployees(filters?: { status?: string; departmentId?: string; search?: string }) {
    let query = db.select().from(employees);
    const conditions = [];
    if (filters?.status) conditions.push(eq(employees.employmentStatus, filters.status as any));
    if (filters?.departmentId) conditions.push(eq(employees.departmentId, filters.departmentId));
    if (filters?.search) {
      conditions.push(
        or(
          like(employees.firstName, `%${filters.search}%`),
          like(employees.lastName, `%${filters.search}%`),
          like(employees.email, `%${filters.search}%`),
          like(employees.employeeCode, `%${filters.search}%`),
        )
      );
    }
    if (conditions.length) {
      return db.select().from(employees).where(and(...conditions)).orderBy(employees.firstName);
    }
    return db.select().from(employees).orderBy(employees.firstName);
  },

  async getEmployee(id: string) {
    const [emp] = await db.select().from(employees).where(eq(employees.id, id));
    return emp;
  },

  async getEmployeeByCode(code: string) {
    const [emp] = await db.select().from(employees).where(eq(employees.employeeCode, code));
    return emp;
  },

  async createEmployee(data: InsertEmployee) {
    const [emp] = await db.insert(employees).values(data).returning();
    return emp;
  },

  async updateEmployee(id: string, data: Partial<InsertEmployee>) {
    const [emp] = await db.update(employees).set({ ...data, updatedAt: new Date() }).where(eq(employees.id, id)).returning();
    return emp;
  },

  async getNextEmployeeCode() {
    const result = await db.select({ max: sql<string>`MAX(employee_code)` }).from(employees);
    const max = result[0]?.max;
    if (!max) return "EMO001";
    const num = parseInt(max.replace("EMO", "")) + 1;
    return `EMO${String(num).padStart(3, "0")}`;
  },

  // ====== SALARY STRUCTURES ======
  async getSalaryStructures(employeeId: string) {
    return db.select().from(salaryStructures)
      .where(eq(salaryStructures.employeeId, employeeId))
      .orderBy(desc(salaryStructures.effectiveFrom));
  },

  async getCurrentSalaryStructure(employeeId: string, asOfDate?: string) {
    const date = asOfDate || new Date().toISOString().split("T")[0];
    const [s] = await db.select().from(salaryStructures)
      .where(and(
        eq(salaryStructures.employeeId, employeeId),
        lte(salaryStructures.effectiveFrom, date),
        or(isNull(salaryStructures.effectiveTo), gte(salaryStructures.effectiveTo, date))
      ))
      .orderBy(desc(salaryStructures.effectiveFrom))
      .limit(1);
    return s;
  },

  async createSalaryStructure(data: InsertSalaryStructure) {
    const [s] = await db.insert(salaryStructures).values(data).returning();
    return s;
  },

  // ====== ATTENDANCE ======
  async getAttendanceRecords(employeeId: string, month: number, year: number) {
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
    return db.select().from(attendanceRecords)
      .where(and(
        eq(attendanceRecords.employeeId, employeeId),
        gte(attendanceRecords.date, startDate),
        lte(attendanceRecords.date, endDate),
      ))
      .orderBy(attendanceRecords.date);
  },

  // All attendance records for a month (across employees) — for org-wide summaries
  async getMonthlyAttendance(month: number, year: number) {
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    // Real last day of the month — a hardcoded "-31" produces an invalid date (e.g. 2026-09-31)
    // for 30-day / February months and makes Postgres reject the query.
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return db.select().from(attendanceRecords)
      .where(and(
        gte(attendanceRecords.date, startDate),
        lte(attendanceRecords.date, endDate),
      ));
  },

  // All attendance records within a date range (across employees)
  async getAttendanceInRange(from: string, to: string) {
    return db.select().from(attendanceRecords)
      .where(and(gte(attendanceRecords.date, from), lte(attendanceRecords.date, to)));
  },

  async getAttendanceByDate(employeeId: string, date: string) {
    const [rec] = await db.select().from(attendanceRecords)
      .where(and(eq(attendanceRecords.employeeId, employeeId), eq(attendanceRecords.date, date)));
    return rec;
  },

  async upsertAttendance(data: InsertAttendance) {
    const existing = await this.getAttendanceByDate(data.employeeId!, data.date!);
    if (existing) {
      const [rec] = await db.update(attendanceRecords)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(attendanceRecords.id, existing.id))
        .returning();
      return rec;
    }
    const [rec] = await db.insert(attendanceRecords).values(data).returning();
    return rec;
  },

  async deleteAttendanceByDate(employeeId: string, date: string) {
    await db.delete(attendanceRecords).where(and(eq(attendanceRecords.employeeId, employeeId), eq(attendanceRecords.date, date)));
  },

  async getTeamAttendance(managerEmployeeId: string, month: number, year: number) {
    const teamMembers = await db.select().from(employees).where(eq(employees.managerId, managerEmployeeId));
    const results = [];
    for (const emp of teamMembers) {
      const records = await this.getAttendanceRecords(emp.id, month, year);
      results.push({ employee: emp, records });
    }
    return results;
  },

  async getAllAttendanceForMonth(month: number, year: number) {
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
    return db.select().from(attendanceRecords)
      .where(and(gte(attendanceRecords.date, startDate), lte(attendanceRecords.date, endDate)));
  },

  // ====== REGULARIZATION ======
  async getRegularizationRequests(employeeId?: string, status?: string) {
    const conditions = [];
    if (employeeId) conditions.push(eq(regularizationRequests.employeeId, employeeId));
    if (status) conditions.push(eq(regularizationRequests.status, status as any));
    return db.select().from(regularizationRequests)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(regularizationRequests.createdAt));
  },

  async createRegularizationRequest(data: InsertRegularization) {
    const [req] = await db.insert(regularizationRequests).values(data).returning();
    return req;
  },

  async updateRegularizationRequest(id: string, data: Partial<InsertRegularization>) {
    const [req] = await db.update(regularizationRequests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(regularizationRequests.id, id))
      .returning();
    return req;
  },

  // ====== LEAVE TYPES ======
  async getLeaveTypes() {
    return db.select().from(leaveTypes).where(eq(leaveTypes.isActive, true)).orderBy(leaveTypes.name);
  },

  async createLeaveType(data: InsertLeaveType) {
    const [lt] = await db.insert(leaveTypes).values(data).returning();
    return lt;
  },

  async updateLeaveType(id: string, data: Partial<InsertLeaveType>) {
    const [lt] = await db.update(leaveTypes).set(data).where(eq(leaveTypes.id, id)).returning();
    return lt;
  },

  async deleteLeaveType(id: string) {
    // Soft-delete: balances & requests reference this type, so we deactivate
    // (getLeaveTypes already filters to active) rather than orphaning history.
    const [lt] = await db.update(leaveTypes).set({ isActive: false }).where(eq(leaveTypes.id, id)).returning();
    return lt;
  },

  // ====== LEAVE BALANCES ======
  async getLeaveBalances(employeeId: string, year: number) {
    return db.select().from(leaveBalances)
      .where(and(eq(leaveBalances.employeeId, employeeId), eq(leaveBalances.year, year)));
  },

  async getLeaveBalance(employeeId: string, leaveTypeId: string, year: number) {
    const [bal] = await db.select().from(leaveBalances)
      .where(and(
        eq(leaveBalances.employeeId, employeeId),
        eq(leaveBalances.leaveTypeId, leaveTypeId),
        eq(leaveBalances.year, year),
      ));
    return bal;
  },

  async upsertLeaveBalance(data: InsertLeaveBalance) {
    const existing = await this.getLeaveBalance(data.employeeId!, data.leaveTypeId!, data.year!);
    if (existing) {
      const [bal] = await db.update(leaveBalances)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(leaveBalances.id, existing.id))
        .returning();
      return bal;
    }
    const [bal] = await db.insert(leaveBalances).values(data).returning();
    return bal;
  },

  // Grant the default annual leave balances to an employee for a given year.
  // Only creates balances that don't already exist (won't overwrite adjustments).
  async applyDefaultLeaveBalances(employeeId: string, year: number) {
    const types = await this.getLeaveTypes();
    for (const lt of types) {
      const def = DEFAULT_LEAVE_BALANCES[lt.code] ?? 0;
      if (def <= 0) continue;
      const existing = await this.getLeaveBalance(employeeId, lt.id, year);
      if (existing) continue;
      await this.upsertLeaveBalance({
        employeeId, leaveTypeId: lt.id, year,
        openingBalance: "0", accrued: String(def), taken: "0", adjusted: "0", closingBalance: String(def),
      });
    }
  },

  // ====== LEAVE LEDGER ======
  async getLeaveLedger(employeeId: string, leaveTypeId?: string) {
    const conditions = [eq(leaveLedger.employeeId, employeeId)];
    if (leaveTypeId) conditions.push(eq(leaveLedger.leaveTypeId, leaveTypeId));
    return db.select().from(leaveLedger).where(and(...conditions)).orderBy(desc(leaveLedger.createdAt));
  },

  async addLeaveLedgerEntry(data: InsertLeaveLedger) {
    const [entry] = await db.insert(leaveLedger).values(data).returning();
    return entry;
  },

  // ====== LEAVE REQUESTS ======
  async getLeaveRequests(employeeId?: string, status?: string) {
    const conditions = [];
    if (employeeId) conditions.push(eq(leaveRequests.employeeId, employeeId));
    if (status) conditions.push(eq(leaveRequests.status, status as any));
    return db.select().from(leaveRequests)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(leaveRequests.createdAt));
  },

  async getLeaveRequest(id: string) {
    const [req] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
    return req;
  },

  // Approved leave requests that overlap [from, to] (optionally for one employee).
  // Used to overlay leave days onto the attendance calendar so the two modules stay in sync.
  async getApprovedLeavesInRange(from: string, to: string, employeeId?: string) {
    const conds = [eq(leaveRequests.status, "approved" as any), lte(leaveRequests.startDate, to), gte(leaveRequests.endDate, from)];
    if (employeeId) conds.push(eq(leaveRequests.employeeId, employeeId));
    return db.select().from(leaveRequests).where(and(...conds));
  },

  // Is there enough balance to approve this leave? Unpaid types are always allowed.
  async isLeaveBalanceSufficient(lr: any): Promise<boolean> {
    const lt = (await this.getLeaveTypes()).find((t) => t.id === lr.leaveTypeId);
    if (!lt?.isPaid) return true;
    const year = new Date(lr.startDate).getFullYear();
    const bal = await this.getLeaveBalance(lr.employeeId, lr.leaveTypeId, year);
    return parseFloat(bal?.closingBalance?.toString() || "0") >= parseFloat(lr.totalDays.toString());
  },

  // Deduct a leave's days from the balance + write the ledger debit (shared by manual approve,
  // auto-approve-on-create, and the cron). Returns the new closing balance.
  async deductLeaveOnApproval(lr: any, createdBy?: string): Promise<number> {
    const year = new Date(lr.startDate).getFullYear();
    const bal = await this.getLeaveBalance(lr.employeeId, lr.leaveTypeId, year);
    const days = parseFloat(lr.totalDays.toString());
    const newBalance = parseFloat(bal?.closingBalance?.toString() || "0") - days;
    await this.upsertLeaveBalance({
      employeeId: lr.employeeId, leaveTypeId: lr.leaveTypeId, year,
      openingBalance: bal?.openingBalance?.toString() || "0",
      accrued: bal?.accrued?.toString() || "0",
      taken: String(parseFloat(bal?.taken?.toString() || "0") + days),
      adjusted: bal?.adjusted?.toString() || "0",
      closingBalance: String(newBalance),
    } as any);
    await this.addLeaveLedgerEntry({ employeeId: lr.employeeId, leaveTypeId: lr.leaveTypeId, transactionType: "debit", days: lr.totalDays.toString(), balanceAfter: String(newBalance), referenceId: lr.id, notes: `Leave ${lr.id} approved`, createdBy } as any);
    return newBalance;
  },

  // WFH attendance records (approval state lives in notes) within a date range — for the
  // manager's pending-approval list.
  async getWfhInRange(from: string, to: string) {
    return db.select().from(attendanceRecords)
      .where(and(eq(attendanceRecords.status, "wfh" as any), gte(attendanceRecords.date, from), lte(attendanceRecords.date, to)));
  },

  async createLeaveRequest(data: InsertLeaveRequest) {
    const [req] = await db.insert(leaveRequests).values(data).returning();
    return req;
  },

  async updateLeaveRequest(id: string, data: Partial<InsertLeaveRequest>) {
    const [req] = await db.update(leaveRequests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(leaveRequests.id, id))
      .returning();
    return req;
  },

  async getTeamLeaveRequests(managerEmployeeId: string) {
    const teamMembers = await db.select().from(employees).where(eq(employees.managerId, managerEmployeeId));
    const empIds = teamMembers.map(e => e.id);
    if (!empIds.length) return [];
    const results = [];
    for (const empId of empIds) {
      const reqs = await this.getLeaveRequests(empId);
      results.push(...reqs);
    }
    return results;
  },

  // ====== HOLIDAYS ======
  async getHolidays(year: number, location?: string) {
    const conditions = [eq(holidays.year, year)];
    if (location && location !== "all") {
      conditions.push(or(eq(holidays.location, location), eq(holidays.location, "all"))!);
    }
    return db.select().from(holidays)
      .where(and(...conditions))
      .orderBy(holidays.date);
  },

  async createHoliday(data: InsertHoliday) {
    const [h] = await db.insert(holidays).values(data).returning();
    return h;
  },

  async updateHoliday(id: string, data: Partial<InsertHoliday>) {
    const [h] = await db.update(holidays).set(data).where(eq(holidays.id, id)).returning();
    return h;
  },

  async deleteHoliday(id: string) {
    await db.delete(holidays).where(eq(holidays.id, id));
  },

  // ====== PAYROLL ======
  async getPayrollRuns() {
    return db.select().from(payrollRuns).orderBy(desc(payrollRuns.year), desc(payrollRuns.month));
  },

  async getPayrollRun(id: string) {
    const [run] = await db.select().from(payrollRuns).where(eq(payrollRuns.id, id));
    return run;
  },

  async getPayrollRunByMonth(month: number, year: number) {
    const [run] = await db.select().from(payrollRuns)
      .where(and(eq(payrollRuns.month, month), eq(payrollRuns.year, year)));
    return run;
  },

  async createPayrollRun(data: InsertPayrollRun) {
    const [run] = await db.insert(payrollRuns).values(data).returning();
    return run;
  },

  async updatePayrollRun(id: string, data: Partial<typeof payrollRuns.$inferInsert>) {
    const [run] = await db.update(payrollRuns)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(payrollRuns.id, id))
      .returning();
    return run;
  },

  async getPayslips(payrollRunId: string) {
    return db.select().from(payslips).where(eq(payslips.payrollRunId, payrollRunId));
  },

  async getEmployeePayslips(employeeId: string) {
    return db.select().from(payslips)
      .where(eq(payslips.employeeId, employeeId))
      .orderBy(desc(payslips.year), desc(payslips.month));
  },

  async getPayslip(id: string) {
    const [slip] = await db.select().from(payslips).where(eq(payslips.id, id));
    return slip;
  },

  async createPayslip(data: InsertPayslip) {
    const [slip] = await db.insert(payslips).values(data).returning();
    return slip;
  },

  async updatePayslip(id: string, data: Partial<InsertPayslip>) {
    const [slip] = await db.update(payslips)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(payslips.id, id))
      .returning();
    return slip;
  },

  async deletePayslipsByRunId(payrollRunId: string) {
    await db.delete(payslips).where(eq(payslips.payrollRunId, payrollRunId));
  },

  // ====== STATUTORY CONFIG ======
  async getStatutoryConfig() {
    return db.select().from(statutoryConfig);
  },

  async getStatutoryValue(key: string) {
    const [cfg] = await db.select().from(statutoryConfig).where(eq(statutoryConfig.key, key));
    return cfg?.value;
  },

  async setStatutoryConfig(key: string, value: string, description?: string) {
    const existing = await db.select().from(statutoryConfig).where(eq(statutoryConfig.key, key));
    if (existing.length) {
      await db.update(statutoryConfig).set({ value, updatedAt: new Date() }).where(eq(statutoryConfig.key, key));
    } else {
      await db.insert(statutoryConfig).values({ key, value, description });
    }
  },

  // ====== ANNOUNCEMENTS ======
  async getAnnouncements() {
    return db.select().from(announcements).where(eq(announcements.isActive, true)).orderBy(desc(announcements.createdAt));
  },

  async createAnnouncement(data: InsertAnnouncement) {
    const [a] = await db.insert(announcements).values(data).returning();
    return a;
  },

  async updateAnnouncement(id: string, data: Partial<InsertAnnouncement>) {
    const [a] = await db.update(announcements).set(data).where(eq(announcements.id, id)).returning();
    return a;
  },

  async deleteAnnouncement(id: string) {
    await db.delete(announcements).where(eq(announcements.id, id));
  },

  // ====== ASSETS ======
  async getAssets(employeeId?: string) {
    if (employeeId) {
      return db.select().from(assets).where(eq(assets.assignedTo, employeeId)).orderBy(assets.name);
    }
    return db.select().from(assets).orderBy(assets.name);
  },

  async createAsset(data: InsertAsset) {
    const [a] = await db.insert(assets).values(data).returning();
    return a;
  },

  async updateAsset(id: string, data: Partial<InsertAsset>) {
    const [a] = await db.update(assets).set(data).where(eq(assets.id, id)).returning();
    return a;
  },

  async deleteAsset(id: string) {
    await db.delete(assets).where(eq(assets.id, id));
  },

  // ====== NOTIFICATIONS ======
  async createNotification(data: InsertNotification) {
    const [n] = await db.insert(notifications).values(data).returning();
    return n;
  },

  // Convenience fan-out helpers (all best-effort; callers wrap in try/catch)
  async notifyUser(userId: string | null | undefined, payload: { type: string; title: string; body?: string; link?: string }) {
    if (!userId) return;
    await db.insert(notifications).values({ userId, ...payload });
  },
  async notifyByRole(roles: string[], payload: { type: string; title: string; body?: string; link?: string }) {
    const us = (await db.select().from(users)).filter((u: any) => roles.includes(u.role) && u.isActive);
    for (const u of us) await db.insert(notifications).values({ userId: u.id, ...payload });
  },
  async notifyEmployee(employeeId: string | null | undefined, payload: { type: string; title: string; body?: string; link?: string }) {
    if (!employeeId) return;
    const [u] = await db.select().from(users).where(eq(users.employeeId, employeeId));
    if (u) await db.insert(notifications).values({ userId: u.id, ...payload });
  },

  async getUserNotifications(userId: string, limit = 30) {
    return db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  },

  async markNotificationRead(id: string, userId: string) {
    const [n] = await db.update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    return n;
  },

  async markAllNotificationsRead(userId: string) {
    await db.update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  },

  async getUnreadNotificationCount(userId: string) {
    const [r] = await db.select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return Number(r?.count ?? 0);
  },

  // ====== SHIFTS ======
  async getShifts() {
    return db.select().from(shifts).orderBy(asc(shifts.name));
  },

  async getShift(id: string) {
    const [s] = await db.select().from(shifts).where(eq(shifts.id, id));
    return s;
  },

  async createShift(data: InsertShift) {
    const [s] = await db.insert(shifts).values(data).returning();
    return s;
  },

  async updateShift(id: string, data: Partial<InsertShift>) {
    const [s] = await db.update(shifts).set(data).where(eq(shifts.id, id)).returning();
    return s;
  },

  async deleteShift(id: string) {
    await db.delete(shifts).where(eq(shifts.id, id));
  },

  async getShiftAssignments(employeeId?: string) {
    if (employeeId) {
      return db.select().from(shiftAssignments)
        .where(eq(shiftAssignments.employeeId, employeeId))
        .orderBy(desc(shiftAssignments.effectiveFrom));
    }
    return db.select().from(shiftAssignments).orderBy(desc(shiftAssignments.effectiveFrom));
  },

  async createShiftAssignment(data: InsertShiftAssignment) {
    const [a] = await db.insert(shiftAssignments).values(data).returning();
    return a;
  },

  async deleteShiftAssignment(id: string) {
    await db.delete(shiftAssignments).where(eq(shiftAssignments.id, id));
  },

  async getEmployeeShiftForDate(employeeId: string, date: string) {
    const assignments = await db.select().from(shiftAssignments)
      .where(and(
        eq(shiftAssignments.employeeId, employeeId),
        lte(shiftAssignments.effectiveFrom, date),
        or(isNull(shiftAssignments.effectiveTo), gte(shiftAssignments.effectiveTo, date))
      ))
      .orderBy(desc(shiftAssignments.effectiveFrom))
      .limit(1);
    if (!assignments.length) return null;
    const [shift] = await db.select().from(shifts).where(eq(shifts.id, assignments[0].shiftId));
    return shift || null;
  },

  // ====== EMPLOYMENT HISTORY ======
  async getEmploymentHistory(employeeId: string) {
    return db.select().from(employmentHistory)
      .where(eq(employmentHistory.employeeId, employeeId))
      .orderBy(desc(employmentHistory.createdAt));
  },

  async addEmploymentHistory(data: InsertEmploymentHistory) {
    const [h] = await db.insert(employmentHistory).values(data).returning();
    return h;
  },

  // ====== ONBOARDING ======
  async getOnboardingTemplates() {
    return db.select().from(onboardingTemplates).orderBy(asc(onboardingTemplates.name));
  },

  async getOnboardingTemplate(id: string) {
    const [t] = await db.select().from(onboardingTemplates).where(eq(onboardingTemplates.id, id));
    return t;
  },

  async getDefaultOnboardingTemplate() {
    const [t] = await db.select().from(onboardingTemplates).where(eq(onboardingTemplates.isDefault, true));
    return t || null;
  },

  async createOnboardingTemplate(data: InsertOnboardingTemplate) {
    const [t] = await db.insert(onboardingTemplates).values(data).returning();
    return t;
  },

  async updateOnboardingTemplate(id: string, data: Partial<InsertOnboardingTemplate>) {
    const [t] = await db.update(onboardingTemplates).set(data).where(eq(onboardingTemplates.id, id)).returning();
    return t;
  },

  async getOnboardingTasks(templateId: string) {
    return db.select().from(onboardingTasks)
      .where(eq(onboardingTasks.templateId, templateId))
      .orderBy(asc(onboardingTasks.sortOrder));
  },

  async createOnboardingTask(data: InsertOnboardingTask) {
    const [t] = await db.insert(onboardingTasks).values(data).returning();
    return t;
  },

  async updateOnboardingTask(id: string, data: Partial<InsertOnboardingTask>) {
    const [t] = await db.update(onboardingTasks).set(data).where(eq(onboardingTasks.id, id)).returning();
    return t;
  },

  async deleteOnboardingTask(id: string) {
    await db.delete(onboardingTasks).where(eq(onboardingTasks.id, id));
  },

  async getOnboardingInstances(employeeId?: string) {
    if (employeeId) {
      return db.select().from(onboardingInstances)
        .where(eq(onboardingInstances.employeeId, employeeId))
        .orderBy(desc(onboardingInstances.startedAt));
    }
    return db.select().from(onboardingInstances).orderBy(desc(onboardingInstances.startedAt));
  },

  async createOnboardingInstance(data: InsertOnboardingInstance) {
    const [i] = await db.insert(onboardingInstances).values(data).returning();
    return i;
  },

  async getOnboardingTaskItems(instanceId: string) {
    return db.select().from(onboardingTaskItems)
      .where(eq(onboardingTaskItems.instanceId, instanceId))
      .orderBy(asc(onboardingTaskItems.createdAt));
  },

  async updateOnboardingTaskItem(id: string, data: Partial<InsertOnboardingTaskItem>) {
    const [i] = await db.update(onboardingTaskItems).set(data).where(eq(onboardingTaskItems.id, id)).returning();
    return i;
  },

  // ====== AUDIT LOGS ======
  async addAuditLog(data: {
    userId?: string;
    employeeId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    oldValue?: any;
    newValue?: any;
    reason?: string;
    ipAddress?: string;
  }) {
    const [log] = await db.insert(auditLogs).values(data).returning();
    return log;
  },

  async getAuditLogs(entityType?: string, entityId?: string, limit = 50) {
    const conditions = [];
    if (entityType) conditions.push(eq(auditLogs.entityType, entityType));
    if (entityId) conditions.push(eq(auditLogs.entityId, entityId));
    return db.select().from(auditLogs)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  },

  // ====== PERFORMANCE: RATING SCALES ======
  async getRatingScales() {
    return db.select().from(ratingScales).orderBy(desc(ratingScales.createdAt));
  },

  async getRatingScale(id: string) {
    const [s] = await db.select().from(ratingScales).where(eq(ratingScales.id, id));
    return s;
  },

  async createRatingScale(data: InsertRatingScale) {
    const [s] = await db.insert(ratingScales).values(data).returning();
    return s;
  },

  async updateRatingScale(id: string, data: Partial<InsertRatingScale>) {
    const [s] = await db.update(ratingScales).set(data).where(eq(ratingScales.id, id)).returning();
    return s;
  },

  // ====== PERFORMANCE: CYCLES ======
  async getPerformanceCycles() {
    return db.select().from(performanceCycles).orderBy(desc(performanceCycles.createdAt));
  },

  async getPerformanceCycle(id: string) {
    const [c] = await db.select().from(performanceCycles).where(eq(performanceCycles.id, id));
    return c;
  },

  async createPerformanceCycle(data: InsertPerformanceCycle) {
    const [c] = await db.insert(performanceCycles).values(data).returning();
    return c;
  },

  async updatePerformanceCycle(id: string, data: Partial<InsertPerformanceCycle>) {
    const [c] = await db.update(performanceCycles).set({ ...data, updatedAt: new Date() }).where(eq(performanceCycles.id, id)).returning();
    return c;
  },

  // ====== PERFORMANCE: GOALS ======
  async getGoals(cycleId?: string, employeeId?: string) {
    const conditions = [];
    if (cycleId) conditions.push(eq(goals.cycleId, cycleId));
    if (employeeId) conditions.push(eq(goals.employeeId, employeeId));
    return db.select().from(goals)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(goals.createdAt));
  },

  async getGoal(id: string) {
    const [g] = await db.select().from(goals).where(eq(goals.id, id));
    return g;
  },

  async createGoal(data: InsertGoal) {
    const [g] = await db.insert(goals).values(data).returning();
    return g;
  },

  async updateGoal(id: string, data: Partial<InsertGoal & { approvedAt?: Date }>) {
    const [g] = await db.update(goals).set({ ...data, updatedAt: new Date() }).where(eq(goals.id, id)).returning();
    return g;
  },

  async deleteGoal(id: string) {
    await db.delete(goals).where(eq(goals.id, id));
  },

  async getGoalProgressUpdates(goalId: string) {
    return db.select().from(goalProgressUpdates)
      .where(eq(goalProgressUpdates.goalId, goalId))
      .orderBy(desc(goalProgressUpdates.createdAt));
  },

  async addGoalProgress(data: InsertGoalProgress) {
    const [p] = await db.insert(goalProgressUpdates).values(data).returning();
    return p;
  },

  // ====== PERFORMANCE: REVIEWS ======
  async getReview(cycleId: string, employeeId: string) {
    const [r] = await db.select().from(reviews)
      .where(and(eq(reviews.cycleId, cycleId), eq(reviews.employeeId, employeeId)));
    return r;
  },

  async getReviewsByCycle(cycleId: string) {
    return db.select().from(reviews).where(eq(reviews.cycleId, cycleId));
  },

  async upsertReview(cycleId: string, employeeId: string, data: Partial<InsertReview>) {
    const existing = await this.getReview(cycleId, employeeId);
    if (existing) {
      const newVersion = existing.version + 1;
      const revisions = (existing.revisions as any[] || []);
      revisions.push({ version: existing.version, snapshot: { selfReview: existing.selfReview, managerReview: existing.managerReview, status: existing.status }, at: new Date() });
      const [r] = await db.update(reviews)
        .set({ ...data, version: newVersion, revisions, updatedAt: new Date() })
        .where(eq(reviews.id, existing.id))
        .returning();
      return r;
    }
    const [r] = await db.insert(reviews).values({ cycleId, employeeId, ...data }).returning();
    return r;
  },

  // ====== PERFORMANCE: CALIBRATION ======
  async getCalibrationSessions(cycleId: string) {
    return db.select().from(calibrationSessions).where(eq(calibrationSessions.cycleId, cycleId));
  },

  async getCalibrationSession(id: string) {
    const [s] = await db.select().from(calibrationSessions).where(eq(calibrationSessions.id, id));
    return s;
  },

  async createCalibrationSession(data: InsertCalibration) {
    const [s] = await db.insert(calibrationSessions).values(data).returning();
    return s;
  },

  async updateCalibrationSession(id: string, data: Partial<InsertCalibration & { lockedAt?: Date; lockedBy?: string }>) {
    const [s] = await db.update(calibrationSessions).set({ ...data, updatedAt: new Date() }).where(eq(calibrationSessions.id, id)).returning();
    return s;
  },

  // ====== APPROVAL ENGINE ======
  async getDefaultWorkflow(entityType: string) {
    const [wf] = await db.select().from(approvalWorkflows).where(and(eq(approvalWorkflows.entityType, entityType), eq(approvalWorkflows.isActive, true))).limit(1);
    return wf;
  },

  async createApprovalRequest(data: { entityType: string; entityId: string; workflowId?: string; createdBy: string }) {
    const [req] = await db.insert(approvalRequests).values({ ...data, status: "pending", currentStepOrder: 1 }).returning();
    return req;
  },

  async getApprovalRequest(id: string) {
    const [req] = await db.select().from(approvalRequests).where(eq(approvalRequests.id, id));
    return req;
  },

  async getApprovalRequestByEntity(entityType: string, entityId: string) {
    const reqs = await db.select().from(approvalRequests)
      .where(and(eq(approvalRequests.entityType, entityType), eq(approvalRequests.entityId, entityId)))
      .orderBy(desc(approvalRequests.createdAt));
    return reqs[0];
  },

  async getPendingApprovals(entityType?: string) {
    const conds: any[] = [eq(approvalRequests.status, "pending")];
    if (entityType) conds.push(eq(approvalRequests.entityType, entityType));
    return db.select().from(approvalRequests).where(and(...conds)).orderBy(desc(approvalRequests.createdAt));
  },

  async updateApprovalRequest(id: string, data: Partial<{ status: string; resolvedAt: Date; currentStepOrder: number }>) {
    const [req] = await db.update(approvalRequests).set(data).where(eq(approvalRequests.id, id)).returning();
    return req;
  },

  async createApprovalDecision(data: { approvalRequestId: string; stepOrder?: number; actorUserId: string; decision: string; comment?: string }) {
    const [dec] = await db.insert(approvalDecisions).values({ stepOrder: 1, ...data }).returning();
    return dec;
  },

  async getApprovalDecisions(approvalRequestId: string) {
    return db.select().from(approvalDecisions).where(eq(approvalDecisions.approvalRequestId, approvalRequestId)).orderBy(approvalDecisions.decidedAt);
  },

  // ====== RECRUITMENT AGENCIES ======
  async getRecruitmentAgencies() {
    return db.select().from(recruitmentAgencies).orderBy(recruitmentAgencies.name);
  },
  async createRecruitmentAgency(data: any) {
    const [a] = await db.insert(recruitmentAgencies).values(data).returning();
    return a;
  },
  async updateRecruitmentAgency(id: string, data: any) {
    const [a] = await db.update(recruitmentAgencies).set(data).where(eq(recruitmentAgencies.id, id)).returning();
    return a;
  },

  // ====== PIPELINE STAGES ======
  async getPipelineStages() {
    return db.select().from(pipelineStages).where(eq(pipelineStages.isActive, true)).orderBy(pipelineStages.stageOrder);
  },

  // ====== JOB REQUISITIONS ======
  async getJobRequisitions(status?: string) {
    if (status) return db.select().from(jobRequisitions).where(eq(jobRequisitions.status, status)).orderBy(desc(jobRequisitions.createdAt));
    return db.select().from(jobRequisitions).orderBy(desc(jobRequisitions.createdAt));
  },
  async getJobRequisition(id: string) {
    const [r] = await db.select().from(jobRequisitions).where(eq(jobRequisitions.id, id));
    return r;
  },
  async createJobRequisition(data: any) {
    const [r] = await db.insert(jobRequisitions).values(data).returning();
    return r;
  },
  async updateJobRequisition(id: string, data: any) {
    const [r] = await db.update(jobRequisitions).set({ ...data, updatedAt: new Date() }).where(eq(jobRequisitions.id, id)).returning();
    return r;
  },

  // ====== CANDIDATES ======
  async getCandidates(search?: string) {
    if (search) {
      return db.select().from(candidates).where(or(like(candidates.name, `%${search}%`), like(candidates.email, `%${search}%`))).orderBy(desc(candidates.createdAt));
    }
    return db.select().from(candidates).orderBy(desc(candidates.createdAt));
  },
  async getCandidate(id: string) {
    const [c] = await db.select().from(candidates).where(eq(candidates.id, id));
    return c;
  },
  async createCandidate(data: any) {
    const [c] = await db.insert(candidates).values(data).returning();
    return c;
  },
  async updateCandidate(id: string, data: any) {
    const [c] = await db.update(candidates).set({ ...data, updatedAt: new Date() }).where(eq(candidates.id, id)).returning();
    return c;
  },
  // ----- Candidate document collection (pre-onboarding) -----
  async createDocRequest(data: { candidateId: string; token: string; position?: string | null; department?: string | null }) {
    const [r] = await db.insert(candidateDocRequests).values(data).returning();
    return r;
  },
  async getDocRequestByToken(token: string) {
    const rows = await db
      .select({ r: candidateDocRequests, name: candidates.name, email: candidates.email, phone: candidates.phone })
      .from(candidateDocRequests)
      .leftJoin(candidates, eq(candidates.id, candidateDocRequests.candidateId))
      .where(eq(candidateDocRequests.token, token));
    if (!rows.length) return undefined;
    const { r, name, email, phone } = rows[0];
    return { ...r, candidateName: name, candidateEmail: email, candidatePhone: phone };
  },
  async listDocRequests() {
    const rows = await db
      .select({ r: candidateDocRequests, name: candidates.name, email: candidates.email })
      .from(candidateDocRequests)
      .leftJoin(candidates, eq(candidates.id, candidateDocRequests.candidateId))
      .orderBy(desc(candidateDocRequests.createdAt));
    return rows.map(({ r, name, email }) => ({ ...r, candidateName: name, candidateEmail: email }));
  },
  async submitDocRequest(token: string, data: { formData: any; files: any }) {
    const [r] = await db.update(candidateDocRequests)
      .set({ status: "submitted", submittedAt: new Date(), formData: data.formData, files: data.files, updatedAt: new Date() })
      .where(eq(candidateDocRequests.token, token)).returning();
    return r;
  },
  async getDocRequest(id: string) {
    const rows = await db
      .select({ r: candidateDocRequests, name: candidates.name, email: candidates.email, phone: candidates.phone })
      .from(candidateDocRequests)
      .leftJoin(candidates, eq(candidates.id, candidateDocRequests.candidateId))
      .where(eq(candidateDocRequests.id, id));
    if (!rows.length) return undefined;
    const { r, name, email, phone } = rows[0];
    return { ...r, candidateName: name, candidateEmail: email, candidatePhone: phone };
  },
  async updateDocRequest(id: string, data: any) {
    const [r] = await db.update(candidateDocRequests).set({ ...data, updatedAt: new Date() }).where(eq(candidateDocRequests.id, id)).returning();
    return r;
  },
  // Convert a submitted candidate into an employee: assign a code, create the record, move the docs.
  async onboardCandidateDocRequest(id: string, actorId: string) {
    const [req] = await db.select().from(candidateDocRequests).where(eq(candidateDocRequests.id, id));
    if (!req) throw new Error("Request not found.");
    if (req.status === "onboarded") throw new Error("This candidate is already onboarded.");
    if (req.status !== "submitted") throw new Error("The candidate hasn't submitted their documents yet.");
    if (!req.joinDate) throw new Error("Enter the date of joining first.");
    if (!req.offerLetter) throw new Error("Upload the signed offer letter first.");
    const [cand] = await db.select().from(candidates).where(eq(candidates.id, req.candidateId));
    if (!cand) throw new Error("Candidate not found.");

    const code = await this.getNextEmployeeCode();
    const fd: any = req.formData || {};
    const files: any = req.files || {};
    const parts = String(cand.name || "").trim().split(/\s+/);
    const firstName = parts[0] || cand.name || "Employee";
    const lastName = parts.slice(1).join(" ") || "";
    const maskAcct = (a: string) => (a && a.length > 4 ? `${"X".repeat(a.length - 4)}${a.slice(-4)}` : a || null);

    const [emp] = await db.insert(employees).values({
      employeeCode: code,
      firstName, lastName,
      email: cand.email,
      phone: cand.phone || null,
      joinDate: req.joinDate as any,
      currentAddress: fd.currentAddress || null,
      permanentAddress: fd.permanentAddress || null,
      emergencyContactPhone: fd.emergencyPhone || null,
      emergencyContactRelation: fd.emergencyRelation || null,
      ifscCode: fd.ifsc || null,
      bankAccountMasked: fd.accountNumber ? maskAcct(fd.accountNumber) : null,
    } as any).returning();

    // Move the collected documents into the employee document store.
    const docDefs: [string, string, any][] = [
      ["PAN Card", "identity", files.pan],
      ["Aadhaar Card", "identity", files.aadhaar],
      ["Photo ID (Passport / DL / Voter ID)", "identity", files.photoId],
      ["Previous Offer Letter", "employment", files.offerLetter],
      ["Increment Letter(s)", "employment", files.incrementLetters],
      ["Relieving Letter(s)", "employment", files.relievingLetters],
      ["Payslips (last 3 months)", "employment", files.payslips],
      ["Bank Passbook / Cancelled Cheque", "bank", files.bankProof],
      ["Signed Offer Letter", "offer", req.offerLetter],
    ];
    for (const [name, category, f] of docDefs) {
      if (f && f.fileData) {
        await db.insert(documents).values({
          employeeId: emp.id, name, category,
          fileUrl: f.fileData, mimeType: f.fileType || null, uploadedBy: actorId, isPublic: false,
        } as any);
      }
    }

    await db.update(candidates).set({ linkedEmployeeId: emp.id, updatedAt: new Date() }).where(eq(candidates.id, cand.id));
    await db.update(candidateDocRequests).set({ status: "onboarded", employeeId: emp.id, employeeCode: code, updatedAt: new Date() }).where(eq(candidateDocRequests.id, id));
    return { employee: emp, employeeCode: code };
  },

  // ====== APPLICATIONS ======
  async getApplications(requisitionId?: string, candidateId?: string) {
    const conds: any[] = [];
    if (requisitionId) conds.push(eq(applications.requisitionId, requisitionId));
    if (candidateId) conds.push(eq(applications.candidateId, candidateId));
    if (conds.length > 0) return db.select().from(applications).where(and(...conds)).orderBy(desc(applications.createdAt));
    return db.select().from(applications).orderBy(desc(applications.createdAt));
  },
  async getApplication(id: string) {
    const [a] = await db.select().from(applications).where(eq(applications.id, id));
    return a;
  },
  async createApplication(data: any) {
    const [a] = await db.insert(applications).values(data).returning();
    return a;
  },
  async updateApplication(id: string, data: any) {
    const [a] = await db.update(applications).set({ ...data, updatedAt: new Date(), lastActivityAt: new Date() }).where(eq(applications.id, id)).returning();
    return a;
  },

  async addApplicationTimeline(data: { applicationId: string; actorUserId?: string; action: string; comment?: string; metadata?: any }) {
    const [e] = await db.insert(applicationTimeline).values(data).returning();
    return e;
  },
  async getApplicationTimeline(applicationId: string) {
    return db.select().from(applicationTimeline).where(eq(applicationTimeline.applicationId, applicationId)).orderBy(desc(applicationTimeline.createdAt));
  },

  // ====== INTERVIEWS ======
  async getInterviews(applicationId?: string) {
    if (applicationId) return db.select().from(interviews).where(eq(interviews.applicationId, applicationId)).orderBy(interviews.scheduledStart);
    return db.select().from(interviews).orderBy(desc(interviews.scheduledStart));
  },
  async getInterview(id: string) {
    const [i] = await db.select().from(interviews).where(eq(interviews.id, id));
    return i;
  },
  async createInterview(data: any) {
    const [i] = await db.insert(interviews).values(data).returning();
    return i;
  },
  async updateInterview(id: string, data: any) {
    const [i] = await db.update(interviews).set(data).where(eq(interviews.id, id)).returning();
    return i;
  },

  async createInterviewFeedback(data: any) {
    const [f] = await db.insert(interviewFeedback).values(data).returning();
    return f;
  },
  async getInterviewFeedback(interviewId: string) {
    return db.select().from(interviewFeedback).where(eq(interviewFeedback.interviewId, interviewId));
  },
  async updateInterviewFeedback(id: string, data: any) {
    const [f] = await db.update(interviewFeedback).set(data).where(eq(interviewFeedback.id, id)).returning();
    return f;
  },

  // ====== OFFERS ======
  async getOffers(applicationId?: string, status?: string) {
    if (applicationId) return db.select().from(offers).where(eq(offers.applicationId, applicationId)).orderBy(desc(offers.createdAt));
    if (status) return db.select().from(offers).where(eq(offers.status, status)).orderBy(desc(offers.createdAt));
    return db.select().from(offers).orderBy(desc(offers.createdAt));
  },
  async getOffer(id: string) {
    const [o] = await db.select().from(offers).where(eq(offers.id, id));
    return o;
  },
  async createOffer(data: any) {
    const [o] = await db.insert(offers).values(data).returning();
    return o;
  },
  async updateOffer(id: string, data: any) {
    const [o] = await db.update(offers).set({ ...data, updatedAt: new Date() }).where(eq(offers.id, id)).returning();
    return o;
  },

  // ====== VENDORS ======
  async getVendors(category?: string) {
    if (category && category !== "all") return db.select().from(vendors).where(eq(vendors.category, category)).orderBy(vendors.name);
    return db.select().from(vendors).orderBy(vendors.name);
  },
  async getVendor(id: string) {
    const [v] = await db.select().from(vendors).where(eq(vendors.id, id));
    return v;
  },
  async createVendor(data: any) {
    const [v] = await db.insert(vendors).values(data).returning();
    return v;
  },
  async updateVendor(id: string, data: any) {
    const [v] = await db.update(vendors).set(data).where(eq(vendors.id, id)).returning();
    return v;
  },

  // ====== PURCHASE REQUESTS ======
  async getPurchaseRequests(requesterId?: string, status?: string) {
    const conds: any[] = [];
    if (requesterId) conds.push(eq(purchaseRequests.requesterId, requesterId));
    if (status && status !== "all") conds.push(eq(purchaseRequests.status, status));
    if (conds.length > 0) return db.select().from(purchaseRequests).where(and(...conds)).orderBy(desc(purchaseRequests.createdAt));
    return db.select().from(purchaseRequests).orderBy(desc(purchaseRequests.createdAt));
  },
  async getPurchaseRequest(id: string) {
    const [p] = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, id));
    return p;
  },
  async createPurchaseRequest(data: any) {
    const [p] = await db.insert(purchaseRequests).values(data).returning();
    return p;
  },
  async updatePurchaseRequest(id: string, data: any) {
    const [p] = await db.update(purchaseRequests).set({ ...data, updatedAt: new Date() }).where(eq(purchaseRequests.id, id)).returning();
    return p;
  },

  // ====== TRAVEL REQUESTS ======
  async getTravelRequests(requesterId?: string, status?: string) {
    const conds: any[] = [];
    if (requesterId) conds.push(eq(travelRequests.requesterId, requesterId));
    if (status && status !== "all") conds.push(eq(travelRequests.status, status));
    if (conds.length > 0) return db.select().from(travelRequests).where(and(...conds)).orderBy(desc(travelRequests.createdAt));
    return db.select().from(travelRequests).orderBy(desc(travelRequests.createdAt));
  },
  async getTravelRequest(id: string) {
    const [t] = await db.select().from(travelRequests).where(eq(travelRequests.id, id));
    return t;
  },
  async createTravelRequest(data: any) {
    const [t] = await db.insert(travelRequests).values(data).returning();
    return t;
  },
  async updateTravelRequest(id: string, data: any) {
    const [t] = await db.update(travelRequests).set({ ...data, updatedAt: new Date() }).where(eq(travelRequests.id, id)).returning();
    return t;
  },
  async getTravelBookings(travelRequestId: string) {
    return db.select().from(travelBookings).where(eq(travelBookings.travelRequestId, travelRequestId)).orderBy(travelBookings.createdAt);
  },
  async createTravelBooking(data: any) {
    const [b] = await db.insert(travelBookings).values(data).returning();
    return b;
  },

  // ====== WORKSPACE PAYMENTS ======
  async getWorkspacePayments(status?: string) {
    if (status && status !== "all") return db.select().from(workspacePayments).where(eq(workspacePayments.status, status)).orderBy(desc(workspacePayments.createdAt));
    return db.select().from(workspacePayments).orderBy(desc(workspacePayments.createdAt));
  },
  async createWorkspacePayment(data: any) {
    const [p] = await db.insert(workspacePayments).values(data).returning();
    return p;
  },
  async updateWorkspacePayment(id: string, data: any) {
    const [p] = await db.update(workspacePayments).set({ ...data, updatedAt: new Date() }).where(eq(workspacePayments.id, id)).returning();
    return p;
  },

  // ====== ADMIN HELPDESK TICKETS ======
  async getAdminTickets(assignedTo?: string, status?: string) {
    const conds: any[] = [];
    if (assignedTo) conds.push(eq(adminTickets.assignedTo, assignedTo));
    if (status && status !== "all") conds.push(eq(adminTickets.status, status));
    if (conds.length > 0) return db.select().from(adminTickets).where(and(...conds)).orderBy(desc(adminTickets.createdAt));
    return db.select().from(adminTickets).orderBy(desc(adminTickets.createdAt));
  },
  async getAdminTicket(id: string) {
    const [t] = await db.select().from(adminTickets).where(eq(adminTickets.id, id));
    return t;
  },
  async createAdminTicket(data: any) {
    const [t] = await db.insert(adminTickets).values(data).returning();
    return t;
  },
  async updateAdminTicket(id: string, data: any) {
    const [t] = await db.update(adminTickets).set({ ...data, updatedAt: new Date() }).where(eq(adminTickets.id, id)).returning();
    return t;
  },
  async getAdminTicketComments(ticketId: string) {
    return db.select().from(adminTicketComments).where(eq(adminTicketComments.ticketId, ticketId)).orderBy(adminTicketComments.createdAt);
  },
  async addAdminTicketComment(data: any) {
    const [c] = await db.insert(adminTicketComments).values(data).returning();
    return c;
  },

  // ====== EMPLOYEE-SCOPED REQUESTS ======
  async getMyPurchaseRequests(requesterId: string, status?: string) {
    const conds: any[] = [eq(purchaseRequests.requesterId, requesterId)];
    if (status && status !== "all") conds.push(eq(purchaseRequests.status, status));
    return db.select().from(purchaseRequests).where(and(...conds)).orderBy(desc(purchaseRequests.createdAt));
  },

  async getMyTravelRequests(requesterId: string, status?: string) {
    const conds: any[] = [eq(travelRequests.requesterId, requesterId)];
    if (status && status !== "all") conds.push(eq(travelRequests.status, status));
    return db.select().from(travelRequests).where(and(...conds)).orderBy(desc(travelRequests.createdAt));
  },

  async getMyTickets(requesterId: string, status?: string) {
    const conds: any[] = [eq(adminTickets.requesterId, requesterId)];
    if (status && status !== "all") conds.push(eq(adminTickets.status, status));
    return db.select().from(adminTickets).where(and(...conds)).orderBy(desc(adminTickets.createdAt));
  },

  async getEmployeeByUserId(userId: string) {
    const [emp] = await db.select().from(employees).where(eq(employees.userId, userId));
    return emp;
  },

  async getEmployeesByManager(managerId: string) {
    return db.select().from(employees).where(eq(employees.managerId, managerId));
  },

  // ====== HR TASKS ======
  async getHrTasks(assignedTo?: string, status?: string) {
    const conds: any[] = [];
    if (assignedTo) conds.push(eq(hrTasks.assignedTo, assignedTo));
    if (status && status !== "all") conds.push(eq(hrTasks.status, status));
    if (conds.length > 0) return db.select().from(hrTasks).where(and(...conds)).orderBy(desc(hrTasks.createdAt));
    return db.select().from(hrTasks).orderBy(desc(hrTasks.createdAt));
  },
  async createHrTask(data: any) {
    const [t] = await db.insert(hrTasks).values(data).returning();
    return t;
  },
  async updateHrTask(id: string, data: any) {
    const [t] = await db.update(hrTasks).set({ ...data, updatedAt: new Date() }).where(eq(hrTasks.id, id)).returning();
    return t;
  },
  async deleteHrTask(id: string) {
    await db.delete(hrTasks).where(eq(hrTasks.id, id));
  },

  // ====== STATS ======
  async getDashboardStats() {
    const [empCount] = await db.select({ count: sql<number>`count(*)` }).from(employees).where(eq(employees.employmentStatus, "active"));
    const [pendingLeaves] = await db.select({ count: sql<number>`count(*)` }).from(leaveRequests).where(eq(leaveRequests.status, "pending"));
    const [pendingRegs] = await db.select({ count: sql<number>`count(*)` }).from(regularizationRequests).where(eq(regularizationRequests.status, "pending"));
    const today = new Date().toISOString().split("T")[0];
    const [presentToday] = await db.select({ count: sql<number>`count(*)` }).from(attendanceRecords)
      .where(and(eq(attendanceRecords.date, today), eq(attendanceRecords.status, "present")));

    return {
      totalEmployees: Number(empCount.count),
      pendingLeaves: Number(pendingLeaves.count),
      pendingRegularizations: Number(pendingRegs.count),
      presentToday: Number(presentToday.count),
    };
  },

  // =========================================================================
  // v2 — LOGISTICS MOVEMENTS
  // =========================================================================
  async listMovementLocations() {
    return db.select().from(movementLocations).where(eq(movementLocations.status, "active")).orderBy(asc(movementLocations.name));
  },
  async createMovementLocation(data: any) {
    const [r] = await db.insert(movementLocations).values(data).returning();
    return r;
  },
  async updateMovementLocation(id: string, data: any) {
    const [r] = await db.update(movementLocations).set(data).where(eq(movementLocations.id, id)).returning();
    return r;
  },

  async listLogisticsMovements(filters: { requesterId?: string; status?: string } = {}) {
    let q = db.select().from(logisticsMovements).$dynamic();
    const conds: any[] = [];
    if (filters.requesterId) conds.push(eq(logisticsMovements.requesterId, filters.requesterId));
    if (filters.status) conds.push(eq(logisticsMovements.status, filters.status));
    if (conds.length) q = q.where(and(...conds));
    return q.orderBy(desc(logisticsMovements.createdAt));
  },
  async getLogisticsMovement(id: string) {
    const [r] = await db.select().from(logisticsMovements).where(eq(logisticsMovements.id, id));
    return r;
  },
  async createLogisticsMovement(data: any) {
    const ref = await genRef("MOV", logisticsMovements);
    const [r] = await db.insert(logisticsMovements).values({ ...data, reference: ref }).returning();
    return r;
  },
  async updateLogisticsMovement(id: string, data: any) {
    const [r] = await db.update(logisticsMovements).set({ ...data, updatedAt: new Date() }).where(eq(logisticsMovements.id, id)).returning();
    return r;
  },
  async addMovementEvent(data: any) {
    const [r] = await db.insert(movementEvents).values(data).returning();
    return r;
  },
  // ----- Logistics Requests (Inboard / Outboard) -----
  async listLogisticsRequests(filters: { requesterId?: string; status?: string } = {}) {
    const conds: any[] = [];
    if (filters.requesterId) conds.push(eq(logisticsRequests.requesterId, filters.requesterId));
    if (filters.status) conds.push(eq(logisticsRequests.status, filters.status));
    let q = db
      .select({ r: logisticsRequests, firstName: employees.firstName, lastName: employees.lastName, dept: departments.name })
      .from(logisticsRequests)
      .leftJoin(users, eq(users.id, logisticsRequests.requesterId))
      .leftJoin(employees, eq(employees.id, users.employeeId))
      .leftJoin(departments, eq(departments.id, employees.departmentId))
      .$dynamic();
    if (conds.length) q = q.where(and(...conds));
    const rows = await q.orderBy(desc(logisticsRequests.createdAt));
    return rows.map(({ r, firstName, lastName, dept }) => ({ ...r, requesterName: [firstName, lastName].filter(Boolean).join(" ") || null, requesterDept: dept || null }));
  },
  async getLogisticsRequest(id: string) {
    const [r] = await db.select().from(logisticsRequests).where(eq(logisticsRequests.id, id));
    return r;
  },
  async createLogisticsRequest(data: any) {
    const ref = await genRef("LR", logisticsRequests);
    const [r] = await db.insert(logisticsRequests).values({ ...data, reference: ref }).returning();
    return r;
  },
  async updateLogisticsRequest(id: string, data: any) {
    const [r] = await db.update(logisticsRequests).set({ ...data, updatedAt: new Date() }).where(eq(logisticsRequests.id, id)).returning();
    return r;
  },
  async listMovementEvents(movementId: string) {
    return db.select().from(movementEvents).where(eq(movementEvents.movementId, movementId)).orderBy(asc(movementEvents.createdAt));
  },

  // =========================================================================
  // v2 — COMPANY VEHICLES
  // =========================================================================
  async listCompanyVehicles() {
    return db.select().from(companyVehicles).orderBy(asc(companyVehicles.name));
  },
  async createCompanyVehicle(data: any) {
    const [r] = await db.insert(companyVehicles).values(data).returning();
    return r;
  },
  async updateCompanyVehicle(id: string, data: any) {
    const [r] = await db.update(companyVehicles).set(data).where(eq(companyVehicles.id, id)).returning();
    return r;
  },
  async deleteCompanyVehicle(id: string) {
    await db.delete(companyVehicles).where(eq(companyVehicles.id, id));
    return { ok: true };
  },
  async listVehicleBookings(vehicleId?: string) {
    if (vehicleId) {
      return db.select().from(vehicleBookings).where(eq(vehicleBookings.vehicleId, vehicleId)).orderBy(asc(vehicleBookings.startTime));
    }
    return db.select().from(vehicleBookings).orderBy(asc(vehicleBookings.startTime));
  },
  async getVehicleBooking(id: string) {
    const [r] = await db.select().from(vehicleBookings).where(eq(vehicleBookings.id, id));
    return r;
  },
  // Overlapping *confirmed company-car* bookings for the given window (rentals never block the slot).
  // Overlap is checked against each booking's effective BLOCK window (inter-city = whole day,
  // intra-city = the 3-hour block extension), falling back to start/end for legacy rows.
  async companyCarConflicts(vehicleId: string, winStart: Date, winEnd: Date, excludeId?: string) {
    const rows = await db.select().from(vehicleBookings).where(
      and(
        eq(vehicleBookings.vehicleId, vehicleId),
        eq(vehicleBookings.bookingType, "company_car"),
        eq(vehicleBookings.status, "confirmed"),
      ),
    );
    return rows.filter((r) => {
      if (excludeId && r.id === excludeId) return false;
      const bs = r.blockStart ? new Date(r.blockStart) : new Date(r.startTime);
      const be = r.blockEnd ? new Date(r.blockEnd) : new Date(r.endTime);
      return bs < winEnd && winStart < be; // strict overlap
    });
  },
  async createVehicleBooking(data: any) {
    // Only the shared company car has a single physical slot — enforce no overlap on the block window.
    // Rental requests (external agency) never conflict and skip this check.
    if ((data.bookingType || "company_car") === "company_car") {
      const ws = data.blockStart || data.startTime;
      const we = data.blockEnd || data.endTime;
      const conflicts = await this.companyCarConflicts(data.vehicleId, ws, we);
      if (conflicts.length) throw new Error("The company car is already booked or blocked for that time");
    }
    const [r] = await db.insert(vehicleBookings).values(data).returning();
    return r;
  },
  // Atomically create all legs of a trip (0+ company cars + optional overflow rental) in ONE
  // transaction. Advisory locks per vehicle serialize concurrent bookings for the same car, and
  // each company leg's conflict is re-checked under the lock — so two people can't grab the same
  // slot at once (fixes the check-then-insert race).
  async createBookingTransaction(companyLegs: any[], rentalLegs: any[]) {
    return await db.transaction(async (tx) => {
      const vids = Array.from(new Set(companyLegs.map((l) => l.vehicleId))).sort();
      for (const vid of vids) {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${vid}::text, 0))`);
      }
      for (const leg of companyLegs) {
        const rows = await tx.select().from(vehicleBookings).where(and(
          eq(vehicleBookings.vehicleId, leg.vehicleId),
          eq(vehicleBookings.bookingType, "company_car"),
          eq(vehicleBookings.status, "confirmed"),
        ));
        const ws = new Date(leg.blockStart || leg.startTime).getTime();
        const we = new Date(leg.blockEnd || leg.endTime).getTime();
        const clash = rows.some((r) => {
          const bs = new Date(r.blockStart || r.startTime).getTime();
          const be = new Date(r.blockEnd || r.endTime).getTime();
          return bs < we && ws < be;
        });
        if (clash) throw new Error("The company car was just booked for that time — please pick another slot.");
      }
      const created: any[] = [];
      for (const leg of [...companyLegs, ...rentalLegs]) {
        const [r] = await tx.insert(vehicleBookings).values(leg).returning();
        created.push(r);
      }
      return created;
    });
  },
  async getBookingsByGroup(groupId: string) {
    return db.select().from(vehicleBookings).where(eq(vehicleBookings.groupId, groupId));
  },
  // Pair a split company_car + rental booking so each references the other.
  async linkVehicleBookings(aId: string, bId: string) {
    await db.update(vehicleBookings).set({ linkedBookingId: bId }).where(eq(vehicleBookings.id, aId));
    await db.update(vehicleBookings).set({ linkedBookingId: aId }).where(eq(vehicleBookings.id, bId));
  },
  async cancelVehicleBooking(id: string) {
    const [r] = await db.update(vehicleBookings).set({ status: "cancelled" }).where(eq(vehicleBookings.id, id)).returning();
    return r;
  },
  async setVehicleBookingAttendees(id: string, attendees: any[]) {
    const [r] = await db.update(vehicleBookings).set({ attendees, passengers: Math.max(1, attendees.length) }).where(eq(vehicleBookings.id, id)).returning();
    return r;
  },
  async updateVehicleBooking(id: string, data: any) {
    const [r] = await db.update(vehicleBookings).set(data).where(eq(vehicleBookings.id, id)).returning();
    return r;
  },
  async setRentalDecision(id: string, status: string, approvedById: string, decisionNote?: string | null) {
    const [r] = await db.update(vehicleBookings).set({ status, approvedById, decisionNote: decisionNote || null }).where(eq(vehicleBookings.id, id)).returning();
    return r;
  },

  // =========================================================================
  // v2 — REIMBURSEMENTS
  // =========================================================================
  async listReimbursements(filters: { requesterId?: string; status?: string } = {}) {
    let q = db.select().from(reimbursements).$dynamic();
    const conds: any[] = [];
    if (filters.requesterId) conds.push(eq(reimbursements.requesterId, filters.requesterId));
    if (filters.status) conds.push(eq(reimbursements.status, filters.status));
    if (conds.length) q = q.where(and(...conds));
    return q.orderBy(desc(reimbursements.createdAt));
  },
  async getReimbursement(id: string) {
    const [r] = await db.select().from(reimbursements).where(eq(reimbursements.id, id));
    return r;
  },
  async createReimbursement(data: any) {
    const ref = await genRef("RMB", reimbursements);
    const [r] = await db.insert(reimbursements).values({ ...data, reference: ref }).returning();
    return r;
  },
  async updateReimbursement(id: string, data: any) {
    const [r] = await db.update(reimbursements).set({ ...data, updatedAt: new Date() }).where(eq(reimbursements.id, id)).returning();
    return r;
  },

  async listOfficePurchases(filters: { requesterId?: string; status?: string } = {}) {
    let q = db.select().from(officePurchases).$dynamic();
    const conds: any[] = [];
    if (filters.requesterId) conds.push(eq(officePurchases.requesterId, filters.requesterId));
    if (filters.status) conds.push(eq(officePurchases.status, filters.status));
    if (conds.length) q = q.where(and(...conds));
    return q.orderBy(desc(officePurchases.createdAt));
  },
  async getOfficePurchase(id: string) {
    const [r] = await db.select().from(officePurchases).where(eq(officePurchases.id, id));
    return r;
  },
  async createOfficePurchase(data: any) {
    const ref = await genRef("OP", officePurchases);
    const [r] = await db.insert(officePurchases).values({ ...data, reference: ref }).returning();
    return r;
  },
  async updateOfficePurchase(id: string, data: any) {
    const [r] = await db.update(officePurchases).set({ ...data, updatedAt: new Date() }).where(eq(officePurchases.id, id)).returning();
    return r;
  },

  async listProcurementRequests(filters: { requesterId?: string; status?: string } = {}) {
    let q = db.select().from(procurementRequests).$dynamic();
    const conds: any[] = [];
    if (filters.requesterId) conds.push(eq(procurementRequests.requesterId, filters.requesterId));
    if (filters.status) conds.push(eq(procurementRequests.status, filters.status));
    if (conds.length) q = q.where(and(...conds));
    return q.orderBy(desc(procurementRequests.createdAt));
  },
  async getProcurementRequest(id: string) {
    const [r] = await db.select().from(procurementRequests).where(eq(procurementRequests.id, id));
    return r;
  },
  async createProcurementRequest(data: any) {
    const ref = await genRef("PRQ", procurementRequests);
    const [r] = await db.insert(procurementRequests).values({ ...data, reference: ref }).returning();
    return r;
  },
  async updateProcurementRequest(id: string, data: any) {
    const [r] = await db.update(procurementRequests).set({ ...data, updatedAt: new Date() }).where(eq(procurementRequests.id, id)).returning();
    return r;
  },

  // ----- Travel (trip requests) -----
  async listTripRequests(filters: { requesterId?: string; status?: string } = {}) {
    let q = db.select().from(tripRequests).$dynamic();
    const conds: any[] = [];
    if (filters.requesterId) conds.push(eq(tripRequests.requesterId, filters.requesterId));
    if (filters.status) conds.push(eq(tripRequests.status, filters.status));
    if (conds.length) q = q.where(and(...conds));
    return q.orderBy(desc(tripRequests.createdAt));
  },
  async getTripRequest(id: string) {
    const [r] = await db.select().from(tripRequests).where(eq(tripRequests.id, id));
    return r;
  },
  async createTripRequest(data: any) {
    const ref = await genRef("TRV", tripRequests);
    const [r] = await db.insert(tripRequests).values({ ...data, reference: ref }).returning();
    return r;
  },
  async updateTripRequest(id: string, data: any) {
    const [r] = await db.update(tripRequests).set({ ...data, updatedAt: new Date() }).where(eq(tripRequests.id, id)).returning();
    return r;
  },

  // =========================================================================
  // v2 — UNIFIED REQUESTS + COMMENTS
  // =========================================================================
  async listRequests(filters: { requesterId?: string; routeToTeam?: string; status?: string } = {}) {
    let q = db.select().from(requestsTable).$dynamic();
    const conds: any[] = [];
    if (filters.requesterId) conds.push(eq(requestsTable.requesterId, filters.requesterId));
    if (filters.routeToTeam) conds.push(eq(requestsTable.routeToTeam, filters.routeToTeam));
    if (filters.status) conds.push(eq(requestsTable.status, filters.status));
    if (conds.length) q = q.where(and(...conds));
    return q.orderBy(desc(requestsTable.createdAt));
  },
  async getRequest(id: string) {
    const [r] = await db.select().from(requestsTable).where(eq(requestsTable.id, id));
    return r;
  },
  async createRequest(data: any) {
    const ref = await genRef("REQ", requestsTable);
    const [r] = await db.insert(requestsTable).values({ ...data, reference: ref }).returning();
    return r;
  },
  async updateRequest(id: string, data: any) {
    const [r] = await db.update(requestsTable).set({ ...data, updatedAt: new Date() }).where(eq(requestsTable.id, id)).returning();
    return r;
  },
  async listRequestComments(requestId: string) {
    return db.select().from(requestComments).where(eq(requestComments.requestId, requestId)).orderBy(asc(requestComments.createdAt));
  },
  async addRequestComment(data: any) {
    const [r] = await db.insert(requestComments).values(data).returning();
    return r;
  },

  // =========================================================================
  // v2 — CEO APPROVAL NOTES
  // =========================================================================
  async listCeoApprovalNotes(status?: string) {
    if (status) {
      return db.select().from(ceoApprovalNotes).where(eq(ceoApprovalNotes.status, status)).orderBy(desc(ceoApprovalNotes.createdAt));
    }
    return db.select().from(ceoApprovalNotes).orderBy(desc(ceoApprovalNotes.createdAt));
  },
  async getCeoApprovalNote(id: string) {
    const [r] = await db.select().from(ceoApprovalNotes).where(eq(ceoApprovalNotes.id, id));
    return r;
  },
  async createCeoApprovalNote(data: any) {
    const ref = await genRef("APR", ceoApprovalNotes);
    const [r] = await db.insert(ceoApprovalNotes).values({ ...data, reference: ref }).returning();
    return r;
  },
  async decideCeoApprovalNote(id: string, decidedById: string, status: "approved" | "rejected", decisionNote?: string) {
    const [r] = await db.update(ceoApprovalNotes).set({
      status, decidedById, decisionNote, decidedAt: new Date(),
    }).where(eq(ceoApprovalNotes.id, id)).returning();
    // Cascade decision to linked requests
    if (r && Array.isArray(r.linkedRequestIds)) {
      const newStatus = status === "approved" ? "approved" : "rejected";
      for (const rid of r.linkedRequestIds as string[]) {
        await db.update(requestsTable).set({ status: newStatus, updatedAt: new Date() }).where(eq(requestsTable.id, rid));
      }
    }
    return r;
  },

  // =========================================================================
  // v2 — REFERENCE DOCS
  // =========================================================================
  async listReferenceDocs(section?: string) {
    if (section) {
      return db.select().from(referenceDocs).where(and(eq(referenceDocs.section, section), eq(referenceDocs.isActive, true))).orderBy(desc(referenceDocs.createdAt));
    }
    return db.select().from(referenceDocs).where(eq(referenceDocs.isActive, true)).orderBy(desc(referenceDocs.createdAt));
  },
  async createReferenceDoc(data: any) {
    const [r] = await db.insert(referenceDocs).values(data).returning();
    return r;
  },
  async updateReferenceDoc(id: string, data: any) {
    const [r] = await db.update(referenceDocs).set({ ...data, updatedAt: new Date() }).where(eq(referenceDocs.id, id)).returning();
    return r;
  },
  async deleteReferenceDoc(id: string) {
    await db.update(referenceDocs).set({ isActive: false, updatedAt: new Date() }).where(eq(referenceDocs.id, id));
  },

  // =========================================================================
  // v2 — ZOHO CONFIG + SYNC JOBS
  // =========================================================================
  async getZohoConfig() {
    const [r] = await db.select().from(zohoConfig).limit(1);
    return r;
  },
  async upsertZohoConfig(data: any) {
    const existing = await this.getZohoConfig();
    if (existing) {
      const [r] = await db.update(zohoConfig).set({ ...data, updatedAt: new Date() }).where(eq(zohoConfig.id, existing.id)).returning();
      return r;
    }
    const [r] = await db.insert(zohoConfig).values(data).returning();
    return r;
  },
  async getPendingZohoJobs(limit: number) {
    return db.select().from(zohoSyncJobs).where(eq(zohoSyncJobs.status, "pending")).orderBy(asc(zohoSyncJobs.createdAt)).limit(limit);
  },
  async getZohoJobByKey(key: string) {
    const [r] = await db.select().from(zohoSyncJobs).where(eq(zohoSyncJobs.idempotencyKey, key));
    return r;
  },
  async createZohoJob(data: any) {
    const [r] = await db.insert(zohoSyncJobs).values(data).returning();
    return r;
  },
  async updateZohoJob(id: string, data: any) {
    const [r] = await db.update(zohoSyncJobs).set({ ...data, updatedAt: new Date() }).where(eq(zohoSyncJobs.id, id)).returning();
    return r;
  },
  async listZohoJobs(limit = 100) {
    return db.select().from(zohoSyncJobs).orderBy(desc(zohoSyncJobs.createdAt)).limit(limit);
  },

  // =========================================================================
  // v2 — GOOGLE SSO HELPERS
  // =========================================================================
  async getUserByEmail(email: string) {
    // employees hold canonical email
    const rows = await db.select().from(users).innerJoin(employees, eq(users.employeeId, employees.id))
      .where(eq(employees.email, email.toLowerCase()));
    return rows[0]?.users;
  },

};
