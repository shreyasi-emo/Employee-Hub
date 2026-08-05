import * as React from "react";
import { cn } from "@/lib/utils";

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
}: DataTableProps<T>) {
  // A touch more breathing room on the outer edges of the table.
  const edgePad = (i: number) => cn(i === 0 && "pl-6", i === columns.length - 1 && "pr-5");
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-[13px] text-muted-foreground">
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
              <td colSpan={columns.length} className="px-6 py-10 text-center text-sm text-muted-foreground">{emptyText}</td>
            </tr>
          ) : (
            rows.map((row, ri) => (
              <tr
                key={getRowKey(row, ri)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn("hover-elevate", onRowClick && "cursor-pointer", rowClassName?.(row))}
                data-testid={`${testIdPrefix}-${getRowKey(row, ri)}`}
              >
                {columns.map((c, i) => (
                  <td
                    key={c.key}
                    className={cn(
                      "p-3 whitespace-nowrap",
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
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
