/**
 * The server overview's small rules: activity labels, relative times and usage levels. Pure, so the tests can run
 * it without the panel.
 */

/** An activity event as a short sentence-case label: `server:power.start` reads "Power start". */
export function eventLabel(event: string): string {
  const words = event
    .slice(event.indexOf(':') + 1)
    .replace(/[._-]+/g, ' ')
    .trim();
  return words ? words[0].toUpperCase() + words.slice(1) : event;
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86_400],
  ['month', 30 * 86_400],
  ['week', 7 * 86_400],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

/** How long ago (or how soon) `date` is from `now`, in its largest whole unit: "3 minutes ago", "yesterday". */
export function timeAgo(date: Date, now: Date, locale?: string): string {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const format = new Intl.RelativeTimeFormat(locale || undefined, { numeric: 'auto' });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return format.format(Math.trunc(seconds / size), unit);
  }
  return format.format(seconds, 'second');
}

/** A used amount as a share of its limit, 0 to 100; null without a limit (0 is core's "unlimited"). */
export function percentOf(used: number, limit: number | null): number | null {
  return limit && limit > 0 ? Math.min(100, Math.max(0, (used / limit) * 100)) : null;
}

/** A usage bar's level: calm below 80%, warning to 95%, then danger, as core colours usage. */
export function levelOf(percent: number | null): 'warn' | 'danger' | undefined {
  if (percent === null || percent < 80) return undefined;
  return percent < 95 ? 'warn' : 'danger';
}

/** The newest of some dated items by one of their dates, or null when none has it. */
export function newest<T>(items: readonly T[], dateOf: (item: T) => Date | null): T | null {
  let best: T | null = null;
  let bestTime = Number.NEGATIVE_INFINITY;
  for (const item of items) {
    const time = dateOf(item)?.getTime();
    if (time !== undefined && time > bestTime) {
      best = item;
      bestTime = time;
    }
  }
  return best;
}
