/**
 * Server tiles: the square that stands for a server in the rail, on the servers page, the overview and the console.
 * By default its initials on a muted colour from its name; each user may give a server their own name, colour and
 * icon, saved in core's user settings (account scope) under TILES_KEY as a map of server uuid to `TileStyle`.
 * Pure, so the tests can run it without the panel. The saved map comes back from the API as any JSON, so
 * `normalizeTiles()` checks every field before anything shows it.
 */

import { HEX, hsl, mix } from './color.ts';

/** The user setting holding the map. */
export const TILES_KEY = 'zoron::server_tiles';
/** Servers a map keeps at most; saving one more drops the one edited longest ago. */
export const MAX_TILE_SERVERS = 300;
/** A custom name's length, in characters. */
export const TILE_NAME_MAX = 32;

/**
 * The icons a tile may show instead of its initials: FontAwesome solid icons (`fa` plus the name in PascalCase,
 * mapped in elements/tiles/TileFace.tsx), picked to fit game servers.
 */
export const TILE_ICONS = [
  'cube',
  'cubes',
  'gamepad',
  'dice-d20',
  'chess-rook',
  'chess-knight',
  'dungeon',
  'dragon',
  'khanda',
  'hammer',
  'shield-halved',
  'crown',
  'gem',
  'coins',
  'trophy',
  'skull',
  'ghost',
  'hat-wizard',
  'wand-magic-sparkles',
  'flask',
  'book-skull',
  'scroll',
  'fire',
  'bolt',
  'leaf',
  'seedling',
  'tree',
  'mountain',
  'water',
  'snowflake',
  'sun',
  'moon',
  'star',
  'rocket',
  'robot',
  'meteor',
  'globe',
  'anchor',
  'crosshairs',
  'bomb',
  'paw',
  'campground',
  'server',
  'terminal',
] as const;
export type TileIcon = (typeof TILE_ICONS)[number];

/** A user's own look for one server; a field left out keeps the default (the real name, the colour, initials). */
export type TileStyle = { name?: string; color?: string; icon?: TileIcon };
/** Every customized server's look, by server uuid. */
export type ServerTiles = Readonly<Record<string, TileStyle>>;

/**
 * The colours the editor offers: the default tiles' own muted range (50% saturation, 48% lightness), eleven hues
 * round the wheel (with "from the name", one row in the editor).
 */
export const TILE_SWATCHES = [0, 28, 45, 90, 140, 170, 195, 215, 240, 270, 315].map((hue) => hsl(hue, 50, 48));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Control characters and the invisible bidi controls that would reorder the text around a name. */
const CONTROL = /[\p{Cc}\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu;

export const isTileIcon = (value: unknown): value is TileIcon => TILE_ICONS.some((icon) => icon === value);

/** A name's hue, so a server tile or folder keeps its colour wherever it shows. */
export function hueOf(name: string): number {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(hash) % 360;
}

/** Up to two initials from a name's words, `?` when it has none. */
export function initialsOf(name: string): string {
  const initials = name
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    // by code point, so a name starting with an emoji keeps it whole
    .map((word) => [...word][0].toUpperCase())
    .join('');
  return initials || '?';
}

/** A custom name as it is kept: one line, no control characters, trimmed, at most TILE_NAME_MAX characters. */
export function cleanTileName(raw: string): string {
  const clean = raw.replace(/\s+/g, ' ').replace(CONTROL, '').trim();
  return [...clean].slice(0, TILE_NAME_MAX).join('').trim();
}

/** One server's look with every field checked, or null when nothing in it is usable. */
export function normalizeTile(raw: unknown): TileStyle | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const tile: TileStyle = {};
  const name = 'name' in raw && typeof raw.name === 'string' ? cleanTileName(raw.name) : '';
  if (name) tile.name = name;
  if ('color' in raw && typeof raw.color === 'string' && HEX.test(raw.color)) tile.color = raw.color.toLowerCase();
  if ('icon' in raw && isTileIcon(raw.icon)) tile.icon = raw.icon;
  return tile.name || tile.color || tile.icon ? tile : null;
}

/**
 * The saved map, whatever it holds: keys must be server uuids (lowercased), each look is checked field by field,
 * looks with nothing usable and unknown fields are dropped, and only the first MAX_TILE_SERVERS servers are kept.
 * Anything that is not a map reads as no customization.
 */
export function normalizeTiles(raw: unknown): ServerTiles {
  const tiles: Record<string, TileStyle> = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return tiles;
  let count = 0;
  for (const [key, value] of Object.entries(raw)) {
    if (count >= MAX_TILE_SERVERS) break;
    const uuid = key.toLowerCase();
    if (!UUID.test(uuid) || Object.hasOwn(tiles, uuid)) continue;
    const tile = normalizeTile(value);
    if (!tile) continue;
    tiles[uuid] = tile;
    count++;
  }
  return tiles;
}

/**
 * The map with one server's look replaced (null, or a look with nothing in it, removes it). The edited server moves
 * to the end, so when the map is full the server edited longest ago is the one dropped.
 */
export function withTile(tiles: ServerTiles, uuid: string, style: TileStyle | null): ServerTiles {
  const key = uuid.toLowerCase();
  const tile = normalizeTile(style);
  const rest = Object.entries(tiles).filter(([other]) => other !== key);
  const entries = tile && UUID.test(key) ? [...rest, [key, tile] as const] : rest;
  return Object.fromEntries(entries.slice(Math.max(0, entries.length - MAX_TILE_SERVERS)));
}

/** A tile's fill: a two step gradient from the colour to a darker step of it. */
export function tileBackground(color: string): string {
  return `linear-gradient(135deg,${color},${mix(color, '#000000', 0.75)})`;
}

/** A server's tile as every place draws it. */
export type Tile = {
  /** the name it shows: the user's own, or the real one */
  label: string;
  /** whether `label` is the user's own name */
  custom: boolean;
  /** from `label` */
  initials: string;
  /** null shows the initials */
  icon: TileIcon | null;
  /** a CSS background */
  background: string;
};

/**
 * A server's tile. Without a colour of the user's, a muted two step gradient of one hue from the real name, the same
 * in the rail and on the page, kept under 55% saturation so a column of them reads as identity, not a rainbow beside
 * the one accent.
 */
export function serverTile(name: string, style?: TileStyle): Tile {
  const label = style?.name ?? name;
  const hue = hueOf(name);
  return {
    label,
    custom: style?.name !== undefined,
    initials: initialsOf(label),
    icon: style?.icon ?? null,
    background: style?.color
      ? tileBackground(style.color)
      : `linear-gradient(135deg,${hsl(hue, 50, 48)},${hsl(hue + 18, 54, 36)})`,
  };
}
