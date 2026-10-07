import type { OverviewLayout, OverviewSection } from '../../lib/theme.ts';

/**
 * The server overview's small rules: activity labels, relative times, usage levels and how its blocks lay out. Pure,
 * so the tests can run it without the panel.
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

/**
 * One row of the overview: 'single' stacks its blocks across the page; 'mainSide' and 'sideMain' put the activity
 * card beside a narrower stack of the others (on its right or left); 'even' sets its columns side by side at equal
 * widths. Below the wide breakpoint every row is one column, in the order the theme lists the blocks.
 */
export interface OverviewRow {
  kind: 'single' | 'mainSide' | 'sideMain' | 'even';
  columns: OverviewSection[][];
}

/**
 * The rows `blocks` (the ones shown, in the theme's order) make in `layout`. 'stacked' is one block a row. 'split'
 * (the original look) gives usage a row of its own and sets activity beside the blocks listed next to it, on the
 * side it was listed. 'wide' gives usage and activity rows of their own and pairs the connect and glance cards when
 * they are listed one after the other.
 */
export function overviewRows(blocks: readonly OverviewSection[], layout: OverviewLayout): OverviewRow[] {
  if (layout === 'stacked') return blocks.map((block) => ({ kind: 'single', columns: [[block]] }));

  const rows: OverviewRow[] = [];
  let run: OverviewSection[] = [];
  const flush = () => {
    if (run.length === 0) return;
    const main = run.filter((block) => block === 'activity');
    const side = run.filter((block) => block !== 'activity');
    if (layout === 'wide') rows.push({ kind: side.length > 1 ? 'even' : 'single', columns: side.map((b) => [b]) });
    else if (main.length === 0 || side.length === 0) rows.push({ kind: 'single', columns: [run] });
    else if (run[0] === 'activity') rows.push({ kind: 'mainSide', columns: [main, side] });
    else rows.push({ kind: 'sideMain', columns: [side, main] });
    run = [];
  };
  for (const block of blocks) {
    // the blocks that always take a row of their own in this layout
    if (block === 'usage' || (layout === 'wide' && block === 'activity')) {
      flush();
      rows.push({ kind: 'single', columns: [[block]] });
    } else {
      run.push(block);
    }
  }
  flush();
  return rows;
}
