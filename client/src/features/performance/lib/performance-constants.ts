// Goal/review vocabulary for the performance module: categories, metric types,
// and the status -> colour maps used by every tab.

import { Circle, TrendingUp, AlertTriangle, XCircle, CheckCircle2, Clock } from "lucide-react";

// ---- Helpers ----
export const GOAL_CATEGORIES = ["business", "technical", "operations", "people", "culture"];
export const METRIC_TYPES = ["output", "outcome", "activity", "okr"];
export const GOAL_STATUSES: Record<string, { label: string; color: string; icon: any }> = {
  not_started: { label: "Not Started", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", icon: Clock },
  on_track: { label: "On Track", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", icon: CheckCircle2 },
  at_risk: { label: "At Risk", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300", icon: AlertTriangle },
  off_track: { label: "Off Track", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", icon: XCircle },
  completed: { label: "Completed", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", icon: CheckCircle2 },
};
export const CYCLE_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  locked: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  archived: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};
export const REVIEW_STATUS_COLORS: Record<string, string> = {
  not_started: "bg-gray-100 text-gray-600",
  self_submitted: "bg-blue-100 text-blue-700",
  manager_submitted: "bg-purple-100 text-purple-700",
  hr_locked: "bg-orange-100 text-orange-700",
  finalized: "bg-green-100 text-green-700",
};
