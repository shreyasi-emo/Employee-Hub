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
import { registerAnnouncementRoutes } from "../modules/announcements/announcements.routes";
import { registerAuditRoutes } from "../modules/audit/audit.routes";
import { registerDashboardRoutes } from "../modules/dashboard/dashboard.routes";
import { registerUserRoutes } from "../modules/users/users.routes";
import { registerNotificationRoutes } from "../modules/notifications/notifications.routes";
import { registerWorkspaceRoutes } from "../modules/workspace";
import { registerMyRequestsRoutes } from "../modules/my-requests/my-requests.routes";
import { registerTeamRequestsRoutes } from "../modules/team-requests/team-requests.routes";

import { registerLogisticsRoutes } from "../modules/logistics/logistics.routes";
import { registerVehicleRoutes } from "../modules/vehicles/vehicles.routes";
import { registerReimbursementRoutes } from "../modules/reimbursements/reimbursements.routes";
import { registerOfficePurchaseRoutes } from "../modules/office-purchases/office-purchases.routes";
import { registerProcurementRoutes } from "../modules/procurement/procurement.routes";
import { registerTravelRoutes } from "../modules/travel/travel.routes";
import { registerRequestRoutes } from "../modules/requests/requests.routes";
import { registerReferenceDocRoutes } from "../modules/reference-docs/reference-docs.routes";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  applySession(app);

  // Core HRIS
  registerAuthRoutes(app);
  registerEmployeeRoutes(app);
  registerAttendanceRoutes(app);
  registerLeaveRoutes(app);
  registerHolidayRoutes(app);
  registerAnnouncementRoutes(app);
  registerAuditRoutes(app);
  registerDashboardRoutes(app);
  registerUserRoutes(app);
  registerNotificationRoutes(app);

  // HR/Admin Workspace + company requests
  registerWorkspaceRoutes(app);
  registerMyRequestsRoutes(app);
  registerTeamRequestsRoutes(app);

  // Company workspace v2: logistics, vehicles, reimbursements, requests, reference docs
  registerLogisticsRoutes(app);
  registerVehicleRoutes(app);
  registerReimbursementRoutes(app);
  registerOfficePurchaseRoutes(app);
  registerProcurementRoutes(app);
  registerTravelRoutes(app);
  registerRequestRoutes(app);
  registerReferenceDocRoutes(app);

  return httpServer;
}
