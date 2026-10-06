import { hsl } from '../../lib/color.ts';

/**
 * The rail's server folders: core's server groups (made on the dashboard's grouped tab), shown the way Discord shows
 * server folders. Pure, so the tests can run it without the panel.
 */

/** The fields of core's servers and server groups the rail reads. */
export type RailServer = { uuid: string; name: string };
export type RailGroup = { uuid: string; name: string; order: number; serverOrder: string[] };

/** A folder's open state, per browser: the uuids of the open ones. */
export const FOLDERS_KEY = 'xylo:folders';
/** How many tiles a closed folder previews, in a 2 by 2 grid. */
export const FOLDER_PREVIEW = 4;
/** Core's cap on a server group's size (MAX_SERVERS_PER_GROUP). */
export const GROUP_MAX = 100;

/** Something picked up in the rail: a server (loose, `from` null, or out of a folder) or a whole folder. */
export type RailDrag =
  | { kind: 'server'; serverUuid: string; from: string | null }
  | { kind: 'folder'; groupUuid: string };
/**
 * Where it can land: a loose server, a server in an open folder (`member`), a folder (closed, or an open one's head
 * and padding), or the rail's free space.
 */
export type RailDropTarget =
  | { kind: 'server'; serverUuid: string }
  | { kind: 'member'; groupUuid: string; serverUuid: string }
  | { kind: 'folder'; groupUuid: string }
  | { kind: 'loose' };
/** Which part of the target the pointer is over: its upper or lower half (a place in a list), or the target itself. */
export type DropPart = 'before' | 'after' | 'onto';
/**
 * What a drop does, Discord style. `create`: the two servers make a new folder. `move`: `to` gets `serverOrder`
 * (null `to`: the server leaves its folder), and a server leaving `from` for another place is taken out of it.
 * `groups`: the folders' new order.
 */
export type RailDropAction =
  | { kind: 'create'; serverOrder: [string, string]; serverUuid: string; from: string | null }
  | { kind: 'move'; serverUuid: string; from: string | null; to: string | null; serverOrder: string[] }
  | { kind: 'groups'; order: string[] };

/**
 * The part of a target at `ratio` (0 at its top, 1 at its bottom). Only lists take a place: the servers in an open
 * folder for a server, the folders for a folder; anywhere else a drop lands on the target as a whole.
 */
export function dropPart(drag: RailDrag, target: RailDropTarget, ratio: number): DropPart {
  const ordered = drag.kind === 'server' ? target.kind === 'member' : target.kind === 'folder';
  if (!ordered) return 'onto';
  return ratio < 0.5 ? 'before' : 'after';
}

/** `list` with `item` moved (or added) next to `anchor`; null when `anchor` isn't in it or nothing would move. */
function placeNextTo(list: readonly string[], item: string, anchor: string, part: 'before' | 'after') {
  const placed = list.filter((uuid) => uuid !== item);
  const at = placed.indexOf(anchor);
  if (at === -1) return null;
  placed.splice(part === 'after' ? at + 1 : at, 0, item);
  return placed.some((uuid, i) => uuid !== list[i]) || placed.length !== list.length ? placed : null;
}

/** The drop's action, or null where it would change nothing or core would refuse it (a full folder, a duplicate). */
export function dropAction(
  drag: RailDrag,
  target: RailDropTarget,
  part: DropPart,
  groups: readonly RailGroup[],
): RailDropAction | null {
  if (drag.kind === 'folder') {
    if (target.kind !== 'folder' || part === 'onto' || target.groupUuid === drag.groupUuid) return null;
    // the order the rail shows: by `order`, ties in the order core listed them
    const current = [...groups].sort((a, b) => a.order - b.order).map((group) => group.uuid);
    const order = placeNextTo(current, drag.groupUuid, target.groupUuid, part);
    return order && { kind: 'groups', order };
  }

  const { serverUuid, from } = drag;
  if (target.kind === 'server') {
    if (target.serverUuid === serverUuid) return null;
    return { kind: 'create', serverOrder: [target.serverUuid, serverUuid], serverUuid, from };
  }
  if (target.kind === 'loose') {
    return from === null ? null : { kind: 'move', serverUuid, from, to: null, serverOrder: [] };
  }

  const group = groups.find((g) => g.uuid === target.groupUuid);
  if (!group) return null;
  // another folder takes the server only if it hasn't got it and has room
  if (group.uuid !== from && (group.serverOrder.includes(serverUuid) || group.serverOrder.length >= GROUP_MAX)) {
    return null;
  }
  let serverOrder: string[] | null;
  if (target.kind === 'member' && part !== 'onto') {
    if (target.serverUuid === serverUuid) return null;
    serverOrder = placeNextTo(group.serverOrder, serverUuid, target.serverUuid, part);
  } else {
    // onto the folder itself: to its end; a server already in it stays where it is
    serverOrder = group.uuid === from ? null : [...group.serverOrder, serverUuid];
  }
  if (!serverOrder) return null;
  return { kind: 'move', serverUuid, from, to: group.uuid, serverOrder };
}

/**
 * A group's servers in the group's own order (the dashboard's drag and drop rewrites `serverOrder` before the
 * servers are fetched again), dropping any the group no longer lists.
 */
export function orderGroupServers<S extends RailServer>(servers: readonly S[], serverOrder: readonly string[]): S[] {
  const position = new Map(serverOrder.map((uuid, index) => [uuid, index]));
  return servers
    .filter((server) => position.has(server.uuid))
    .sort((a, b) => (position.get(a.uuid) ?? 0) - (position.get(b.uuid) ?? 0));
}

/** The servers in no group, which the rail lists as loose tiles after the folders, at most `limit` of them. */
export function looseServers<S extends RailServer>(
  servers: readonly S[],
  groups: readonly RailGroup[],
  limit: number,
): S[] {
  const grouped = new Set(groups.flatMap((group) => group.serverOrder));
  return servers.filter((server) => !grouped.has(server.uuid)).slice(0, limit);
}

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
    .map((word) => word[0].toUpperCase())
    .join('');
  return initials || '?';
}

/**
 * A server's tile: its initials on a muted two step gradient of one hue from its name, the same in the rail and on
 * the page. Kept under 55% saturation so a column of them reads as identity, not a rainbow beside the one accent.
 */
export function serverTile(name: string) {
  const hue = hueOf(name);
  return {
    initials: initialsOf(name),
    background: `linear-gradient(135deg,${hsl(hue, 50, 48)},${hsl(hue + 18, 54, 36)})`,
  };
}

/** A folder's colour, from its group's name like a server tile's, as muted as the tiles. */
export function folderColor(name: string) {
  return hsl(hueOf(name), 45, 62);
}

/** The open folders saved in storage; anything malformed reads as none open. */
export function parseOpenFolders(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((uuid): uuid is string => typeof uuid === 'string') : [];
  } catch {
    return [];
  }
}
