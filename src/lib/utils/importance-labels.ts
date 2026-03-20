/**
 * Display label for contact importance tier. Use in UI only; keep storing CRITICAL/HIGH/MEDIUM/LOW in data.
 * LOW is shown as "Standard" to avoid negative wording.
 */
export function importanceDisplayLabel(importance: string): string {
  switch (importance) {
    case "CRITICAL":
      return "Critical";
    case "HIGH":
      return "High";
    case "MEDIUM":
      return "Medium";
    case "LOW":
      return "Standard";
    default:
      return importance;
  }
}
