// The attendance state vocabulary — shared by the org-wide view, the self view,
// the calendar, the charts and the exports, so none of them can disagree.

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Attendance states — brand color harmony (blues / teals / corals / grey)
export const STATES = [
  { key: "present", label: "Present", color: "#206295" },  // brand blue
  { key: "wfh", label: "WFH", color: "#0E7C7B" },           // dark teal
  { key: "on_duty", label: "On Duty", color: "#4A90C2" },   // lighter brand blue (distinct from Present)
  { key: "half_day", label: "Half Day", color: "#6A7366" }, // grey-green (swapped with leave)
  { key: "absent", label: "Absent", color: "#FF6F62" },     // coral
  { key: "leave", label: "Leave", color: "#953229" },       // brick red
] as const;

export const STATE_KEYS = STATES.map((s) => s.key);

export const STATE_COLOR: Record<string, string> = { attendancePct: "#206295" };
STATES.forEach((s) => { STATE_COLOR[s.key] = s.color; });

// Readable label text colors — darker variants for the statuses whose brand color is too light
// to read on a white/tinted cell; the rest keep their own (dark-enough) brand color.
export const LABEL_COLOR: Record<string, string> = { wfh: "#0E7C7B", half_day: "#4F5A4B", leave: "#953229", absent: "#C43D30", holiday: "#5B6B7A" };

export const ON_DUTY_PURPOSES = ["Factory Visit", "Vendor Visit", "Client Meeting", "Site Visit", "Field Work", "Training", "Others"];

export const statusLabelOf = (s?: string) =>
  STATES.find((x) => x.key === s)?.label || (s === "holiday" ? "Holiday" : s === "weekend" ? "Weekend" : "Not marked");

// Status label used in the xlsx exports (longer form than the on-screen labels).
export const STATUS_DISPLAY: Record<string, string> = {
  present: "Present (WFO)", wfh: "WFH", on_duty: "On Duty",
  half_day: "Half Day", absent: "Absent", leave: "On Leave", holiday: "Holiday",
};

// ---- colour maths for the calendar cells ----

export const TODAY_FILL_ALPHA = 0.5;

// Contrasting text color for a solid fill: white on dark colors, dark grey on light ones.
export const textOn = (hex: string) => { const h = hex.replace("#", ""); const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.65 ? "#FFFFFF" : "#374151"; };

// Blend a hex color toward white by (1 - alpha) — the visual result of an alpha fill over a light card.
export const blendWhite = (hex: string, alpha: number) => { const h = hex.replace("#", ""); const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16); const mix = (c: number) => Math.round(c * alpha + 255 * (1 - alpha)); const to = (c: number) => mix(c).toString(16).padStart(2, "0"); return `#${to((n >> 16) & 255)}${to((n >> 8) & 255)}${to(n & 255)}`; };
