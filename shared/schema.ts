import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  date,
  timestamp,
  numeric,
  jsonb,
  json,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// express-session store table (managed at runtime by connect-pg-simple).
// Declared here so `drizzle-kit push` preserves it instead of dropping it
// as an unknown table.
export const session = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
}, (t) => ({
  expireIdx: index("IDX_session_expire").on(t.expire),
}));

// Enums
export const roleEnum = pgEnum("role", [
  "super_admin",
  "hr_admin",
  "hr_executive",
  "finance",
  "manager",
  "employee",
  "recruiter",
  "hr_ops",
  "office_admin",
  "ceo_approver",
  "interviewer",
]);

export const employmentTypeEnum = pgEnum("employment_type", [
  "full_time",
  "part_time",
  "intern",
  "contract",
]);

export const employmentStatusEnum = pgEnum("employment_status", [
  "active",
  "inactive",
  "on_notice",
  "exited",
]);

export const genderEnum = pgEnum("gender", ["male", "female", "other"]);

export const maritalStatusEnum = pgEnum("marital_status", [
  "single",
  "married",
  "divorced",
  "widowed",
]);

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "present",
  "absent",
  "half_day",
  "wfh",
  "on_duty",
  "holiday",
  "leave",
  "weekend",
]);

export const attendanceSourceEnum = pgEnum("attendance_source", [
  "manual",
  "device",
  "api",
  "admin_override",
]);

