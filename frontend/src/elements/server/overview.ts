import {
  fillGaps,
  GRID_COLUMNS,
  GRID_MAX_HEIGHT,
  GRID_MIN_WIDTH,
  moveItem,
  placeItem,
  removeItem,
  resizeItem,
  settleGrid,
} from '../../lib/grid.ts';
import type { OverviewItem, OverviewSection } from '../../lib/theme.ts';

/**
 * The server overview's small rules: activity labels, relative times, usage levels, the grid a visitor sees, and the
 * geometry of Studio's arrange canvas (pointer distances to cells, drops, keyboard nudges). Pure, so the tests can run
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

/**
 * The theme's grid as a visitor sees it: without the blocks they may not see. When one was left out, the rest settle
 * and widen over the empty columns beside them, so the page has no hole; otherwise the grid is the theme's as is.
 */
export function visibleGrid(grid: readonly OverviewItem[], allowed: Record<OverviewSection, boolean>): OverviewItem[] {
  const shown = grid.filter((item) => allowed[item.block]);
  return shown.length === grid.length ? [...grid] : fillGaps(settleGrid(shown));
}

/** The size a block takes when it is added to the grid: usage across the page, activity tall beside the cards. */
export const BLOCK_SIZE: Record<OverviewSection, { w: number; h: number }> = {
  usage: { w: GRID_COLUMNS, h: 1 },
  activity: { w: 7, h: 2 },
  connect: { w: 5, h: 1 },
  glance: { w: 5, h: 1 },
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * The cell a dragged block `w` columns wide snaps to when its top left corner is `left`, `top` pixels from the grid's
 * top left corner: the nearest one, kept inside the columns and no lower than `rows` (the row just under the others,
 * the bottom a block can be dropped at).
 */
export function snapCell(left: number, top: number, cellWidth: number, rowHeight: number, w: number, rows: number) {
  return {
    x: clamp(Math.round(left / cellWidth), 0, GRID_COLUMNS - w),
    y: clamp(Math.round(top / rowHeight), 0, rows),
  };
}

/**
 * The size a block at column `item.x` takes when its corner is dragged `dx`, `dy` pixels: whole columns and rows, at
 * least GRID_MIN_WIDTH columns and no wider than the columns right of `item.x`, 1 to GRID_MAX_HEIGHT rows.
 */
export function snapSize(item: OverviewItem, dx: number, dy: number, cellWidth: number, rowHeight: number) {
  return {
    w: clamp(item.w + Math.round(dx / cellWidth), GRID_MIN_WIDTH, GRID_COLUMNS - item.x),
    h: clamp(item.h + Math.round(dy / rowHeight), 1, GRID_MAX_HEIGHT),
  };
}

/**
 * Where a drag of `block` leaves the grid: dropped on a cell it moves there (or, from the hidden blocks, joins at its
 * BLOCK_SIZE, kept inside the columns), dropped on the hidden blocks it leaves the grid, and dropped nowhere nothing
 * changes.
 */
export function dropGrid(
  grid: readonly OverviewItem[],
  block: OverviewSection,
  target: { x: number; y: number } | 'hide' | null,
): OverviewItem[] {
  if (target === 'hide') return removeItem(grid, block);
  if (!target) return [...grid];
  if (grid.some((item) => item.block === block)) return moveItem(grid, block, target.x, target.y);
  return placeItem(grid, { block, ...BLOCK_SIZE[block], ...target });
}

/**
 * A keyboard step on `block`: moved one cell (`dx`, `dy` of -1, 0 or 1), or with `resize` grown or shrunk by one
 * column or row from its top left corner. A step past an edge changes nothing.
 */
export function nudgeItem(
  grid: readonly OverviewItem[],
  block: OverviewSection,
  dx: number,
  dy: number,
  resize: boolean,
): OverviewItem[] {
  const item = grid.find((other) => other.block === block);
  if (!item) return [...grid];
  if (resize) {
    const w = clamp(item.w + dx, GRID_MIN_WIDTH, GRID_COLUMNS - item.x);
    const h = clamp(item.h + dy, 1, GRID_MAX_HEIGHT);
    return w === item.w && h === item.h ? [...grid] : resizeItem(grid, block, w, h);
  }
  const x = clamp(item.x + dx, 0, GRID_COLUMNS - item.w);
  const y = Math.max(0, item.y + dy);
  return x === item.x && y === item.y ? [...grid] : moveItem(grid, block, x, y);
}
