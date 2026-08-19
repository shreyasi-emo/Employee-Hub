// Asset categories and conditions. Object key order drives both the pickers and
// the category chip row, so keep them in the order you want offered.

export const categoryColors: Record<string, string> = {
  laptop: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  mobile: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  desktop: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  monitor: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  peripherals: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  software: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  furniture: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  access_card: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  phone: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
};

export const conditionColors: Record<string, string> = {
  new: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  excellent: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  good: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  fair: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  poor: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export const catColorOf = (category?: string) => categoryColors[category || ""] || categoryColors.other;
export const condColorOf = (condition?: string) => conditionColors[condition || ""] || conditionColors.good;

export const BLANK_ASSET = {
  name: "", assetCode: "", category: "laptop", serialNumber: "", condition: "good",
  employeeId: "", purchaseDate: "", purchaseValue: "", description: "", status: "available",
};

/** Strip empty strings the API treats as "not provided". */
export const cleanAssetPayload = (form: any) => ({
  ...form,
  purchaseValue: form.purchaseValue || undefined,
  purchaseDate: form.purchaseDate || undefined,
  employeeId: form.employeeId || undefined,
});
