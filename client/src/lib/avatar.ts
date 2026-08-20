// Deterministic default-avatar colours. Same person always gets the same shade.
//
// NOTE: features/requests/reimbursements/components/reimbursement-approval-detail.tsx
// keeps its own avatarColor — it sums character codes instead of the ×31 hash below,
// so it assigns different colours. Folding it in here would change which shade
// existing rows render with.

/** Solid brand hexes, used where the avatar is a flat tinted circle. */
export const AVATAR_PALETTE = ["#206295", "#4BDCD9", "#FF6F62"];

export function avatarColor(seed?: string) {
  const s = seed || "";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

/** Avatar / text / chip triples, used where a name needs a matching set of tints. */
export const NAME_PALETTE = [
  { avatar: "rgba(75, 220, 217, 0.35)", text: "#1F8F8C", chip: "rgba(75, 220, 217, 0.15)" },   // teal (#4BDCD9)
  { avatar: "rgba(125, 133, 142, 0.32)", text: "#566069", chip: "rgba(125, 133, 142, 0.14)" }, // grey
  { avatar: "rgba(255, 111, 98, 0.32)", text: "#C24A3E", chip: "rgba(255, 111, 98, 0.14)" },   // coral (#FF6F62)
];

export function nameColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h += name.charCodeAt(i);
  return NAME_PALETTE[h % NAME_PALETTE.length];
}
