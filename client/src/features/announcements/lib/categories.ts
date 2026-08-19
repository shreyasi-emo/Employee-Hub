// Announcement category tints. Object key order also drives the category picker
// in the create dialog, so keep them in the order you want offered.
export const categoryColors: Record<string, string> = {
  general: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  holiday: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  policy: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  event: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  urgent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  benefits: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
};

/** Urgent first, then high / normal / low. Unknown priorities sort as normal. */
export const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
