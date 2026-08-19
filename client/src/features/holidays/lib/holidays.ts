import { format } from "date-fns";
import { exportXlsx } from "@/lib/export-xlsx";

export const LOCATIONS = ["Mumbai", "Pune", "Chennai", "Hyderabad", "Bengaluru"];

/** Year picker range: two years back through two years forward. */
export const yearOptions = (currentYear: number) =>
  Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

export function exportHolidays(holidays: any[], year: number, location: string) {
  const headers = ["Holiday", "Date", "Day", "Type", "Location", "Description"];
  const rows = holidays.map((h) => {
    const d = new Date(h.date);
    return [h.name, format(d, "dd MMM yyyy"), format(d, "EEEE"), h.isOptional ? "Optional" : "Mandatory", h.location === "all" ? "All" : h.location, h.description || ""];
  });
  exportXlsx({
    filename: `holidays-${year}-${location === "all" ? "all" : location.toLowerCase()}.xlsx`,
    sheet: "Holidays",
    title: `Holiday Calendar ${year} — ${location === "all" ? "All Locations" : location}`,
    headers, rows,
  });
}
