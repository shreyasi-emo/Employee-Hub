// Single source of truth for request/approval status colors + labels.
// Brand colors only — Blue (in-flight/pending), Teal (success/end), Coral (negative), Grey (inactive).
const GREY = "bg-[#64748B]/15 text-[#64748B]";
const BLUE = "bg-[#206295]/15 text-[#206295]";
const TEAL = "bg-[#4BDCD9]/25 text-[#0E7C7B]";
const CORAL = "bg-[#FF6F62]/20 text-[#FF6F62]";

const STATUS_CLASS: Record<string, string> = {
  // Grey — inactive
  draft: GREY, cancelled: GREY, closed: GREY,
  // Blue — pending / in-flight / mid-approval
  submitted: BLUE, finance_approved: BLUE, pending_ceo: BLUE, pending: BLUE, requested: BLUE,
  needs_approval: BLUE, in_review: BLUE, in_progress: BLUE, need_info: BLUE, open: BLUE,
  ordered: BLUE, accepted: BLUE, dispatched: BLUE, in_transit: BLUE,
  pending_hr: BLUE, pending_approval: BLUE, priced: BLUE,
  // Teal — success / completed end states
  approved: TEAL, fulfilled: TEAL, booked: TEAL, confirmed: TEAL, completed: TEAL, done: TEAL, resolved: TEAL, delivered: TEAL,
  // Coral — negative
  changes_requested: CORAL, rejected: CORAL,
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", cancelled: "Cancelled", closed: "Closed",
  submitted: "Pending Finance", finance_approved: "Pending CEO", pending_ceo: "Pending CEO",
  pending: "Pending", requested: "Requested", needs_approval: "Needs Approval", in_review: "In Review",
  in_progress: "In Progress", need_info: "Need Info", open: "Open", ordered: "Ordered", accepted: "Accepted",
  dispatched: "Dispatched", in_transit: "In Transit",
  pending_hr: "Pending HR", pending_approval: "Pending Approval", priced: "Ready to Send",
  approved: "Approved", fulfilled: "Fulfilled", booked: "Booked", confirmed: "Confirmed", completed: "Completed",
  done: "Done", resolved: "Resolved", delivered: "Delivered",
  changes_requested: "Changes Requested", rejected: "Rejected",
};

const titleCase = (s?: string) => (s ? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "");

export const statusClass = (s?: string) => (s && STATUS_CLASS[s]) || GREY;
export const statusLabel = (s?: string) => (s && STATUS_LABEL[s]) || titleCase(s);
