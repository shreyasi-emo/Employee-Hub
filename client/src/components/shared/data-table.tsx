import * as React from "react";
import { PaginationBar } from "./pagination";
import { cn } from "@/lib/utils";

// House standard: lists show 15 rows per page, then paginate.
export const TABLE_PAGE_SIZE = 15;

// Shared, house-styled data table so we never re-style tables by hand.
// Matches the app's table look (compact `p-3` cells, muted `text-xs` header,
// `list-divider` row separators, `hover-elevate` rows) and gives the first/last
// columns a little extra edge padding so content isn't flush against the card.
export type SortState = { key: string; dir: "asc" | "desc" };

export type DataTableColumn<T> = {
  key: string;
  header: React.ReactNode;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  headClassName?: string;
  cellClassName?: string;
  render?: (row: T, index: number) => React.ReactNode;
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  sort?: SortState;
  onSortChange?: (key: string) => void;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
  emptyText?: React.ReactNode;
  className?: string;
  testIdPrefix?: string;
  /** Rows per page before paginating. Default 15. Set `paginate={false}` for callers that page externally. */
  pageSize?: number;
  paginate?: boolean;
  /** Optional expandable-row drawer. When `isExpanded(row)` is true, a full-width row
   *  is rendered beneath it holding `renderExpanded(row)`. Pair with `onRowClick` to toggle. */
  renderExpanded?: (row: T, index: number) => React.ReactNode;
  isExpanded?: (row: T) => boolean;
  /** Prepend a left "S.No." column numbering rows across pages. */
  showSerial?: boolean;
  /** Use `table-fixed` so column widths obey headClassName/cellClassName exactly —
   *  needed when several sibling tables must line up column-for-column. */
  fixedLayout?: boolean;
};

const alignClass = (a?: string) => (a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left");

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  sort,
  onSortChange,
  onRowClick,
  rowClassName,
  emptyText = "No data",
  className,
  testIdPrefix = "row",
  pageSize = TABLE_PAGE_SIZE,
  paginate = true,
  renderExpanded,
  isExpanded,
  showSerial,
  fixedLayout,
}: DataTableProps<T>) {
  // A touch more breathing room on the outer edges of the table.
  const edgePad = (i: number) => cn(i === 0 && !showSerial && "pl-6", i === columns.length - 1 && "pr-5");
  const fullSpan = columns.length + (showSerial ? 1 : 0);

  // Built-in pagination: 15 rows/page. Auto-hidden when everything fits on one page.
  const [page, setPage] = React.useState(1);
  const totalPages = paginate ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;
  const curPage = Math.min(page, totalPages);
  React.useEffect(() => { if (page !== curPage) setPage(curPage); }, [page, curPage]);
  const view = paginate && totalPages > 1 ? rows.slice((curPage - 1) * pageSize, curPage * pageSize) : rows;
  const showPager = paginate && totalPages > 1;
  const firstShown = rows.length === 0 ? 0 : (curPage - 1) * pageSize + 1;
  const lastShown = Math.min(curPage * pageSize, rows.length);

  return (
    <div className={className}>
    <div className="overflow-x-auto">
      <table className={cn("w-full text-sm border-collapse", fixedLayout && "table-fixed")}>
        <thead>
          <tr className="text-left text-[13px] text-muted-foreground">
            {showSerial && <th className="p-3 pl-6 pr-2 font-semibold whitespace-nowrap text-left w-14" data-testid="th-serial">S.No.</th>}
            {columns.map((c, i) => {
              const sortable = !!(c.sortable && onSortChange);
              return (
                <th
                  key={c.key}
                  onClick={sortable ? () => onSortChange!(c.key) : undefined}
                  className={cn(
                    "p-3 font-semibold whitespace-nowrap",
                    edgePad(i),
                    alignClass(c.align),
                    sortable && "cursor-pointer select-none hover:text-foreground",
                    c.headClassName,
                  )}
                  data-testid={`th-${c.key}`}
                >
                  <span className={cn("inline-flex items-center gap-1", c.align === "right" && "flex-row-reverse")}>
                    {c.header}
                    {sort?.key === c.key && <span className="text-[9px] leading-none">{sort.dir === "asc" ? "▲" : "▼"}</span>}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="list-divider">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={fullSpan} className="px-6 py-10 text-center text-sm text-muted-foreground">{emptyText}</td>
            </tr>
          ) : (
            view.map((row, ri) => {
              const rowKey = getRowKey(row, ri);
              const expanded = !!(renderExpanded && isExpanded?.(row));
              return (
                <React.Fragment key={rowKey}>
                  <tr
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn("hover-elevate", onRowClick && "cursor-pointer", expanded && "bg-muted/20", rowClassName?.(row))}
                    data-testid={`${testIdPrefix}-${rowKey}`}
                  >
                    {showSerial && <td className="p-3 pl-6 pr-2 whitespace-nowrap text-xs text-muted-foreground tabular-nums w-14 align-middle">{firstShown + ri}</td>}
                    {columns.map((c, i) => (
                      <td
                        key={c.key}
                        className={cn(
                          "p-3 whitespace-nowrap align-middle",
                          edgePad(i),
                          alignClass(c.align),
                          c.align === "right" && "tabular-nums",
                          c.cellClassName,
                        )}
                      >
                        {c.render ? c.render(row, ri) : (row as any)[c.key]}
                      </td>
                    ))}
                  </tr>
                  {expanded && (
                    <tr className="bg-muted/20" data-testid={`${testIdPrefix}-${rowKey}-expanded`}>
                      <td colSpan={fullSpan} className="px-6 pt-0 pb-2.5">
                        {renderExpanded!(row, ri)}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
    {showPager && (
      <div className="px-5 py-3 border-t border-border">
        <PaginationBar page={curPage} totalPages={totalPages} count={rows.length} size={pageSize} onPage={setPage} />
      </div>
    )}
    </div>
  );
}
