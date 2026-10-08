/**
 * The snap grid the server overview's blocks sit on (`overviewGrid`), and the moves Studio's arrange canvas makes on
 * it. GRID_COLUMNS columns; rows are as tall as the cards in them, so a block's height (`h`) is in rows: a block two
 * rows tall beside two one row blocks stacks those two beside it. Blocks never overlap and fall upwards as far as they
 * can, so a layout has no empty rows. Pure and generic over the block names, so the tests run it without the panel.
 */

export const GRID_COLUMNS = 12;
/** The narrowest a block may be, in columns. */
export const GRID_MIN_WIDTH = 3;
/** The tallest a block may be, in rows. */
export const GRID_MAX_HEIGHT = 4;
/** Deeper than any real layout; keeps a hostile `y` from making the placement loop long. */
const MAX_Y = 64;

export interface GridItem<T extends string = string> {
  block: T;
  /** First column, from 0. */
  x: number;
  /** First row, from 0. */
  y: number;
  /** Width in columns, GRID_MIN_WIDTH to GRID_COLUMNS. */
  w: number;
  /** Height in rows, 1 to GRID_MAX_HEIGHT. */
  h: number;
}

const clampInt = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(v)));

/** `item` with every number a whole one inside the grid. */
export function clampItem<T extends string>(item: GridItem<T>): GridItem<T> {
  const w = clampInt(item.w, GRID_MIN_WIDTH, GRID_COLUMNS);
  return {
    block: item.block,
    x: clampInt(item.x, 0, GRID_COLUMNS - w),
    y: clampInt(item.y, 0, MAX_Y),
    w,
    h: clampInt(item.h, 1, GRID_MAX_HEIGHT),
  };
}

const overlaps = (a: GridItem, b: GridItem) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Each item, in order, at the highest row where it overlaps none of `placed` or those placed before it. */
function fall<T extends string>(order: readonly GridItem<T>[], placed: GridItem<T>[] = []): GridItem<T>[] {
  for (const item of order) {
    let y = 0;
    while (placed.some((other) => overlaps({ ...item, y }, other))) y++;
    placed.push({ ...item, y });
  }
  return placed;
}

/**
 * The items without overlaps or empty rows, each as high up as it fits, placed in reading order of where they ask to
 * be (row, then column). A `pinned` block (the one just moved or resized) is placed first, right where it asks to be,
 * and the others make room around it; then everything falls up once more, so it never leaves an empty row above it.
 * Returned in reading order.
 */
export function settleGrid<T extends string>(items: readonly GridItem<T>[], pinned?: T): GridItem<T>[] {
  const order = sortGrid(items.map(clampItem));
  const pin = order.find((item) => item.block === pinned);
  const placed = fall(
    order.filter((item) => item !== pin),
    pin ? [pin] : [],
  );
  return pin ? sortGrid(fall(sortGrid(placed))) : sortGrid(placed);
}

/** Reading order: by row, then column; the order the blocks stack in on a narrow page. */
export function sortGrid<T extends string>(items: readonly GridItem<T>[]): GridItem<T>[] {
  return [...items].sort((a, b) => a.y - b.y || a.x - b.x);
}

/** `block` moved so its top left corner is at column `x`, row `y`; the others make room and everything settles. */
export function moveItem<T extends string>(items: readonly GridItem<T>[], block: T, x: number, y: number) {
  return settleGrid(
    items.map((item) => (item.block === block ? { ...item, x, y } : item)),
    block,
  );
}

/** `block` resized to `w` columns and `h` rows from its top left corner (kept inside the grid); the rest settles. */
export function resizeItem<T extends string>(items: readonly GridItem<T>[], block: T, w: number, h: number) {
  return settleGrid(
    items.map((item) => {
      if (item.block !== block) return item;
      const width = clampInt(w, GRID_MIN_WIDTH, GRID_COLUMNS);
      return { ...item, x: Math.min(item.x, GRID_COLUMNS - width), w: width, h };
    }),
    block,
  );
}

/** `item` added (or, when its block is already there, moved and resized) where it asks to be. */
export function placeItem<T extends string>(items: readonly GridItem<T>[], item: GridItem<T>) {
  return settleGrid([...items.filter((other) => other.block !== item.block), item], item.block);
}

/** The grid without `block`; what was below it falls up. */
export function removeItem<T extends string>(items: readonly GridItem<T>[], block: T) {
  return settleGrid(items.filter((item) => item.block !== block));
}

/** How many rows the items take. */
export function gridRows(items: readonly GridItem[]): number {
  return items.reduce((rows, item) => Math.max(rows, item.y + item.h), 0);
}

/**
 * Each item widened over the empty columns on either side of it, in every row it spans: what a visitor without the
 * permission for one block sees, so the blocks beside it close the gap rather than leave a hole.
 */
export function fillGaps<T extends string>(items: readonly GridItem<T>[]): GridItem<T>[] {
  const out = sortGrid(items).map((item) => ({ ...item }));
  for (const item of out) {
    const beside = out.filter((other) => other !== item && other.y < item.y + item.h && item.y < other.y + other.h);
    const left = Math.max(0, ...beside.filter((o) => o.x + o.w <= item.x).map((o) => o.x + o.w));
    const right = Math.min(GRID_COLUMNS, ...beside.filter((o) => o.x >= item.x + item.w).map((o) => o.x));
    item.w = right - left;
    item.x = left;
  }
  return out;
}

/**
 * A saved grid as the allow list and the grid's bounds permit: an array of `{ block, x, y, w, h }`, each block known
 * and only once (the first wins), numbers whole and inside the grid, then settled. Null when `v` is not an array.
 */
export function normalizeGrid<T extends string>(v: unknown, blocks: readonly T[]): GridItem<T>[] | null {
  if (!Array.isArray(v)) return null;
  const out: GridItem<T>[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const r = raw as Record<string, unknown>;
    const block = blocks.find((name) => name === r.block);
    if (!block || out.some((item) => item.block === block)) continue;
    const num = (value: unknown, fallback: number) =>
      typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    out.push(clampItem({ block, x: num(r.x, 0), y: num(r.y, MAX_Y), w: num(r.w, GRID_COLUMNS), h: num(r.h, 1) }));
  }
  return settleGrid(out);
}
