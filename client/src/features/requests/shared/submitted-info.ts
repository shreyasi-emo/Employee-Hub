// Derives the "Submitted / Resubmitted" label for a request from its comment thread.
// Submission slot: a re-submitted claim relabels "Submitted on" → "Re-submitted On" and keeps the
// original creation date for the hover tooltip. Only reimbursements carry a resubmit marker (in notes).
export const submittedInfo = (type: string, it: any): { label: string; date: any; resubmitted: boolean; originalDate?: any } => {
  if (type === "reimbursement") {
    try {
      const p = JSON.parse(it.notes || "{}");
      if (p && p.kind === "resubmitted_diff") return { label: "Re-submitted On", date: p.at || it.updatedAt || it.createdAt, resubmitted: true, originalDate: it.createdAt };
    } catch { /* not JSON */ }
  }
  return { label: "Submitted on", date: it.createdAt, resubmitted: false };
};
