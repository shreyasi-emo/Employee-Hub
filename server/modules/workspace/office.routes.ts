import type { Express, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { db, pool } from "../../db";
import { storage } from "../../storage";
import { eq } from "drizzle-orm";
import { users, roleEnum } from "@shared/schema";
import {
  requireAuth, requireHR, requireAdmin, requireRole,
  requireWorkspace, requireCEO, requireLogistics, requireTeamHandler,
  hasRole, hashPassword, verifyPassword,
} from "../../shared/auth";
import { log, hashToken } from "../../shared/audit";
import { getDaysInMonth, countWeekends } from "../../shared/date-utils";
import { sanitizeEmployeeForRole } from "../../utils/sanitize";
import { googleStart, googleCallback, logout as googleLogout } from "../../google-auth";
import {
  insertEmployeeSchema, insertDepartmentSchema, insertDesignationSchema,
  insertSalaryStructureSchema, insertAttendanceSchema, insertRegularizationSchema,
  insertLeaveTypeSchema, insertLeaveRequestSchema, insertHolidaySchema,
  insertPayrollRunSchema, insertAnnouncementSchema, insertAssetSchema,
  insertRatingScaleSchema, insertPerformanceCycleSchema, insertGoalSchema,
  insertGoalProgressSchema, insertReviewSchema, insertCalibrationSchema,
  insertShiftSchema, insertShiftAssignmentSchema, insertOnboardingTemplateSchema, insertOnboardingTaskSchema,
} from "@shared/schema";

export function registerWorkspaceOfficeRoutes(app: Express) {
  app.get("/api/workspace/vendors", requireAuth, requireWorkspace, async (req, res) => {
    res.json(await storage.getVendors(req.query.category as string));
  });
  app.post("/api/workspace/vendors", requireAuth, requireWorkspace, async (req, res) => {
    res.json(await storage.createVendor(req.body));
  });
  app.put("/api/workspace/vendors/:id", requireAuth, requireWorkspace, async (req, res) => {
    const roles = ["super_admin", "hr_admin", "hr_executive", "finance"];
    if (!roles.includes(req.currentUser!.role)) return res.status(403).json({ error: "Access denied" });
    res.json(await storage.updateVendor(req.params.id, req.body));
  });

  // ===== PURCHASE REQUESTS =====
  app.get("/api/workspace/purchase-requests", requireAuth, requireWorkspace, async (req, res) => {
    const { status } = req.query;
    res.json(await storage.getPurchaseRequests(undefined, status as string));
  });
  app.post("/api/workspace/purchase-requests", requireAuth, requireWorkspace, async (req, res) => {
    // Status/approver are server-controlled — a workspace role can't create a pre-approved request.
    const { status, approvedById, approvedAt, id, createdAt, updatedAt, ...safe } = req.body;
    res.json(await storage.createPurchaseRequest({ ...safe, requesterId: req.currentUser!.id, status: "draft" }));
  });
  app.put("/api/workspace/purchase-requests/:id", requireAuth, requireWorkspace, async (req, res) => {
    const { status, approvedById, approvedAt, id, createdAt, updatedAt, ...safe } = req.body;
    res.json(await storage.updatePurchaseRequest(req.params.id, safe));
  });
  app.post("/api/workspace/purchase-requests/:id/submit", requireAuth, requireWorkspace, async (req, res) => {
    const pr = await storage.getPurchaseRequest(req.params.id);
    if (!pr) return res.status(404).json({ error: "Not found" });
    await storage.updatePurchaseRequest(req.params.id, { status: "pending_ceo" });
    const wf = await storage.getDefaultWorkflow("purchase_request");
    const approval = await storage.createApprovalRequest({ entityType: "purchase_request", entityId: req.params.id, workflowId: wf?.id, createdBy: req.currentUser!.id });
    try {
      const ceoUsers = (await storage.getAllUsers()).filter((u: any) => ["ceo_approver", "super_admin"].includes(u.role));
      for (const ceo of ceoUsers) {
        await storage.createNotification({ userId: ceo.id, type: "approval_pending", title: "Purchase Request for Approval", body: `Purchase request "${pr.category}" submitted for approval.`, link: "/workspace/approvals" });
      }
    } catch {}
    res.json({ approval });
  });

  // ===== TRAVEL REQUESTS =====
  app.get("/api/workspace/travel-requests", requireAuth, requireWorkspace, async (req, res) => {
    const { status } = req.query;
    res.json(await storage.getTravelRequests(undefined, status as string));
  });
  app.post("/api/workspace/travel-requests", requireAuth, requireWorkspace, async (req, res) => {
    const { status, approvedById, approvedAt, id, createdAt, updatedAt, ...safe } = req.body;
    res.json(await storage.createTravelRequest({ ...safe, requesterId: req.currentUser!.id, status: "draft" }));
  });
  app.put("/api/workspace/travel-requests/:id", requireAuth, requireWorkspace, async (req, res) => {
    const { status, approvedById, approvedAt, id, createdAt, updatedAt, ...safe } = req.body;
    res.json(await storage.updateTravelRequest(req.params.id, safe));
  });
  app.post("/api/workspace/travel-requests/:id/submit", requireAuth, requireWorkspace, async (req, res) => {
    const tr = await storage.getTravelRequest(req.params.id);
    if (!tr) return res.status(404).json({ error: "Not found" });
    await storage.updateTravelRequest(req.params.id, { status: "pending_ceo" });
    const wf = await storage.getDefaultWorkflow("travel_request");
    const approval = await storage.createApprovalRequest({ entityType: "travel_request", entityId: req.params.id, workflowId: wf?.id, createdBy: req.currentUser!.id });
    try {
      const ceoUsers = (await storage.getAllUsers()).filter((u: any) => ["ceo_approver", "super_admin"].includes(u.role));
      for (const ceo of ceoUsers) {
        await storage.createNotification({ userId: ceo.id, type: "approval_pending", title: "Travel Request for Approval", body: `Travel to ${tr.toCity} submitted for approval.`, link: "/workspace/approvals" });
      }
    } catch {}
    res.json({ approval });
  });

  app.post("/api/workspace/travel-requests/:id/assign", requireAuth, requireWorkspace, async (req, res) => {
    const { assignedTo } = req.body;
    if (!assignedTo) return res.status(400).json({ error: "assignedTo is required" });
    const tr = await storage.getTravelRequest(req.params.id);
    if (!tr) return res.status(404).json({ error: "Not found" });
    const assignee = await storage.getUser(assignedTo);
    if (!assignee) return res.status(404).json({ error: "Assignee user not found" });
    const assigneeName = assignee.username;
    const updated = await storage.updateTravelRequest(req.params.id, {
      assignedTo,
      assignedToName: assigneeName,
      assignedAt: new Date(),
    });
    try {
      await storage.createNotification({
        userId: assignedTo,
        type: "task_assigned",
        title: "Travel Booking Assigned to You",
        body: `You have been assigned to handle the travel booking: ${tr.fromCity} → ${tr.toCity} (${tr.purpose}).`,
        link: "/workspace/office",
      });
    } catch {}
    res.json(updated);
  });

  app.get("/api/workspace/travel-bookings/:travelRequestId", requireAuth, requireWorkspace, async (req, res) => {
    res.json(await storage.getTravelBookings(req.params.travelRequestId));
  });
  app.post("/api/workspace/travel-bookings", requireAuth, requireWorkspace, async (req, res) => {
    const booking = await storage.createTravelBooking(req.body);

    try {
      const tr = await storage.getTravelRequest(req.body.travelRequestId);
      if (tr) {
        const requesterUser = await storage.getUser(tr.requesterId);
        const typeLabel = req.body.type === "flight" ? "Flight" : "Hotel";
        const providerName = req.body.providerName || "";
        const pnrOrTicket = req.body.pnrOrTicket || "";

        let detailLines: string[] = [];
        if (req.body.type === "flight") {
          if (providerName) detailLines.push(`Airline: ${providerName}`);
          if (pnrOrTicket) detailLines.push(`PNR / Ticket: ${pnrOrTicket}`);
          if (req.body.departureTime) detailLines.push(`Departure: ${req.body.departureTime}`);
          if (req.body.arrivalTime) detailLines.push(`Arrival: ${req.body.arrivalTime}`);
        } else {
          if (providerName) detailLines.push(`Hotel: ${providerName}`);
          if (pnrOrTicket) detailLines.push(`Booking Ref: ${pnrOrTicket}`);
          if (req.body.checkInDate) detailLines.push(`Check-in: ${req.body.checkInDate}`);
          if (req.body.checkOutDate) detailLines.push(`Check-out: ${req.body.checkOutDate}`);
        }
        if (req.body.cost) detailLines.push(`Cost: ₹${Number(req.body.cost).toLocaleString("en-IN")}`);
        if (req.body.notes) detailLines.push(`Notes: ${req.body.notes}`);

        const detailSummary = detailLines.join(" | ");
        const notifBody = `Your ${typeLabel} booking has been confirmed for ${tr.fromCity} → ${tr.toCity}. ${detailSummary}`;

        if (requesterUser) {
          await storage.createNotification({
            userId: requesterUser.id,
            type: "booking_confirmed",
            title: `${typeLabel} Booking Confirmed`,
            body: notifBody,
            link: "/my-requests",
          });

          const emp = requesterUser.employeeId ? await storage.getEmployee(requesterUser.employeeId) : null;
          const recipientEmail = emp?.email;
          if (recipientEmail && process.env.SENDGRID_API_KEY) {
            try {
              const sgMail = (await import("@sendgrid/mail")).default;
              sgMail.setApiKey(process.env.SENDGRID_API_KEY);
              const htmlDetails = detailLines.map(l => `<li>${l}</li>`).join("");
              await sgMail.send({
                to: recipientEmail,
                from: process.env.SENDGRID_FROM_EMAIL || "noreply@emoenergy.com",
                subject: `Your ${typeLabel} Booking is Confirmed — ${tr.fromCity} → ${tr.toCity}`,
                html: `<p>Dear ${emp?.firstName || "Team"},</p>
                  <p>Your <strong>${typeLabel} booking</strong> has been confirmed for your trip from <strong>${tr.fromCity}</strong> to <strong>${tr.toCity}</strong>.</p>
                  <ul>${htmlDetails}</ul>
                  <p>If you have any questions, please contact the Office Admin team.</p>
                  <p>Regards,<br/>EMO Energy Office Admin</p>`,
              });
            } catch (emailErr) {
              console.error("Email send failed:", emailErr);
            }
          }
        }
      }
    } catch (notifErr) {
      console.error("Post-booking notification failed:", notifErr);
    }

    res.json(booking);
  });

  // ===== WORKSPACE PAYMENTS =====
  app.get("/api/workspace/payments", requireAuth, requireWorkspace, async (req, res) => {
    res.json(await storage.getWorkspacePayments(req.query.status as string));
  });
  app.post("/api/workspace/payments", requireAuth, requireWorkspace, async (req, res) => {
    // status/paid/approval fields are server-controlled (DB default "requested"); never accept them here.
    const { status, paidById, paidBy, paidAt, approvedById, approvedAt, id, createdAt, updatedAt, ...safe } = req.body;
    res.json(await storage.createWorkspacePayment({ ...safe, requestedBy: req.currentUser!.id }));
  });
  app.put("/api/workspace/payments/:id", requireAuth, requireWorkspace, async (req, res) => {
    const { status, paidById, paidBy, paidAt, approvedById, approvedAt, id, createdAt, updatedAt, ...safe } = req.body;
    res.json(await storage.updateWorkspacePayment(req.params.id, safe));
  });
  app.post("/api/workspace/payments/:id/submit", requireAuth, requireWorkspace, async (req, res) => {
    const pay = await storage.getWorkspacePayments();
    const p = (pay as any[]).find((p: any) => p.id === req.params.id);
    await storage.updateWorkspacePayment(req.params.id, { status: "pending_ceo" });
    const wf = await storage.getDefaultWorkflow("payment");
    const approval = await storage.createApprovalRequest({ entityType: "payment", entityId: req.params.id, workflowId: wf?.id, createdBy: req.currentUser!.id });
    try {
      const ceoUsers = (await storage.getAllUsers()).filter((u: any) => ["ceo_approver", "super_admin"].includes(u.role));
      for (const ceo of ceoUsers) {
        await storage.createNotification({ userId: ceo.id, type: "approval_pending", title: "Payment for Approval", body: `Payment request submitted for approval.`, link: "/workspace/approvals" });
      }
    } catch {}
    res.json({ approval });
  });

  // ===== ADMIN HELPDESK =====
  app.get("/api/workspace/tickets", requireAuth, requireWorkspace, async (req, res) => {
    const { status } = req.query;
    res.json(await storage.getAdminTickets(undefined, status as string));
  });
  app.post("/api/workspace/tickets", requireAuth, async (req, res) => {
    res.json(await storage.createAdminTicket({ ...req.body, requesterId: req.currentUser!.id }));
  });
  app.put("/api/workspace/tickets/:id", requireAuth, requireWorkspace, async (req, res) => {
    const updated = await storage.updateAdminTicket(req.params.id, req.body);
    try {
      if (req.body.status && updated?.requesterId) {
        await storage.notifyUser(updated.requesterId, {
          type: ["resolved", "closed", "done"].includes(req.body.status) ? "ticket_resolved" : "ticket_updated",
          title: `Ticket ${req.body.status.replace(/_/g, " ")}`,
          body: `Your ticket "${updated.subject || "request"}" is now ${req.body.status.replace(/_/g, " ")}.`,
          link: "/my-requests?tab=tickets",
        });
      }
    } catch {}
    res.json(updated);
  });
  app.get("/api/workspace/tickets/:id/comments", requireAuth, requireWorkspace, async (req, res) => {
    res.json(await storage.getAdminTicketComments(req.params.id));
  });
  app.post("/api/workspace/tickets/:id/comments", requireAuth, requireWorkspace, async (req, res) => {
    res.json(await storage.addAdminTicketComment({ ticketId: req.params.id, authorId: req.currentUser!.id, content: req.body.content, isInternal: req.body.isInternal || false }));
  });

  // ===== HR TASKS =====
}
