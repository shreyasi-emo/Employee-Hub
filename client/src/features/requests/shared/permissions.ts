// Who may act on a request, by stage.
//
// These predicates decide what the approval screens let a person do, so they are
// business rules — not UI. They previously lived inside the office-purchase,
// procurement and travel *dialog* components, which meant answering "who can
// approve a travel request?" required opening a dialog. They live here now.
//
// super_admin is an override everywhere, matching the backend.

const HR_ROLES = ["hr_admin", "hr_executive"];

// ---- office purchases: HR triages (price / order / deliver), CEO approves ----

export const canHrTriage = (role?: string) =>
  !!role && (role === "super_admin" || HR_ROLES.includes(role));

export const canCeoApprove = (role?: string) =>
  !!role && (role === "super_admin" || role === "ceo_approver");

// ---- procurement: CEO only ----

export const canProcureApprove = (role?: string) =>
  !!role && (role === "super_admin" || role === "ceo_approver");

// ---- travel: HR prices + books, CEO approves/rejects/queries ----

export const canTravelHr = (role?: string) =>
  !!role && ["super_admin", "hr_admin", "hr_executive"].includes(role);

export const canTravelCeo = (role?: string) =>
  !!role && ["super_admin", "ceo_approver"].includes(role);
