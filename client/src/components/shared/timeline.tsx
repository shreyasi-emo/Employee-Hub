import * as React from "react";

// Shared vertical timeline (the booking-timeline visual): a continuous connecting line with a
// coloured dot per entry sitting on it. Each item supplies its own card/content node.
export type TimelineItem = { id: string; color?: string; hollow?: boolean; content: React.ReactNode };

export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <div className={`relative pl-6 ${className || ""}`}>
      <span className="absolute left-[7px] top-3 bottom-3 w-px bg-border" aria-hidden />
      <div className="space-y-3">
        {items.map((it) => (
          <div key={it.id} className="relative">
            <span
              className={`absolute -left-[22px] top-4 h-3 w-3 rounded-full ring-4 ring-background ${it.hollow ? "border-2 bg-background" : ""}`}
              style={it.hollow ? { borderColor: it.color || "#206295" } : { backgroundColor: it.color || "#206295" }}
              aria-hidden
            />
            {it.content}
          </div>
        ))}
      </div>
    </div>
  );
}
