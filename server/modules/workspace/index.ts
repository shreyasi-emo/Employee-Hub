// HR/Admin Workspace barrel: approval engine + ATS + office admin + HR tasks.
import type { Express } from "express";
import { registerWorkspaceApprovalsRoutes } from "./approvals.routes";
import { registerWorkspaceAtsRoutes } from "./ats.routes";
import { registerWorkspaceOfficeRoutes } from "./office.routes";
import { registerWorkspaceHrTasksRoutes } from "./hr-tasks.routes";

export function registerWorkspaceRoutes(app: Express) {
  registerWorkspaceApprovalsRoutes(app);
  registerWorkspaceAtsRoutes(app);
  registerWorkspaceOfficeRoutes(app);
  registerWorkspaceHrTasksRoutes(app);
}
