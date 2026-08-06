import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// House standard: card lists show 15 per page, then paginate (mirrors DataTable).
export const PAGE_SIZE = 15;

export function usePaged<T>(items: T[], size = PAGE_SIZE) {
  const [page, setPage] = React.useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  const cur = Math.min(page, totalPages);
  React.useEffect(() => { if (page !== cur) setPage(cur); }, [page, cur]);
  const pageItems = totalPages > 1 ? items.slice((cur - 1) * size, cur * size) : items;
  return { pageItems, page: cur, setPage, totalPages, count: items.length, size, hasPages: totalPages > 1 };
}

export function PaginationBar({ page, totalPages, count, size, onPage, className = "" }: {
  page: number; totalPages: number; count: number; size: number; onPage: (p: number) => void; className?: string;
}) {
  if (totalPages <= 1) return null;
  const first = (page - 1) * size + 1;
  const last = Math.min(page * size, count);
  return (
    <div className={`flex items-center justify-between pt-1 text-xs text-muted-foreground ${className}`}>
      <span className="tabular-nums">{first}–{last} of {count}</span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
        <span className="px-1 tabular-nums">{page} / {totalPages}</span>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
