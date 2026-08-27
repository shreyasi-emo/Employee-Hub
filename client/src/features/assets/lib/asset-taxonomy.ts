// Asset categories and conditions. Object key order drives both the pickers and
// the category chip row, so keep them in the order you want offered.

export const categoryColors: Record<string, string> = {
  laptop: "bg-[#206295]/12 text-[#206295]",
  mobile: "bg-muted text-muted-foreground",
  desktop: "bg-muted text-muted-foreground",
  monitor: "bg-[#4BDCD9]/25 text-[#0E7C7B]",
  peripherals: "bg-[#FFA962]/25 text-[#D98324]",
  software: "bg-muted text-muted-foreground",
  furniture: "bg-[#FFA962]/25 text-[#D98324]",
  access_card: "bg-[#4BDCD9]/25 text-[#0E7C7B]",
  phone: "bg-[#206295]/12 text-[#206295]",
  other: "bg-muted text-muted-foreground",
};

export const conditionColors: Record<string, string> = {
  new: "bg-[#4BDCD9]/25 text-[#0E7C7B]",
  excellent: "bg-[#4BDCD9]/25 text-[#0E7C7B]",
  good: "bg-[#206295]/12 text-[#206295]",
  fair: "bg-[#FFA962]/25 text-[#D98324]",
  poor: "bg-[#FF6F62]/20 text-[#C4402F]",
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
