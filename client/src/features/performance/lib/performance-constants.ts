// Goal/review vocabulary for the performance module: categories, metric types,
// and the status -> colour maps used by every tab.

import { Circle, TrendingUp, AlertTriangle, XCircle, CheckCircle2, Clock } from "lucide-react";

// ---- Helpers ----
export const GOAL_CATEGORIES = ["business", "technical", "operations", "people", "culture"];
export const METRIC_TYPES = ["output", "outcome", "activity", "okr"];
export const GOAL_STATUSES: Record<string, { label: string; color: string; icon: any }> = {
  not_started: { label: "Not Started", color: "bg-muted text-muted-foreground", icon: Clock },
  on_track: { label: "On Track", color: "bg-[#4BDCD9]/25 text-[#0E7C7B]", icon: CheckCircle2 },
  at_risk: { label: "At Risk", color: "bg-[#FFA962]/25 text-[#D98324]", icon: AlertTriangle },
  off_track: { label: "Off Track", color: "bg-[#FF6F62]/20 text-[#C4402F]", icon: XCircle },
  completed: { label: "Completed", color: "bg-[#206295]/15 text-[#206295]", icon: CheckCircle2 },
};
export const CYCLE_STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-[#4BDCD9]/25 text-[#0E7C7B]",
  locked: "bg-[#FFA962]/25 text-[#D98324]",
  archived: "bg-[#FF6F62]/20 text-[#C4402F]",
};
export const REVIEW_STATUS_COLORS: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  self_submitted: "bg-[#206295]/15 text-[#206295]",
  manager_submitted: "bg-purple-100 text-purple-700",
  hr_locked: "bg-[#FFA962]/25 text-[#D98324]",
  finalized: "bg-[#4BDCD9]/25 text-[#0E7C7B]",
};
