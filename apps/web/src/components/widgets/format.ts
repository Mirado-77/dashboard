/** `2026-10-07` read as a local day, not as UTC midnight. */
export function formatDay(date: string): string {
  const day = new Date(`${date}T00:00:00`);
  if (Number.isNaN(day.getTime())) return date;
  return day.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function formatDate(date: string | null): string | null {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, { dateStyle: "medium" });
}
