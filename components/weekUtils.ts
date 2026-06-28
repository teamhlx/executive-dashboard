/**
 * Convert ISO week string (e.g. "2026-W25") to "Week of Jun 16" format.
 */
export function weekToLabel(isoWeek: string): string {
  const match = isoWeek.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return isoWeek;
  
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);
  
  // ISO 8601: Week 1 contains the year's first Thursday
  // Find Jan 4 (always in week 1), then calculate Monday of week 1
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7; // Mon=1..Sun=7
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setDate(jan4.getDate() - (dayOfWeek - 1));
  
  // Target Monday = Monday of week 1 + (week - 1) * 7 days
  const targetMonday = new Date(mondayWeek1);
  targetMonday.setDate(mondayWeek1.getDate() + (week - 1) * 7);
  
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const currentYear = new Date().getFullYear();
  const showYear = year !== currentYear;
  return `Week of ${months[targetMonday.getMonth()]} ${targetMonday.getDate()}${showYear ? `, ${year}` : ""}`;
}
