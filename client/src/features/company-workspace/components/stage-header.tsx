// Full-width stage section header used across My Requests and the approval surfaces:
// label + count + a hairline rule that fills the row. Wraps cleanly on a phone.
// `tone="alert"` tints it coral (e.g. a query bounced back from the CEO); `icon` prefixes a lucide glyph.
export function StageHeader({ label, count, tone, icon: Icon }: { label: string; count: number; tone?: "alert"; icon?: any }) {
  const alert = tone === "alert";
  return (
    <div className="flex items-center gap-2.5 pt-1">
      {Icon && <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${alert ? "text-[#C4402F]" : "text-muted-foreground"}`} />}
      <span className={`text-[11px] font-semibold uppercase tracking-wider ${alert ? "text-[#C4402F]" : "text-muted-foreground"}`}>{label}</span>
      <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold flex-shrink-0 ${alert ? "bg-[#FF6F62]/20 text-[#C4402F]" : "bg-muted text-muted-foreground"}`}>{count}</span>
      <span className={`h-px flex-1 rounded-full ${alert ? "bg-[#FF6F62]/40" : "bg-border/70"}`} />
    </div>
  );
}

// Split items into stage sections + render each section's body. `renderGroup` draws the body
// (a list of cards for card view, or one table for table view). Any status not matched by a
// stage falls into a trailing bucket so nothing is ever dropped.
export type StageDef = { key: string; label: string; has: (s: string) => boolean };
export function stageSections<T extends { id: string; status: string }>(items: T[], defs: StageDef[], fallbackLabel = "In progress") {
  const seen = new Set<string>();
  const groups = defs.map((st) => {
    const gi = items.filter((x) => st.has(x.status));
    gi.forEach((x) => seen.add(x.id));
    return { key: st.key, label: st.label, items: gi };
  }).filter((g) => g.items.length > 0);
  const rest = items.filter((x) => !seen.has(x.id));
  if (rest.length) groups.push({ key: "other", label: fallbackLabel, items: rest });
  return groups;
}

export function StageGroups<T extends { id: string; status: string }>({ items, defs, renderGroup, empty }: {
  items: T[]; defs: StageDef[]; renderGroup: (groupItems: T[]) => React.ReactNode; empty: React.ReactNode;
}) {
  const groups = stageSections(items, defs);
  if (groups.length === 0) return <>{empty}</>;
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.key} className="space-y-3">
          <StageHeader label={g.label} count={g.items.length} />
          {renderGroup(g.items)}
        </div>
      ))}
    </div>
  );
}
