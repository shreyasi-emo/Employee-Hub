// HR/Admin Workspace barrel: approval engine + office admin.
import type { Express } from "express";
import { registerWorkspaceApprovalsRoutes } from "./approvals.routes";
import { registerWorkspaceOfficeRoutes } from "./office.routes";

export function registerWorkspaceRoutes(app: Express) {
  registerWorkspaceApprovalsRoutes(app);
  registerWorkspaceOfficeRoutes(app);
}
