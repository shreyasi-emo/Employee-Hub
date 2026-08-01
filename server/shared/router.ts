// Central route registry. Applies the session middleware, then mounts every
// feature module. Replaces the old monolithic registerRoutes/registerV2Routes.
import type { Express } from "express";
import type { Server } from "http";
import { applySession } from "./session";

import { registerAuthRoutes } from "../modules/auth/auth.routes";
import { registerEmployeeRoutes } from "../modules/employees/employees.routes";
import { registerAttendanceRoutes } from "../modules/attendance/attendance.routes";
import { registerLeaveRoutes } from "../modules/leave/leave.routes";
import { registerHolidayRoutes } from "../modules/holidays/holidays.routes";
import { registerPayrollRoutes } from "../modules/payroll/payroll.routes";
import { registerAnnouncementRoutes } from "../modules/announcements/announcements.routes";
import { registerAssetRoutes } from "../modules/assets/assets.routes";
import { registerAuditRoutes } from "../modules/audit/audit.routes";
import { registerDashboardRoutes } from "../modules/dashboard/dashboard.routes";
import { registerUserRoutes } from "../modules/users/users.routes";
import { registerPerformanceRoutes } from "../modules/performance/performance.routes";
import { registerNotificationRoutes } from "../modules/notifications/notifications.routes";
import { registerShiftRoutes } from "../modules/shifts/shifts.routes";
import { registerOnboardingRoutes } from "../modules/onboarding/onboarding.routes";
import { registerWorkspaceRoutes } from "../modules/workspace";
import { registerMyRequestsRoutes } from "../modules/my-requests/my-requests.routes";
import { registerTeamRequestsRoutes } from "../modules/team-requests/team-requests.routes";

import { registerLogisticsRoutes } from "../modules/logistics/logistics.routes";
import { registerVehicleRoutes } from "../modules/vehicles/vehicles.routes";
import { registerReimbursementRoutes } from "../modules/reimbursements/reimbursements.routes";
import { registerRequestRoutes } from "../modules/requests/requests.routes";
import { registerApprovalNotesRoutes } from "../modules/approval-notes/approval-notes.routes";
import { registerReferenceDocRoutes } from "../modules/reference-docs/reference-docs.routes";
import { registerZohoRoutes } from "../modules/zoho/zoho.routes";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  applySession(app);

  // Core HRIS
  registerAuthRoutes(app);
  registerEmployeeRoutes(app);
  registerAttendanceRoutes(app);
  registerLeaveRoutes(app);
  registerHolidayRoutes(app);
  registerPayrollRoutes(app);
  registerAnnouncementRoutes(app);
  registerAssetRoutes(app);
  registerAuditRoutes(app);
  registerDashboardRoutes(app);
  registerUserRoutes(app);
  registerPerformanceRoutes(app);
  registerNotificationRoutes(app);
  registerShiftRoutes(app);
  registerOnboardingRoutes(app);

  // HR/Admin Workspace + company requests
  registerWorkspaceRoutes(app);
  registerMyRequestsRoutes(app);
  registerTeamRequestsRoutes(app);

  // v2: logistics, vehicles, reimbursements, requests, approval notes, ref docs, zoho
  registerLogisticsRoutes(app);
  registerVehicleRoutes(app);
  registerReimbursementRoutes(app);
  registerRequestRoutes(app);
  registerApprovalNotesRoutes(app);
  registerReferenceDocRoutes(app);
  registerZohoRoutes(app);

  return httpServer;
}
