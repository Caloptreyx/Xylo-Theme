import { useSyncExternalStore } from 'react';
import { z } from 'zod';
import {
  getUserSetting,
  httpErrorToHuman,
  removeUserSetting,
  setUserSetting,
  updateUserSettings,
  useToast,
  useUserSetting,
} from '../../lib/core.ts';
import {
  normalizeTiles,
  type ServerTiles,
  serverTile,
  TILES_KEY,
  type Tile,
  type TileStyle,
  withTile,
} from '../../lib/tiles.ts';

/** Core parses each setting through a schema; this one is normalizeTiles(), so a malformed map reads as none. */
const tilesSchema = z.unknown().transform(normalizeTiles);
const NONE: ServerTiles = {};

/**
 * The map being saved, shown until the panel answers. Core's own setter is optimistic too, but it retries in the
 * background and only logs a refusal (a map over the panel's size limit, an impersonating admin), so Xylo sends the
 * map itself and hands it to core's store once the panel took it.
 */
let pending: { id: number; tiles: ServerTiles } | null = null;
let saves = 0;
const listeners = new Set<() => void>();

function setPending(next: typeof pending) {
  pending = next;
  for (const listener of listeners) listener();
}

function subscribePending(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The user's tile looks, by server uuid: the one being saved, else core's (account scope, read through its store). */
export function useServerTiles(): ServerTiles {
  const [saved] = useUserSetting(TILES_KEY, tilesSchema, NONE);
  const unsaved = useSyncExternalStore(subscribePending, () => pending);
  return unsaved?.tiles ?? saved;
}

/** A server's tile with the user's look applied. */
export function useServerTile(server: { uuid: string; name: string }): Tile {
  return serverTile(server.name, useServerTiles()[server.uuid]);
}

/**
 * Saves one server's look (null for the default): shown at once, then sent. Accepted, it becomes core's value
 * (core keeps its copy in this browser and syncs it once more); refused, the last saved map shows again and core's
 * toast says why. Saves made while one is out build on it, and only the newest one's outcome changes what shows.
 */
export function useSaveTile() {
  const { addToast } = useToast();

  return async (uuid: string, style: TileStyle | null) => {
    const tiles = withTile(pending?.tiles ?? getUserSetting(TILES_KEY, tilesSchema, NONE), uuid, style);
    const id = ++saves;
    setPending({ id, tiles });
    const empty = Object.keys(tiles).length === 0;
    try {
      await updateUserSettings({ [TILES_KEY]: empty ? null : tiles });
      if (empty) removeUserSetting(TILES_KEY);
      else setUserSetting(TILES_KEY, tiles);
    } catch (err) {
      addToast(httpErrorToHuman(err), 'error');
    } finally {
      if (pending?.id === id) setPending(null);
    }
  };
}
