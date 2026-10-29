const dateTime = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

const shortDate = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDateTime(value: string | Date | null): string {
  if (!value) return "Not yet";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return `${dateTime.format(date)} UTC`;
}

export function formatDate(value: string | Date | null): string {
  if (!value) return "Not yet";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return shortDate.format(date);
}

export function formatDuration(start: string | null, end: string | null): string {
  if (!start) return "Not started";
  const from = new Date(start).getTime();
  const to = end ? new Date(end).getTime() : Date.now();
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return "Unknown";
  const seconds = Math.max(0, Math.round((to - from) / 1_000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`;
}

export function jobKindLabel(kind: string): string {
  if (kind === "FIRST_BUILD") return "First build";
  if (kind === "PUSH_UPDATE") return "Push update";
  if (kind === "CHAT_EDIT") return "Chat edit";
  if (kind === "SUMMARY_REFRESH") return "Summary refresh";
  return kind;
}

export function sourceLabel(source: string): string {
  if (source === "FIRST_BUILD") return "First build";
  if (source === "PUSH_UPDATE") return "GitHub push";
  if (source === "CHAT_EDIT") return "Chat edit";
  return source;
}
