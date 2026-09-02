// Announcement categories — BRAND PALETTE ONLY (no orange on this screen):
//   blue #206295 · teal #0E7C7B / #4BDCD9 · coral #FF6F62 / #C4402F · neutral slate #64748B.
// (No purple / pink / orange / generic Tailwind hues — those violate the brand guidelines.)
import { Megaphone, Users, ScrollText, Calendar, CalendarDays, Gift, AlertTriangle, Tag } from "lucide-react";

const TINT = {
  blue: "bg-[#206295]/15 text-[#206295]",
  teal: "bg-[#0E7C7B]/15 text-[#0E7C7B]",
  tealL: "bg-[#4BDCD9]/25 text-[#0E7C7B]",
  coral: "bg-[#FF6F62]/20 text-[#C4402F]",
  slate: "bg-[#64748B]/15 text-[#64748B]",
};

/** Icon + tinted-tile color + one-line description per category — drives the stat cards,
 *  the card thumbnails AND the category badges (so the whole screen stays on-palette). */
export const categoryMeta: Record<string, { icon: any; tile: string; desc: string }> = {
  general: { icon: Megaphone, tile: TINT.blue, desc: "Company updates" },
  hr: { icon: Users, tile: TINT.teal, desc: "HR related updates" },
  policy: { icon: ScrollText, tile: TINT.slate, desc: "Policy updates" },
  holiday: { icon: Calendar, tile: TINT.coral, desc: "Holidays & leave" },
  event: { icon: CalendarDays, tile: TINT.tealL, desc: "Events" },
  benefits: { icon: Gift, tile: TINT.tealL, desc: "Benefits" },
  urgent: { icon: AlertTriangle, tile: TINT.coral, desc: "Urgent notices" },
};
export const defaultCatMeta = { icon: Tag, tile: TINT.slate, desc: "Updates" };
export const catMeta = (c: string) => categoryMeta[c] || defaultCatMeta;

/** Badge tint = the same brand tint as the category's tile. */
export const categoryColors: Record<string, string> = Object.fromEntries(
  Object.entries(categoryMeta).map(([k, v]) => [k, v.tile]),
);
categoryColors.general ||= TINT.blue;

/** Coral is the brand's alert colour (no generic red). */
export const URGENT_TINT = TINT.coral;

/** Urgent first, then high / normal / low. Unknown priorities sort as normal. */
export const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
