// Calendar helpers shared by attendance and payroll modules.

export function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

export function countWeekends(month: number, year: number): number {
  let count = 0;
  const days = getDaysInMonth(month, year);
  for (let d = 1; d <= days; d++) {
    const day = new Date(year, month - 1, d).getDay();
    if (day === 0 || day === 6) count++;
  }
  return count;
}
