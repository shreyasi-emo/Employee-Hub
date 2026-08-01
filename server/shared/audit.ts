// Shared audit-log + token helpers used across feature modules.
import type { Request } from "express";
import crypto from "crypto";
import { storage } from "../storage";

/** SHA-256 hash for invite/reset tokens (raw tokens are never stored). */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Best-effort audit trail for sensitive mutations (and salary/payslip views). */
export async function log(
  req: Request,
  action: string,
  entityType: string,
  entityId?: string,
  oldVal?: any,
  newVal?: any,
  reason?: string,
) {
  try {
    await storage.addAuditLog({
      userId: req.currentUser?.id,
      employeeId: req.currentUser?.employeeId ?? undefined,
      action,
      entityType,
      entityId,
      oldValue: oldVal,
      newValue: newVal,
      reason,
      ipAddress: req.ip,
    });
  } catch {}
}