export const leaveStatusEnum = pgEnum("leave_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);

export const payrollStatusEnum = pgEnum("payroll_status", [
  "draft",
  "review",
  "approved",
  "locked",
]);

export const leaveTransactionTypeEnum = pgEnum("leave_transaction_type", [
  "accrual",
  "debit",
  "adjustment",
  "expiry",
  "encashment",
]);

export const cycleStatusEnum = pgEnum("cycle_status", [
  "draft",
  "active",
  "locked",
  "archived",
]);

export const goalStatusEnum = pgEnum("goal_status", [
  "not_started",
  "on_track",
  "at_risk",
  "off_track",
  "completed",
]);

export const reviewStatusEnum = pgEnum("review_status", [
  "not_started",
  "self_submitted",
  "manager_submitted",
  "hr_locked",
  "finalized",
]);

// Departments
export const departments = pgTable("departments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  headId: varchar("head_id"),
  parentId: varchar("parent_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Designations
export const designations = pgTable("designations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  grade: text("grade"),
  departmentId: varchar("department_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Users (auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: roleEnum("role").notNull().default("employee"),
  employeeId: varchar("employee_id"),
  isActive: boolean("is_active").notNull().default(true),
  accountStatus: text("account_status").notNull().default("active"),
  inviteToken: text("invite_token"),
  inviteExpiresAt: timestamp("invite_expires_at"),
  resetToken: text("reset_token"),
  resetExpiresAt: timestamp("reset_expires_at"),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Employees
export const employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeCode: text("employee_code").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  dateOfBirth: date("date_of_birth"),
  gender: genderEnum("gender"),
  maritalStatus: maritalStatusEnum("marital_status"),

  // Employment
  joinDate: date("join_date").notNull(),
  confirmationDate: date("confirmation_date"),
  lastWorkingDate: date("last_working_date"),
  noticePeriodDays: integer("notice_period_days").default(30),
  probationDays: integer("probation_days").default(90),
  employmentType: employmentTypeEnum("employment_type").notNull().default("full_time"),
  employmentStatus: employmentStatusEnum("employment_status").notNull().default("active"),

  // Position
  designationId: varchar("designation_id"),
  departmentId: varchar("department_id"),
  managerId: varchar("manager_id"),
  workLocation: text("work_location"),

  // Legal
  panNumber: text("pan_number"),
  aadhaarMasked: text("aadhaar_masked"),
  uan: text("uan"),
  pfEligible: boolean("pf_eligible").default(true),
  esiEligible: boolean("esi_eligible").default(false),

  // Bank (masked store)
  bankName: text("bank_name"),
  bankAccountMasked: text("bank_account_masked"),
  ifscCode: text("ifsc_code"),

  // Address
  currentAddress: text("current_address"),
  permanentAddress: text("permanent_address"),

  // Emergency
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  emergencyContactRelation: text("emergency_contact_relation"),

  // Avatar
  avatarUrl: text("avatar_url"),

  userId: varchar("user_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Salary Structures (versioned)
export const salaryStructures = pgTable("salary_structures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  effectiveFrom: date("effective_from").notNull(),
  effectiveTo: date("effective_to"),

  // Earnings
  basicSalary: numeric("basic_salary", { precision: 12, scale: 2 }).notNull(),
  hra: numeric("hra", { precision: 12, scale: 2 }).default("0"),
  specialAllowance: numeric("special_allowance", { precision: 12, scale: 2 }).default("0"),
  conveyanceAllowance: numeric("conveyance_allowance", { precision: 12, scale: 2 }).default("0"),
  medicalAllowance: numeric("medical_allowance", { precision: 12, scale: 2 }).default("0"),
  otherAllowances: numeric("other_allowances", { precision: 12, scale: 2 }).default("0"),

  // CTC
  ctc: numeric("ctc", { precision: 12, scale: 2 }).notNull(),

  notes: text("notes"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Attendance Records
export const attendanceRecords = pgTable("attendance_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  date: date("date").notNull(),
  checkIn: timestamp("check_in"),
  checkOut: timestamp("check_out"),
  totalHours: numeric("total_hours", { precision: 5, scale: 2 }),
  status: attendanceStatusEnum("status").notNull().default("absent"),
  source: attendanceSourceEnum("source").notNull().default("manual"),
  isLate: boolean("is_late").default(false),
  isEarlyExit: boolean("is_early_exit").default(false),
  notes: text("notes"),
  overrideBy: varchar("override_by"),
  overrideReason: text("override_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Attendance Regularization Requests
export const regularizationRequests = pgTable("regularization_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  attendanceDate: date("attendance_date").notNull(),
  requestedCheckIn: timestamp("requested_check_in"),
  requestedCheckOut: timestamp("requested_check_out"),
  requestedStatus: attendanceStatusEnum("requested_status"),
  reason: text("reason").notNull(),
  status: leaveStatusEnum("status").notNull().default("pending"),
  approvedBy: varchar("approved_by"),
  approvalNotes: text("approval_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Leave Types
export const leaveTypes = pgTable("leave_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  color: text("color").default("#3B82F6"),
  isPaid: boolean("is_paid").default(true),
  isCarryForward: boolean("is_carry_forward").default(false),
  maxCarryForwardDays: integer("max_carry_forward_days").default(0),
  isEncashable: boolean("is_encashable").default(false),
  maxDaysPerYear: integer("max_days_per_year").default(0),
  minDaysPerRequest: numeric("min_days_per_request", { precision: 3, scale: 1 }).default("0.5"),
  maxDaysPerRequest: integer("max_days_per_request").default(30),
  requiresApproval: boolean("requires_approval").default(true),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Leave Balances (Ledger)
export const leaveBalances = pgTable("leave_balances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  leaveTypeId: varchar("leave_type_id").notNull(),
  year: integer("year").notNull(),
  openingBalance: numeric("opening_balance", { precision: 5, scale: 1 }).default("0"),
  accrued: numeric("accrued", { precision: 5, scale: 1 }).default("0"),
  taken: numeric("taken", { precision: 5, scale: 1 }).default("0"),
  adjusted: numeric("adjusted", { precision: 5, scale: 1 }).default("0"),
  closingBalance: numeric("closing_balance", { precision: 5, scale: 1 }).default("0"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Leave Ledger (immutable transactions)
export const leaveLedger = pgTable("leave_ledger", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  leaveTypeId: varchar("leave_type_id").notNull(),
  transactionType: leaveTransactionTypeEnum("transaction_type").notNull(),
  days: numeric("days", { precision: 5, scale: 1 }).notNull(),
  balanceAfter: numeric("balance_after", { precision: 5, scale: 1 }).notNull(),
  referenceId: varchar("reference_id"),
  notes: text("notes"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Leave Requests
export const leaveRequests = pgTable("leave_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  leaveTypeId: varchar("leave_type_id").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  totalDays: numeric("total_days", { precision: 5, scale: 1 }).notNull(),
  isHalfDay: boolean("is_half_day").default(false),
  halfDaySession: text("half_day_session"),
  reason: text("reason"),
  status: leaveStatusEnum("status").notNull().default("pending"),
  approvedBy: varchar("approved_by"),
  approvalNotes: text("approval_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Holidays
export const holidays = pgTable("holidays", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  date: date("date").notNull(),
  location: text("location").notNull().default("all"),
  isOptional: boolean("is_optional").default(false),
  isRestricted: boolean("is_restricted").default(false),
  year: integer("year").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Payroll Runs
export const payrollRuns = pgTable("payroll_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  status: payrollStatusEnum("status").notNull().default("draft"),
  totalEmployees: integer("total_employees").default(0),
  totalGross: numeric("total_gross", { precision: 14, scale: 2 }).default("0"),
  totalDeductions: numeric("total_deductions", { precision: 14, scale: 2 }).default("0"),
  totalNetPay: numeric("total_net_pay", { precision: 14, scale: 2 }).default("0"),
  lockedBy: varchar("locked_by"),
  lockedAt: timestamp("locked_at"),
  unlockReason: text("unlock_reason"),
  notes: text("notes"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Payslips
export const payslips = pgTable("payslips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  payrollRunId: varchar("payroll_run_id").notNull(),
  employeeId: varchar("employee_id").notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),

  // Working days
  totalWorkingDays: integer("total_working_days").default(0),
  presentDays: numeric("present_days", { precision: 5, scale: 1 }).default("0"),
  lopDays: numeric("lop_days", { precision: 5, scale: 1 }).default("0"),

  // Earnings
  basicSalary: numeric("basic_salary", { precision: 12, scale: 2 }).default("0"),
  hra: numeric("hra", { precision: 12, scale: 2 }).default("0"),
  specialAllowance: numeric("special_allowance", { precision: 12, scale: 2 }).default("0"),
  conveyanceAllowance: numeric("conveyance_allowance", { precision: 12, scale: 2 }).default("0"),
  medicalAllowance: numeric("medical_allowance", { precision: 12, scale: 2 }).default("0"),
  otherAllowances: numeric("other_allowances", { precision: 12, scale: 2 }).default("0"),
  bonus: numeric("bonus", { precision: 12, scale: 2 }).default("0"),
  grossSalary: numeric("gross_salary", { precision: 12, scale: 2 }).default("0"),

  // Deductions
  pfEmployee: numeric("pf_employee", { precision: 12, scale: 2 }).default("0"),
  pfEmployer: numeric("pf_employer", { precision: 12, scale: 2 }).default("0"),
  esiEmployee: numeric("esi_employee", { precision: 12, scale: 2 }).default("0"),
  esiEmployer: numeric("esi_employer", { precision: 12, scale: 2 }).default("0"),
  professionalTax: numeric("professional_tax", { precision: 12, scale: 2 }).default("0"),
  tds: numeric("tds", { precision: 12, scale: 2 }).default("0"),
  loanRecovery: numeric("loan_recovery", { precision: 12, scale: 2 }).default("0"),
  otherDeductions: numeric("other_deductions", { precision: 12, scale: 2 }).default("0"),
  lopDeduction: numeric("lop_deduction", { precision: 12, scale: 2 }).default("0"),
  totalDeductions: numeric("total_deductions", { precision: 12, scale: 2 }).default("0"),

  netPay: numeric("net_pay", { precision: 12, scale: 2 }).default("0"),

  adjustments: jsonb("adjustments").default([]),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Statutory Config
export const statutoryConfig = pgTable("statutory_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Documents
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id"),
  name: text("name").notNull(),
  category: text("category").notNull(),
  fileUrl: text("file_url"),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  uploadedBy: varchar("uploaded_by"),
  isPublic: boolean("is_public").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Announcements
export const announcements = pgTable("announcements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").default("general"),
  priority: text("priority").default("normal"),
  visibleTo: text("visible_to").default("all"),
  publishedBy: varchar("published_by"),
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Assets
export const assets = pgTable("assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetCode: text("asset_code").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  serialNumber: text("serial_number"),
  assignedTo: varchar("assigned_to"),
  assignedDate: date("assigned_date"),
  returnedDate: date("returned_date"),
  condition: text("condition").default("good"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================
// Performance Management
// ============================

// Rating Scales
export const ratingScales = pgTable("rating_scales", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull().default("numeric"),
  levels: jsonb("levels").notNull().default([]),
  forcedDistribution: jsonb("forced_distribution"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Performance Cycles
export const performanceCycles = pgTable("performance_cycles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: cycleStatusEnum("status").notNull().default("draft"),
  selfReviewEnabled: boolean("self_review_enabled").default(true),
  managerReviewEnabled: boolean("manager_review_enabled").default(true),
  peerReviewEnabled: boolean("peer_review_enabled").default(false),
  calibrationEnabled: boolean("calibration_enabled").default(false),
  allowMidcycleUpdates: boolean("allow_midcycle_updates").default(true),
  ratingScaleId: varchar("rating_scale_id"),
  eligibilityDepartments: jsonb("eligibility_departments").default([]),
  eligibilityEmploymentTypes: jsonb("eligibility_employment_types").default([]),
  minimumTenureCutoff: date("minimum_tenure_cutoff"),
  goalWeightEnforced: boolean("goal_weight_enforced").default(false),
  selfReviewDeadline: date("self_review_deadline"),
  managerReviewDeadline: date("manager_review_deadline"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Goals / KPIs
export const goals = pgTable("goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  cycleId: varchar("cycle_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("business"),
  metricType: text("metric_type").notNull().default("output"),
  targetValue: text("target_value"),
  unit: text("unit"),
  weight: integer("weight").notNull().default(0),
  startDate: date("start_date"),
  dueDate: date("due_date"),
  status: goalStatusEnum("status").notNull().default("not_started"),
  isApproved: boolean("is_approved").default(false),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  isLocked: boolean("is_locked").default(false),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Goal Progress Updates
export const goalProgressUpdates = pgTable("goal_progress_updates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  goalId: varchar("goal_id").notNull(),
  progressValue: text("progress_value").notNull(),
  note: text("note"),
  updatedBy: varchar("updated_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Reviews (self + manager)
export const reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cycleId: varchar("cycle_id").notNull(),
  employeeId: varchar("employee_id").notNull(),
  selfReview: jsonb("self_review"),
  managerReview: jsonb("manager_review"),
  finalOutcome: jsonb("final_outcome"),
  status: reviewStatusEnum("status").notNull().default("not_started"),
  version: integer("version").notNull().default(1),
  revisions: jsonb("revisions").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Calibration Sessions
export const calibrationSessions = pgTable("calibration_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cycleId: varchar("cycle_id").notNull(),
  departmentId: varchar("department_id"),
  participants: jsonb("participants").default([]),
  adjustments: jsonb("adjustments").default([]),
  notes: text("notes"),
  status: text("status").notNull().default("open"),
  lockedBy: varchar("locked_by"),
  lockedAt: timestamp("locked_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Notifications
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  link: text("link"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Shifts
export const shifts = pgTable("shifts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  graceMinutes: integer("grace_minutes").notNull().default(0),
  weeklyOff: text("weekly_off").array().notNull().default(sql`'{}'::text[]`),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const shiftAssignments = pgTable("shift_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  shiftId: varchar("shift_id").notNull(),
  effectiveFrom: date("effective_from").notNull(),
  effectiveTo: date("effective_to"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Employment History
export const employmentHistory = pgTable("employment_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  changeType: text("change_type").notNull(),
  fieldName: text("field_name").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  effectiveDate: date("effective_date").notNull(),
  changedBy: varchar("changed_by"),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Onboarding Templates
export const onboardingTemplates = pgTable("onboarding_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const onboardingTasks = pgTable("onboarding_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  ownedByRole: text("owned_by_role").notNull().default("hr_admin"),
  dueDaysFromJoin: integer("due_days_from_join").notNull().default(7),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const onboardingInstances = pgTable("onboarding_instances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  templateId: varchar("template_id").notNull(),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const onboardingTaskItems = pgTable("onboarding_task_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  instanceId: varchar("instance_id").notNull(),
  taskId: varchar("task_id").notNull(),
  status: text("status").notNull().default("pending"),
  completedBy: varchar("completed_by"),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  dueDate: date("due_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Audit Logs
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  employeeId: varchar("employee_id"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id"),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  reason: text("reason"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================
// HR/Admin Workspace
// ============================

// Generic Approval Engine
export const approvalWorkflows = pgTable("approval_workflows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  entityType: text("entity_type").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const approvalSteps = pgTable("approval_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workflowId: varchar("workflow_id").notNull(),
  stepOrder: integer("step_order").notNull(),
  approverRole: text("approver_role").notNull().default("ceo_approver"),
  isRequired: boolean("is_required").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const approvalRequests = pgTable("approval_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  workflowId: varchar("workflow_id"),
  currentStepOrder: integer("current_step_order").notNull().default(1),
  status: text("status").notNull().default("pending"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const approvalDecisions = pgTable("approval_decisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  approvalRequestId: varchar("approval_request_id").notNull(),
  stepOrder: integer("step_order").notNull().default(1),
  actorUserId: varchar("actor_user_id").notNull(),
  decision: text("decision").notNull(),
  comment: text("comment"),
  decidedAt: timestamp("decided_at").defaultNow(),
});

// ATS — Recruitment Agencies
export const recruitmentAgencies = pgTable("recruitment_agencies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  gstin: text("gstin"),
  notes: text("notes"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ATS — Pipeline Stages
export const pipelineStages = pgTable("pipeline_stages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  stageOrder: integer("stage_order").notNull(),
  slaDays: integer("sla_days"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// ATS — Job Requisitions
export const jobRequisitions = pgTable("job_requisitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  departmentId: varchar("department_id"),
  location: text("location"),
  band: text("band"),
  employmentType: text("employment_type").notNull().default("full_time"),
  headcount: integer("headcount").notNull().default(1),
  recruiterId: varchar("recruiter_id"),
  hiringTeam: jsonb("hiring_team").default([]),
  jobDescription: text("job_description"),
  skills: text("skills").array().notNull().default(sql`'{}'::text[]`),
  status: text("status").notNull().default("draft"),
  closedAt: timestamp("closed_at"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ATS — Candidates
export const candidates = pgTable("candidates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  location: text("location"),
  noticePeriod: integer("notice_period"),
  currentCtc: numeric("current_ctc", { precision: 12, scale: 2 }),
  expectedCtc: numeric("expected_ctc", { precision: 12, scale: 2 }),
  sourceType: text("source_type").notNull().default("direct"),
  agencyId: varchar("agency_id"),
  resumeUrl: text("resume_url"),
  notes: text("notes"),
  linkedEmployeeId: varchar("linked_employee_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ATS — Applications
export const applications = pgTable("applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  candidateId: varchar("candidate_id").notNull(),
  requisitionId: varchar("requisition_id").notNull(),
  pipelineStageId: varchar("pipeline_stage_id"),
  status: text("status").notNull().default("active"),
  rejectionReasonCode: text("rejection_reason_code"),
  rejectionReasonText: text("rejection_reason_text"),
  lastActivityAt: timestamp("last_activity_at").defaultNow(),
  nextFollowupAt: timestamp("next_followup_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ATS — Application Timeline
export const applicationTimeline = pgTable("application_timeline", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").notNull(),
  actorUserId: varchar("actor_user_id"),
  action: text("action").notNull(),
  comment: text("comment"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

// ATS — Interviews
export const interviews = pgTable("interviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").notNull(),
  roundName: text("round_name").notNull(),
  scheduledStart: timestamp("scheduled_start"),
  scheduledEnd: timestamp("scheduled_end"),
  meetingLink: text("meeting_link"),
  location: text("location"),
  interviewerIds: text("interviewer_ids").array().notNull().default(sql`'{}'::text[]`),
  status: text("status").notNull().default("scheduled"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ATS — Interview Feedback
export const interviewFeedback = pgTable("interview_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  interviewId: varchar("interview_id").notNull(),
  interviewerUserId: varchar("interviewer_user_id").notNull(),
  criteria: jsonb("criteria").default([]),
  overallRecommendation: text("overall_recommendation"),
  notes: text("notes"),
  isLocked: boolean("is_locked").notNull().default(false),
  lockedBy: varchar("locked_by"),
  lockedAt: timestamp("locked_at"),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ATS — Offers
export const offers = pgTable("offers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").notNull(),
  offeredRole: text("offered_role").notNull(),
  joiningDate: date("joining_date"),
  managerId: varchar("manager_id"),
  location: text("location"),
  offeredCtc: numeric("offered_ctc", { precision: 12, scale: 2 }).notNull().default("0"),
  ctcBreakup: jsonb("ctc_breakup").default({}),
  offerLetterUrl: text("offer_letter_url"),
  status: text("status").notNull().default("draft"),
  expiresAt: date("expires_at"),
  notes: text("notes"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Office Admin — Vendors
export const vendors = pgTable("vendors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  gstin: text("gstin"),
  paymentTerms: text("payment_terms"),
  bankDetails: jsonb("bank_details").default({}),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Office Admin — Purchase Requests
export const purchaseRequests = pgTable("purchase_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requesterId: varchar("requester_id").notNull(),
  department: text("department"),
  costCenter: text("cost_center"),
  category: text("category").notNull(),
  items: jsonb("items").notNull().default([]),
  estimatedCost: numeric("estimated_cost", { precision: 12, scale: 2 }),
  neededByDate: date("needed_by_date"),
  status: text("status").notNull().default("draft"),
  invoiceUrl: text("invoice_url"),
  poNumber: text("po_number"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Office Admin — Travel Requests
export const travelRequests = pgTable("travel_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requesterId: varchar("requester_id").notNull(),
  purpose: text("purpose").notNull(),
  fromCity: text("from_city").notNull(),
  toCity: text("to_city").notNull(),
  travelDate: date("travel_date").notNull(),
  returnDate: date("return_date"),
  preferences: text("preferences"),
  estimatedBudget: numeric("estimated_budget", { precision: 12, scale: 2 }),
  status: text("status").notNull().default("draft"),
  notes: text("notes"),
  assignedTo: varchar("assigned_to"),
  assignedToName: text("assigned_to_name"),
  assignedAt: timestamp("assigned_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Office Admin — Travel Bookings
export const travelBookings = pgTable("travel_bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  travelRequestId: varchar("travel_request_id").notNull(),
  type: text("type").notNull(),
  vendorId: varchar("vendor_id"),
  providerName: text("provider_name"),
  pnrOrTicket: text("pnr_or_ticket"),
  departureTime: text("departure_time"),
  arrivalTime: text("arrival_time"),
  checkInDate: text("check_in_date"),
  checkOutDate: text("check_out_date"),
  cost: numeric("cost", { precision: 12, scale: 2 }),
  invoiceUrl: text("invoice_url"),
  paymentReference: text("payment_reference"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Office Admin — Payments
export const workspacePayments = pgTable("workspace_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: varchar("related_entity_id"),
  vendorId: varchar("vendor_id"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  dueDate: date("due_date"),
  invoiceUrls: text("invoice_urls").array().default(sql`'{}'::text[]`),
  status: text("status").notNull().default("requested"),
  paymentReference: text("payment_reference"),
  notes: text("notes"),
  requestedBy: varchar("requested_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Office Admin — Helpdesk Tickets
export const adminTickets = pgTable("admin_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requesterId: varchar("requester_id").notNull(),
  category: text("category").notNull(),
  subject: text("subject").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default("medium"),
  assignedTo: varchar("assigned_to"),
  status: text("status").notNull().default("open"),
  slaDueAt: timestamp("sla_due_at"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const adminTicketComments = pgTable("admin_ticket_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull(),
  authorId: varchar("author_id").notNull(),
  content: text("content").notNull(),
  isInternal: boolean("is_internal").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// HR Ops — Tasks
export const hrTasks = pgTable("hr_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: varchar("related_entity_id"),
  assignedTo: varchar("assigned_to"),
  dueDate: date("due_date"),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("open"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ==================
// Zod Insert Schemas
// ==================

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, lastLogin: true });
export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDepartmentSchema = createInsertSchema(departments).omit({ id: true, createdAt: true });
export const insertDesignationSchema = createInsertSchema(designations).omit({ id: true, createdAt: true });
export const insertSalaryStructureSchema = createInsertSchema(salaryStructures).omit({ id: true, createdAt: true });
export const insertAttendanceSchema = createInsertSchema(attendanceRecords).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRegularizationSchema = createInsertSchema(regularizationRequests).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLeaveTypeSchema = createInsertSchema(leaveTypes).omit({ id: true, createdAt: true });
export const insertLeaveRequestSchema = createInsertSchema(leaveRequests).omit({ id: true, createdAt: true, updatedAt: true });
export const insertHolidaySchema = createInsertSchema(holidays).omit({ id: true, createdAt: true });
export const insertPayrollRunSchema = createInsertSchema(payrollRuns).omit({ id: true, createdAt: true, updatedAt: true, lockedAt: true });
export const insertPayslipSchema = createInsertSchema(payslips).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAnnouncementSchema = createInsertSchema(announcements).omit({ id: true, createdAt: true });
export const insertAssetSchema = createInsertSchema(assets).omit({ id: true, createdAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertLeaveBalanceSchema = createInsertSchema(leaveBalances).omit({ id: true, updatedAt: true });
export const insertLeaveLedgerSchema = createInsertSchema(leaveLedger).omit({ id: true, createdAt: true });

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true, readAt: true });
export const insertShiftSchema = createInsertSchema(shifts).omit({ id: true, createdAt: true });
export const insertShiftAssignmentSchema = createInsertSchema(shiftAssignments).omit({ id: true, createdAt: true });
export const insertEmploymentHistorySchema = createInsertSchema(employmentHistory).omit({ id: true, createdAt: true });
export const insertOnboardingTemplateSchema = createInsertSchema(onboardingTemplates).omit({ id: true, createdAt: true });
export const insertOnboardingTaskSchema = createInsertSchema(onboardingTasks).omit({ id: true, createdAt: true });
export const insertOnboardingInstanceSchema = createInsertSchema(onboardingInstances).omit({ id: true, createdAt: true });
export const insertOnboardingTaskItemSchema = createInsertSchema(onboardingTaskItems).omit({ id: true, createdAt: true });

// Workspace insert schemas
export const insertApprovalWorkflowSchema = createInsertSchema(approvalWorkflows).omit({ id: true, createdAt: true });
export const insertApprovalStepSchema = createInsertSchema(approvalSteps).omit({ id: true, createdAt: true });
export const insertApprovalRequestSchema = createInsertSchema(approvalRequests).omit({ id: true, createdAt: true, resolvedAt: true });
export const insertApprovalDecisionSchema = createInsertSchema(approvalDecisions).omit({ id: true, decidedAt: true });
export const insertRecruitmentAgencySchema = createInsertSchema(recruitmentAgencies).omit({ id: true, createdAt: true });
export const insertPipelineStageSchema = createInsertSchema(pipelineStages).omit({ id: true, createdAt: true });
export const insertJobRequisitionSchema = createInsertSchema(jobRequisitions).omit({ id: true, createdAt: true, updatedAt: true, closedAt: true });
export const insertCandidateSchema = createInsertSchema(candidates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertApplicationSchema = createInsertSchema(applications).omit({ id: true, createdAt: true, updatedAt: true, lastActivityAt: true });
export const insertApplicationTimelineSchema = createInsertSchema(applicationTimeline).omit({ id: true, createdAt: true });
export const insertInterviewSchema = createInsertSchema(interviews).omit({ id: true, createdAt: true });
export const insertInterviewFeedbackSchema = createInsertSchema(interviewFeedback).omit({ id: true, createdAt: true, lockedAt: true, submittedAt: true });
export const insertOfferSchema = createInsertSchema(offers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertVendorSchema = createInsertSchema(vendors).omit({ id: true, createdAt: true });
export const insertPurchaseRequestSchema = createInsertSchema(purchaseRequests).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTravelRequestSchema = createInsertSchema(travelRequests).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTravelBookingSchema = createInsertSchema(travelBookings).omit({ id: true, createdAt: true });
export const insertWorkspacePaymentSchema = createInsertSchema(workspacePayments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAdminTicketSchema = createInsertSchema(adminTickets).omit({ id: true, createdAt: true, updatedAt: true, resolvedAt: true, slaDueAt: true });
export const insertAdminTicketCommentSchema = createInsertSchema(adminTicketComments).omit({ id: true, createdAt: true });
export const insertHrTaskSchema = createInsertSchema(hrTasks).omit({ id: true, createdAt: true, updatedAt: true });

export const insertRatingScaleSchema = createInsertSchema(ratingScales).omit({ id: true, createdAt: true });
export const insertPerformanceCycleSchema = createInsertSchema(performanceCycles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertGoalSchema = createInsertSchema(goals).omit({ id: true, createdAt: true, updatedAt: true, approvedAt: true });
export const insertGoalProgressSchema = createInsertSchema(goalProgressUpdates).omit({ id: true, createdAt: true });
export const insertReviewSchema = createInsertSchema(reviews).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCalibrationSchema = createInsertSchema(calibrationSessions).omit({ id: true, createdAt: true, updatedAt: true, lockedAt: true });

// ==================
// Types
// ==================

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;

export type Department = typeof departments.$inferSelect;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;

export type Designation = typeof designations.$inferSelect;
export type InsertDesignation = z.infer<typeof insertDesignationSchema>;

export type SalaryStructure = typeof salaryStructures.$inferSelect;
export type InsertSalaryStructure = z.infer<typeof insertSalaryStructureSchema>;

export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;

export type RegularizationRequest = typeof regularizationRequests.$inferSelect;
export type InsertRegularization = z.infer<typeof insertRegularizationSchema>;

export type LeaveType = typeof leaveTypes.$inferSelect;
export type InsertLeaveType = z.infer<typeof insertLeaveTypeSchema>;

export type LeaveBalance = typeof leaveBalances.$inferSelect;
export type InsertLeaveBalance = z.infer<typeof insertLeaveBalanceSchema>;

export type LeaveLedgerEntry = typeof leaveLedger.$inferSelect;
export type InsertLeaveLedger = z.infer<typeof insertLeaveLedgerSchema>;

export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type InsertLeaveRequest = z.infer<typeof insertLeaveRequestSchema>;

export type Holiday = typeof holidays.$inferSelect;
export type InsertHoliday = z.infer<typeof insertHolidaySchema>;

export type PayrollRun = typeof payrollRuns.$inferSelect;
export type InsertPayrollRun = z.infer<typeof insertPayrollRunSchema>;

export type Payslip = typeof payslips.$inferSelect;
export type InsertPayslip = z.infer<typeof insertPayslipSchema>;

export type Document = typeof documents.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;

export type Asset = typeof assets.$inferSelect;
export type InsertAsset = z.infer<typeof insertAssetSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;

export type RatingScale = typeof ratingScales.$inferSelect;
export type InsertRatingScale = z.infer<typeof insertRatingScaleSchema>;

export type PerformanceCycle = typeof performanceCycles.$inferSelect;
export type InsertPerformanceCycle = z.infer<typeof insertPerformanceCycleSchema>;

export type Goal = typeof goals.$inferSelect;
export type InsertGoal = z.infer<typeof insertGoalSchema>;

export type GoalProgressUpdate = typeof goalProgressUpdates.$inferSelect;
export type InsertGoalProgress = z.infer<typeof insertGoalProgressSchema>;

export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;

export type CalibrationSession = typeof calibrationSessions.$inferSelect;
export type InsertCalibration = z.infer<typeof insertCalibrationSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type Shift = typeof shifts.$inferSelect;
export type InsertShift = z.infer<typeof insertShiftSchema>;

export type ShiftAssignment = typeof shiftAssignments.$inferSelect;
export type InsertShiftAssignment = z.infer<typeof insertShiftAssignmentSchema>;

export type EmploymentHistory = typeof employmentHistory.$inferSelect;
export type InsertEmploymentHistory = z.infer<typeof insertEmploymentHistorySchema>;

export type OnboardingTemplate = typeof onboardingTemplates.$inferSelect;
export type InsertOnboardingTemplate = z.infer<typeof insertOnboardingTemplateSchema>;

export type OnboardingTask = typeof onboardingTasks.$inferSelect;
export type InsertOnboardingTask = z.infer<typeof insertOnboardingTaskSchema>;

export type OnboardingInstance = typeof onboardingInstances.$inferSelect;
export type InsertOnboardingInstance = z.infer<typeof insertOnboardingInstanceSchema>;

export type OnboardingTaskItem = typeof onboardingTaskItems.$inferSelect;
export type InsertOnboardingTaskItem = z.infer<typeof insertOnboardingTaskItemSchema>;

// Workspace types
export type ApprovalWorkflow = typeof approvalWorkflows.$inferSelect;
export type InsertApprovalWorkflow = z.infer<typeof insertApprovalWorkflowSchema>;
export type ApprovalStep = typeof approvalSteps.$inferSelect;
export type InsertApprovalStep = z.infer<typeof insertApprovalStepSchema>;
export type ApprovalRequest = typeof approvalRequests.$inferSelect;
export type InsertApprovalRequest = z.infer<typeof insertApprovalRequestSchema>;
export type ApprovalDecision = typeof approvalDecisions.$inferSelect;
export type InsertApprovalDecision = z.infer<typeof insertApprovalDecisionSchema>;
export type RecruitmentAgency = typeof recruitmentAgencies.$inferSelect;
export type InsertRecruitmentAgency = z.infer<typeof insertRecruitmentAgencySchema>;
export type PipelineStage = typeof pipelineStages.$inferSelect;
export type InsertPipelineStage = z.infer<typeof insertPipelineStageSchema>;
export type JobRequisition = typeof jobRequisitions.$inferSelect;
export type InsertJobRequisition = z.infer<typeof insertJobRequisitionSchema>;
export type Candidate = typeof candidates.$inferSelect;
export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type Application = typeof applications.$inferSelect;
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type ApplicationTimelineEntry = typeof applicationTimeline.$inferSelect;
export type InsertApplicationTimeline = z.infer<typeof insertApplicationTimelineSchema>;
export type Interview = typeof interviews.$inferSelect;
export type InsertInterview = z.infer<typeof insertInterviewSchema>;
export type InterviewFeedback = typeof interviewFeedback.$inferSelect;
export type InsertInterviewFeedback = z.infer<typeof insertInterviewFeedbackSchema>;
export type Offer = typeof offers.$inferSelect;
export type InsertOffer = z.infer<typeof insertOfferSchema>;
export type Vendor = typeof vendors.$inferSelect;
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type PurchaseRequest = typeof purchaseRequests.$inferSelect;
export type InsertPurchaseRequest = z.infer<typeof insertPurchaseRequestSchema>;
export type TravelRequest = typeof travelRequests.$inferSelect;
export type InsertTravelRequest = z.infer<typeof insertTravelRequestSchema>;
export type TravelBooking = typeof travelBookings.$inferSelect;
export type InsertTravelBooking = z.infer<typeof insertTravelBookingSchema>;
export type WorkspacePayment = typeof workspacePayments.$inferSelect;
export type InsertWorkspacePayment = z.infer<typeof insertWorkspacePaymentSchema>;
export type AdminTicket = typeof adminTickets.$inferSelect;
export type InsertAdminTicket = z.infer<typeof insertAdminTicketSchema>;
export type AdminTicketComment = typeof adminTicketComments.$inferSelect;
export type InsertAdminTicketComment = z.infer<typeof insertAdminTicketCommentSchema>;
export type HrTask = typeof hrTasks.$inferSelect;
export type InsertHrTask = z.infer<typeof insertHrTaskSchema>;

// =============================================================================
// v2 ADDITIONS — Logistics · Vehicles · Zoho · Reimbursements · Requests
//                CEO Approval Notes · Reference Docs
// =============================================================================

// ----- Logistics Movement -----
export const movementLocations = pgTable("movement_locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull().default("internal"),
  city: text("city"),
  address: text("address"),
  contactPerson: text("contact_person"),
  contactPhone: text("contact_phone"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const logisticsMovements = pgTable("logistics_movements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reference: text("reference").notNull(),
  requesterId: varchar("requester_id").notNull(),
  fromLocationId: varchar("from_location_id"),
  fromLocationText: text("from_location_text"),
  toLocationId: varchar("to_location_id"),
  toLocationText: text("to_location_text"),
  isIntercity: boolean("is_intercity").default(false),
  movementType: text("movement_type").notNull().default("parts"),
  items: jsonb("items").notNull().default([]),
  totalWeightKg: numeric("total_weight_kg", { precision: 12, scale: 3 }),
  totalVolumeCbm: numeric("total_volume_cbm", { precision: 12, scale: 4 }),
  totalQuantity: integer("total_quantity"),
  requestedDate: date("requested_date"),
  priority: text("priority").notNull().default("normal"),
  status: text("status").notNull().default("submitted"),
  assignedToId: varchar("assigned_to_id"),
  escalatedToId: varchar("escalated_to_id"),
  carrier: text("carrier"),
  trackingNumber: text("tracking_number"),
  estimatedCost: numeric("estimated_cost", { precision: 12, scale: 2 }),
  receivedById: varchar("received_by_id"),
  receivedAt: timestamp("received_at"),
  area: text("area"),
  notes: text("notes"),
  attachments: jsonb("attachments").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const movementEvents = pgTable("movement_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  movementId: varchar("movement_id").notNull(),
  actorId: varchar("actor_id"),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ----- Company Vehicles -----
export const companyVehicles = pgTable("company_vehicles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  registrationNo: text("registration_no"),
  model: text("model"),
  baseLocation: text("base_location"),
  driverName: text("driver_name"),
  driverPhone: text("driver_phone"),
  imageUrl: text("image_url"), // data-URL or link for the vehicle photo
  fuelType: text("fuel_type"), // Petrol | Diesel | Electric | CNG | Hybrid
  transmission: text("transmission"), // Manual | Automatic
  seatingCapacity: integer("seating_capacity"),
  driverUserId: varchar("driver_user_id"), // employee assigned as driver (HR-set)
  status: text("status").notNull().default("active"), // active | maintenance
  createdAt: timestamp("created_at").defaultNow(),
});

export const vehicleBookings = pgTable("vehicle_bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id").notNull(),
  requesterId: varchar("requester_id").notNull(),
  purpose: text("purpose").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  pickupLocation: text("pickup_location"),
  dropLocation: text("drop_location"),
  passengers: integer("passengers").default(1),
  // "company_car" = the single shared company vehicle (direct, instant booking);
  // "rental" = external agency car, requires HR approval before it's confirmed.
  bookingType: text("booking_type").notNull().default("company_car"),
  // company_car trip type: "inter_city" (blocks the whole 7AM–7PM day) or "intra_city" (3-hour blocks).
  tripType: text("trip_type"),
  // Effective blocked window for the company car (actual booking = startTime..endTime; the block can extend further).
  blockStart: timestamp("block_start"),
  blockEnd: timestamp("block_end"),
  // company_car: confirmed | cancelled.  rental: pending_hr_approval | approved | rejected | cancelled.
  status: text("status").notNull().default("confirmed"),
  // Passenger/attendee list — array of { userId, name }. Powers "appears in My Bookings of all passengers".
  attendees: jsonb("attendees").default([]),
  // When a >4-passenger booking is split, the company_car and rental rows point at each other.
  linkedBookingId: varchar("linked_booking_id"),
  // All legs of one submission (one or more company cars + an overflow rental) share this id,
  // so the trip can be cancelled as a unit.
  groupId: varchar("group_id"),
  approvedById: varchar("approved_by_id"),
  decisionNote: text("decision_note"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ----- Zoho Books Sync -----
export const zohoConfig = pgTable("zoho_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text("organization_id"),
  region: text("region").default("in"),
  refreshToken: text("refresh_token"),
  clientId: text("client_id"),
  clientSecret: text("client_secret"),
  enabled: boolean("enabled").notNull().default(false),
  defaultExpenseAccountId: text("default_expense_account_id"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const zohoSyncJobs = pgTable("zoho_sync_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceType: text("source_type").notNull(),
  sourceId: varchar("source_id").notNull(),
  zohoEntity: text("zoho_entity").notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  zohoRecordId: text("zoho_record_id"),
  zohoNumber: text("zoho_number"),
  requestPayload: jsonb("request_payload"),
  responsePayload: jsonb("response_payload"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ----- Reimbursements -----
export const reimbursements = pgTable("reimbursements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reference: text("reference").notNull(),
  requesterId: varchar("requester_id").notNull(),
  category: text("category").notNull(),
  lines: jsonb("lines").notNull().default([]),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("INR"),
  status: text("status").notNull().default("submitted"),
  description: text("description"),
  invoiceNumber: text("invoice_number"),
  invoiceDate: date("invoice_date"),
  invoiceUrl: text("invoice_url"),
  // Expense claim details
  businessPurpose: text("business_purpose"),
  periodFrom: date("period_from"),
  periodTo: date("period_to"),
  cashAdvance: numeric("cash_advance", { precision: 12, scale: 2 }).default("0"),
  // Snapshot of claimant context (auto-filled server-side, shown to approvers)
  employeeName: text("employee_name"),
  employeeCode: text("employee_code"),
  department: text("department"),
  hodName: text("hod_name"),
  // Stage 1 — Finance review
  financeApprovedById: varchar("finance_approved_by_id"),
  financeNote: text("finance_note"),
  financeDecisionAt: timestamp("finance_decision_at"),
  // Stage 2 — CEO final approval
  approvedById: varchar("approved_by_id"),
  decisionNote: text("decision_note"),
  zohoExpenseId: text("zoho_expense_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ----- Office Purchases (small items HR orders for employees: triage -> CEO approval -> order -> deliver) -----
export const officePurchases = pgTable("office_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reference: text("reference").notNull(),
  requesterId: varchar("requester_id").notNull(),
  // [{ description, quantity, suggestedLinks: string[], finalLink, unitPrice }] — HR fills finalLink + unitPrice
  items: jsonb("items").notNull().default([]),
  priority: text("priority").notNull().default("medium"),        // low | medium | high (set by HR)
  isDirect: boolean("is_direct").notNull().default(false),        // HR flagged "send for direct approval"
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("pending_hr"),         // pending_hr -> pending_approval -> approved -> ordered -> delivered (+ rejected/cancelled)
  justification: text("justification"),
  // Claimant snapshot (server-stamped)
  employeeName: text("employee_name"),
  employeeCode: text("employee_code"),
  department: text("department"),
  // HR triage stage
  reviewedById: varchar("reviewed_by_id"),
  reviewNote: text("review_note"),
  reviewedAt: timestamp("reviewed_at"),
  // CEO approval stage
  approvedById: varchar("approved_by_id"),
  decisionNote: text("decision_note"),
  decidedAt: timestamp("decided_at"),
  // Fulfillment
  orderPlacedById: varchar("order_placed_by_id"),
  expectedDeliveryDate: date("expected_delivery_date"),           // optional ETA HR sets when placing the order
  orderInfo: text("order_info"),                                  // tracking / courier / order id
  orderPlacedAt: timestamp("order_placed_at"),
  deliveredById: varchar("delivered_by_id"),
  deliveredAt: timestamp("delivered_at"),
  linkedTicketId: varchar("linked_ticket_id"),                    // set when the employee flags a delivery issue
  batchId: varchar("batch_id"),                                   // groups requests HR sent to the CEO together (one bulk-approval card)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ----- Unified Request Intake -----
export const requests = pgTable("requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reference: text("reference").notNull(),
  requesterId: varchar("requester_id").notNull(),
  type: text("type").notNull(),
  routeToTeam: text("route_to_team").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  itemLink: text("item_link"),
  itemPhotoUrl: text("item_photo_url"),
  quantity: integer("quantity").default(1),
  estimatedCost: numeric("estimated_cost", { precision: 12, scale: 2 }),
  neededByDate: date("needed_by_date"),
  priority: text("priority").notNull().default("normal"),
  status: text("status").notNull().default("submitted"),
  assignedToId: varchar("assigned_to_id"),
  resolutionNote: text("resolution_note"),
  attachments: jsonb("attachments").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const requestComments = pgTable("request_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").notNull(),
  authorId: varchar("author_id").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ----- CEO Approval Notes -----
export const ceoApprovalNotes = pgTable("ceo_approval_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reference: text("reference").notNull(),
  raisedByTeam: text("raised_by_team").notNull(),
  raisedById: varchar("raised_by_id").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  linkedRequestIds: jsonb("linked_request_ids").notNull().default([]),
  totalEstimatedCost: numeric("total_estimated_cost", { precision: 12, scale: 2 }),
  status: text("status").notNull().default("pending"),
  decidedById: varchar("decided_by_id"),
  decisionNote: text("decision_note"),
  decidedAt: timestamp("decided_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ----- Reference Docs (Policies, Calendar, Quality) -----
export const referenceDocs = pgTable("reference_docs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  section: text("section").notNull(),
  title: text("title").notNull(),
  summaryNote: text("summary_note"),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  uploadedBy: varchar("uploaded_by"),
  year: integer("year"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ----- Insert schemas & types for v2 -----
export const insertMovementLocationSchema = createInsertSchema(movementLocations).omit({ id: true, createdAt: true });
export const insertLogisticsMovementSchema = createInsertSchema(logisticsMovements).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMovementEventSchema = createInsertSchema(movementEvents).omit({ id: true, createdAt: true });
export const insertCompanyVehicleSchema = createInsertSchema(companyVehicles).omit({ id: true, createdAt: true });
export const insertVehicleBookingSchema = createInsertSchema(vehicleBookings).omit({ id: true, createdAt: true });
export const insertReimbursementSchema = createInsertSchema(reimbursements).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOfficePurchaseSchema = createInsertSchema(officePurchases).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRequestSchema = createInsertSchema(requests).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRequestCommentSchema = createInsertSchema(requestComments).omit({ id: true, createdAt: true });
export const insertCeoApprovalNoteSchema = createInsertSchema(ceoApprovalNotes).omit({ id: true, createdAt: true });
export const insertReferenceDocSchema = createInsertSchema(referenceDocs).omit({ id: true, createdAt: true, updatedAt: true });

export type MovementLocation = typeof movementLocations.$inferSelect;
export type LogisticsMovement = typeof logisticsMovements.$inferSelect;
export type MovementEvent = typeof movementEvents.$inferSelect;
export type CompanyVehicle = typeof companyVehicles.$inferSelect;
export type VehicleBooking = typeof vehicleBookings.$inferSelect;
export type Reimbursement = typeof reimbursements.$inferSelect;
export type OfficePurchase = typeof officePurchases.$inferSelect;
export type Request_ = typeof requests.$inferSelect;
export type RequestComment = typeof requestComments.$inferSelect;
export type CeoApprovalNote = typeof ceoApprovalNotes.$inferSelect;
export type ReferenceDoc = typeof referenceDocs.$inferSelect;
export type ZohoSyncJob = typeof zohoSyncJobs.$inferSelect;
