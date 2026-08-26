export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateRange(start: string | Date, end: string | Date): string {
  return `${formatDate(start)} — ${formatDate(end)}`;
}

export function formatHours(hours: number): string {
  return `${hours}h`;
}

export function formatPercent(value: number): string {
  return `${value}%`;
}

export function getSprintWeeks(start: string | Date, end: string | Date): number {
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  const weeks = diffMs / (1000 * 60 * 60 * 24 * 7);
  return Math.max(1, Math.round(weeks));
}
