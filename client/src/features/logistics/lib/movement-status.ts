/** Roles that can act on a movement (accept / dispatch / deliver / reject). */
export const LOGISTICS_ROLES = ["super_admin", "logistics", "hr_admin"];

export const statusColors: Record<string, string> = {
  submitted: "bg-blue-500/10 text-blue-700",
  needs_approval: "bg-amber-500/10 text-amber-700",
  approved: "bg-green-500/10 text-green-700",
  rejected: "bg-red-500/10 text-red-700",
  accepted: "bg-emerald-500/10 text-emerald-700",
  dispatched: "bg-violet-500/10 text-violet-700",
  in_transit: "bg-indigo-500/10 text-indigo-700",
  delivered: "bg-teal-500/10 text-teal-700",
  cancelled: "bg-gray-500/10 text-gray-700",
};

/** A movement is "done" once it reaches one of these end states. */
export const TERMINAL_STATUSES = ["delivered", "cancelled", "rejected"];
export const isTerminal = (status: string) => TERMINAL_STATUSES.includes(status);
