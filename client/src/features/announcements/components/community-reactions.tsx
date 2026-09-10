// Basic reaction bar for Community posts — a fixed emoji set, tap to react/unreact, shows counts.
// No comments/replies. Kept in sync with server COMMUNITY_REACTIONS in shared/schema.ts.
const REACTIONS = ["🎉", "❤️", "👏", "👍"];

export function CommunityReactions({ reactions, meId, onReact, disabled }: {
  reactions?: Record<string, string[]>;
  meId?: string;
  onReact: (emoji: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
      {REACTIONS.map((emoji) => {
        const users = (reactions?.[emoji] as string[]) || [];
        const mine = !!meId && users.includes(meId);
        return (
          <button
            key={emoji}
            type="button"
            disabled={disabled}
            onClick={(e) => { e.stopPropagation(); onReact(emoji); }}
            aria-pressed={mine}
            data-testid={`react-${emoji}`}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover-elevate transition-colors ${mine ? "border-[#206295] bg-[#206295]/10 text-[#206295]" : "border-border bg-muted text-muted-foreground"}`}
          >
            <span className="text-sm leading-none">{emoji}</span>
            {users.length > 0 && <span className="tabular-nums font-medium">{users.length}</span>}
          </button>
        );
      })}
    </div>
  );
}
