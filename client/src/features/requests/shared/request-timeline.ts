import { formatDate } from "./request-format";
// Builds the approval timeline steps for a request, per type.
// Vertical approval timeline tailored per request type.
export function buildTimeline(type: string, item: any) {
  const s = item.status;
  const d = (x: any) => (x ? formatDate(x) : null);
  let steps: { label: string; date: any }[];
  let active: number;
  if (type === "reimbursement") {
    steps = [
      { label: "Submitted", date: d(item.createdAt) },
      { label: "Finance Review", date: d(item.financeDecisionAt) },
      { label: "Final Approval (CEO)", date: s === "approved" ? d(item.updatedAt) : null },
      { label: "Completed", date: s === "approved" ? d(item.updatedAt) : null },
    ];
    active = s === "approved" ? 4 : s === "finance_approved" ? 2 : s === "rejected" ? (item.approvedById ? 2 : 1) : 1;
  } else if (type === "ticket") {
    steps = [
      { label: "Opened", date: d(item.createdAt) },
      { label: "In Progress", date: null },
      { label: "Resolved", date: ["resolved", "done", "closed"].includes(s) ? d(item.updatedAt) : null },
    ];
    active = ["resolved", "done", "closed"].includes(s) ? 3 : ["in_progress", "need_info"].includes(s) ? 1 : 0;
  } else {
    const finalDone = ["ordered", "fulfilled", "booked", "completed"].includes(s);
    steps = [
      { label: "Submitted", date: d(item.createdAt) },
      { label: "CEO Approval", date: ["approved", ...["ordered", "fulfilled", "booked", "completed"]].includes(s) ? d(item.updatedAt) : null },
      { label: "Completed", date: finalDone ? d(item.updatedAt) : null },
    ];
    active = finalDone ? 3 : s === "approved" ? 2 : s === "rejected" ? 1 : ["submitted", "pending_ceo", "changes_requested"].includes(s) ? 1 : 0;
  }
  const cancelled = s === "cancelled";
  return steps.map((st, i) => {
    let state: "done" | "current" | "upcoming" | "rejected" = i < active ? "done" : i === active ? "current" : "upcoming";
    if (s === "rejected" && i === active) state = "rejected";
    if (cancelled) state = i === 0 ? "done" : "upcoming";
    return { ...st, state };
  });
}
