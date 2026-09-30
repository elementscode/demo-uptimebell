/** 0.99934 -> "99.93%". Rounds down, so a single failure never reads as 100%. */
export function formatUptime(value: number | null): string {
  if (value === null || value === undefined) {
    return "—";
  }

  if (value >= 1) {
    return "100%";
  }

  return `${(Math.floor(value * 10000) / 100).toFixed(2)}%`;
}

export function formatMs(ms: number | null): string {
  if (ms === null || ms === undefined) {
    return "—";
  }

  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms} ms`;
}

export function timeAgo(date: Date | null, now: number): string {
  if (!date) {
    return "never";
  }

  let seconds = Math.max(0, Math.round((now - date.getTime()) / 1000));

  if (seconds < 60) {
    return seconds < 5 ? "just now" : `${seconds}s ago`;
  }

  let minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  let hours = Math.round(minutes / 60);

  if (hours < 48) {
    return `${hours}h ago`;
  }

  return `${Math.round(hours / 24)}d ago`;
}

export function formatDuration(from: Date, to: Date | null, now: number): string {
  let minutes = Math.max(1, Math.round(((to?.getTime() ?? now) - from.getTime()) / 60000));

  if (minutes < 60) {
    return `${minutes} min`;
  }

  let hours = Math.floor(minutes / 60);
  let rest = minutes % 60;

  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDay(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
