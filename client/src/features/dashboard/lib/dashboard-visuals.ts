import { nameColor, NAME_PALETTE } from "@/lib/avatar";
export { nameColor, NAME_PALETTE };

import { Card } from "@/components/ui/card";
import { Calendar, Building2, Car, Route } from "lucide-react";

// Card styling, calendar class overrides, and the colour palettes the dashboard widgets share.
// Shared card styling: 20px radius + exact layered background + box-shadow from the reference.
export const CARD_STYLE: React.CSSProperties = {
  borderRadius: 20,
  // Glassmorphism — same layered semi-transparent background as the header bar
  background:
    "linear-gradient(rgba(255,255,255,0.10), rgba(255,255,255,0.10)), rgba(255,255,255,0.50)",
  backgroundBlendMode: "overlay",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  // Unified glass shadow — matches the header bar
  boxShadow:
    "0 0 8px rgba(44,62,98,0.15), inset 2px 2px 2px -2px #fff, inset -2px -2px 2px -2px #fff, 0 8px 12px rgba(0,0,0,0.08)",
};

// Fluid full-width calendar grid (merged over the Calendar component's defaults)
export const calClassNames = {
  months: "w-full h-full",
  month: "w-full h-full flex flex-col",
  table: "w-full flex-1 flex flex-col",
  head_row: "flex w-full",
  head_cell: "text-muted-foreground flex-1 font-normal text-[0.75rem]",
  tbody: "flex-1 flex flex-col",
  row: "flex w-full flex-1",
  cell: "flex-1 flex items-center justify-center text-sm p-0 relative focus-within:relative focus-within:z-20",
  day: "inline-flex items-center justify-center h-9 w-9 p-0 font-normal rounded-[12px] hover-elevate aria-selected:opacity-100",
  day_today: "bg-[#206295]/15 text-[#206295] font-semibold",
};

export const HOLIDAY_COLOR = "#FF6F62";

// My-Attendance donut colours (aligned with the Attendance page's state palette).
export const ATT_COLORS: Record<string, string> = {
  present: "#206295", wfh: "#0E7C7B", on_duty: "#4A90C2", half_day: "#6A7366", leave: "#953229", absent: "#FF6F62",
};

// Per-name attendee palette so different people get teal / grey / coral DPs & chips

// Brand palette for department chips in the directory (stable per department id).
export const DEPT_CHIP_COLORS = ["#206295", "#0E7C7B", "#4A90C2", "#6A7366", "#953229", "#425B8D"];

export const deptChipColor = (id?: string | null) => {
  if (!id) return "#94A3B8";
  let h = 0; for (const ch of id) h += ch.charCodeAt(0);
  return DEPT_CHIP_COLORS[h % DEPT_CHIP_COLORS.length];
};

// ===== Quick Actions (last row, all dashboards) — important features NOT already on the dashboard =====
export const QUICK_ACTIONS = [
  { label: "Book a Car", desc: "Company vehicles", href: "/vehicles", icon: Car, color: "bg-[#206295]/15 text-[#206295]" },
  { label: "Company Workspace", desc: "Services & requests", href: "/company-workspace", icon: Building2, color: "bg-[#4BDCD9]/25 text-[#0E7C7B]" },
  { label: "Request Logistics", desc: "Couriers & moves", href: "/logistics", icon: Route, color: "bg-[#206295]/15 text-[#206295]" },
];
