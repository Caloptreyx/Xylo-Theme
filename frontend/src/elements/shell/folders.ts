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
