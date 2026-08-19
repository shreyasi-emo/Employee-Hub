/** Generic status pill for the performance module — pass the matching colour map
 *  from lib/performance-constants (CYCLE_STATUS_COLORS or REVIEW_STATUS_COLORS). */
export function statusBadge(status: string, map: Record<string, string>) {
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] || "bg-gray-100 text-gray-600"}`}>{status?.replace(/_/g, " ")}</span>;
}
