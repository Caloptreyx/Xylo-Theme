import { axiosInstance } from '../lib/core.ts';
import type { XyloTheme } from '../lib/theme.ts';

/**
 * Stores the site theme (`null` goes back to the default look). With `base`, the backend refuses (409) when the stored
 * theme is no longer that version, so a save never silently replaces someone else's. Resolves to the new version.
 */
export default async function saveTheme(theme: XyloTheme | null, base?: string): Promise<string> {
  const { data } = await axiosInstance.put('/api/admin/extensions/dev.caloptreyx.xylo/theme', {
    theme,
    ...(base !== undefined ? { base } : {}),
  });
  const version = (data as { version?: unknown } | null)?.version;
  return typeof version === 'string' ? version : '';
}
