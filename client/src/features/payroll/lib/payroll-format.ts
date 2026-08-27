// Month labels, payroll-run status chips, and the rupee formatter.
export const months = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

export const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: "Draft", bg: "bg-muted", text: "text-muted-foreground" },
  review: { label: "In Review", bg: "bg-[#FFA962]/25", text: "text-[#D98324]" },
  approved: { label: "Approved", bg: "bg-[#206295]/12", text: "text-[#206295]" },
  locked: { label: "Locked", bg: "bg-[#4BDCD9]/25", text: "text-[#0E7C7B]" },
};

export function fmt(val: any) {
  return `₹${Math.round(parseFloat(val || "0")).toLocaleString("en-IN")}`;
}
