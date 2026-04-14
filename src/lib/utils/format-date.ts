import { format, formatDistanceToNow, isToday, isYesterday, isThisYear } from "date-fns";

/**
 * Format a date for display in LLM prompts — human-readable, no ISO timestamps.
 * Examples: "Jan 24, 2026", "Mar 3"
 */
export function formatDateForLLM(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "unknown date";
  return isThisYear(d) ? format(d, "MMM d") : format(d, "MMM d, yyyy");
}

/**
 * Format a date with time for LLM prompts.
 * Examples: "Jan 24 at 3:41 PM", "Mar 3, 2025 at 11:00 AM"
 */
export function formatDateTimeForLLM(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "unknown date";
  return isThisYear(d) ? format(d, "MMM d 'at' h:mm a") : format(d, "MMM d, yyyy 'at' h:mm a");
}

/**
 * Format a date for UI display — smart relative/absolute.
 * Examples: "Today", "Yesterday", "Jan 24", "Mar 3, 2025"
 */
export function formatDateForUI(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return isThisYear(d) ? format(d, "MMM d") : format(d, "MMM d, yyyy");
}

/**
 * Format a date + time for UI display.
 * Examples: "Today at 3:41 PM", "Jan 24 at 11:00 AM"
 */
export function formatDateTimeForUI(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  if (isToday(d)) return `Today at ${format(d, "h:mm a")}`;
  if (isYesterday(d)) return `Yesterday at ${format(d, "h:mm a")}`;
  return isThisYear(d) ? format(d, "MMM d 'at' h:mm a") : format(d, "MMM d, yyyy 'at' h:mm a");
}

/**
 * Relative time — "2 days ago", "3 months ago".
 */
export function formatRelative(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return formatDistanceToNow(d, { addSuffix: true });
}
