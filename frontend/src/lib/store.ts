import { useSyncExternalStore } from 'react';
import { buildCss, DEFAULT_THEME, normalizeTheme, sameTheme, themeAttributes, type XyloTheme } from './theme.ts';

const STYLE_ID = 'xylo-theme';
const CACHE_KEY = 'xylo:theme';
export const THEME_URL = '/xylo/theme';
const PREVIEW_MSG = 'xylo:preview';
export const READY_MSG = 'xylo:ready';
/**
 * A first visit has no cached theme: the page stays hidden (`data-xylo-pending`, app.css) until loadTheme() settles,
 * and at most this long, so a slow or failing request never leaves it blank.
 */
const PENDING_MS = 1500;

let saved: XyloTheme = DEFAULT_THEME;
let current: XyloTheme = DEFAULT_THEME;
let previewing = false;
let pendingTimer: number | undefined;
const listeners = new Set<() => void>();

export const savedTheme = () => saved;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The theme on screen, a draft included while the editor previews one; re-renders when it changes. */
export const useXyloTheme = () => useSyncExternalStore(subscribe, () => current);
/** The theme on screen, for code that runs outside a component (route names and filters); no re-render. */
export const currentTheme = () => current;

/**
 * Writes only what changed: a new stylesheet restyles the whole page, so a repaint with the same theme (the fetch
 * after the cached paint) must not replace it.
 */
function applyTheme(theme: XyloTheme) {
  let el = document.getElementById(STYLE_ID);
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  const css = buildCss(theme);
  if (el.textContent !== css) el.textContent = css;

  const data = document.documentElement.dataset;
  for (const [key, value] of Object.entries(themeAttributes(theme))) {
    if (data[key] !== value) data[key] = value;
  }
  if ('xyloPending' in data) delete data.xyloPending;

  if (sameTheme(theme, current)) return;
  current = theme;
  for (const listener of listeners) listener();
}

/** Ends the first visit guard with whatever is known by then. */
function reveal() {
  window.clearTimeout(pendingTimer);
  if ('xyloPending' in document.documentElement.dataset) applyTheme(previewing ? current : saved);
}

/** Makes `theme` the site theme on this page (the editor after a save) and caches it for the next load. */
export function rememberTheme(theme: XyloTheme) {
  saved = theme;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(theme));
  } catch {
    // private mode or full storage: the next load waits for the fetch again
  }
  if (!previewing) applyTheme(theme);
}

/** Paints the last known theme right away so the look never flashes in after the fetch. */
export function applyCachedTheme() {
  let cached: string | null = null;
  try {
    cached = localStorage.getItem(CACHE_KEY);
  } catch {
    // storage blocked: nothing cached
  }
  if (cached !== null) {
    try {
      saved = normalizeTheme(JSON.parse(cached));
    } catch {
      cached = null;
    }
  }
  if (cached === null) {
    document.documentElement.dataset.xyloPending = '';
    pendingTimer = window.setTimeout(reveal, PENDING_MS);
    return;
  }
  applyTheme(saved);
}

/**
 * Fetches the site theme and the version the server holds (the editor sends it back on save, so a save over someone
 * else's is refused). The route answers 304 to the browser's revalidation. Null when it failed.
 */
export async function loadTheme(): Promise<{ theme: XyloTheme; version: string } | null> {
  try {
    const res = await fetch(THEME_URL, { credentials: 'same-origin', headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    const data = (await res.json()) as { theme?: unknown; version?: unknown };
    const theme = normalizeTheme(data.theme);
    rememberTheme(theme);
    return { theme, version: typeof data.version === 'string' ? data.version : '' };
  } catch {
    return null;
  } finally {
    reveal();
  }
}

export type PreviewScheme = 'light' | 'dark';

// Mantine's localStorage colour scheme manager keeps the admin's choice under this key
const SCHEME_KEY = 'mantine-color-scheme-value';
const SCHEME_ATTR = 'data-mantine-color-scheme';
let previewScheme: PreviewScheme | null = null;

/** The editor renders the panel in an iframe and streams drafts into it, with the scheme to show them in. */
export function sendPreview(frame: HTMLIFrameElement | null, theme: XyloTheme, scheme: PreviewScheme) {
  frame?.contentWindow?.postMessage({ type: PREVIEW_MSG, theme, scheme }, window.location.origin);
}

/**
 * Keeps the preview frame in the scheme the editor asked for. The attribute repaints the CSS; the storage event is
 * Mantine's own cross tab sync, which moves its React state too (terminal colours, logos).
 */
function holdScheme() {
  const root = document.documentElement;
  if (!previewScheme || root.getAttribute(SCHEME_ATTR) === previewScheme) return;
  root.setAttribute(SCHEME_ATTR, previewScheme);
  window.dispatchEvent(
    new StorageEvent('storage', { key: SCHEME_KEY, newValue: previewScheme, storageArea: localStorage }),
  );
}

/** Inside the editor's preview frame: paints the drafts the editor sends instead of the site theme. */
export function listenForPreview() {
  if (window.parent === window) return;

  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin || event.source !== window.parent) return;
    const msg = event.data as { type?: string; theme?: unknown; scheme?: unknown } | null;
    if (msg?.type !== PREVIEW_MSG) return;

    previewing = true;
    applyTheme(normalizeTheme(msg.theme));
    if (msg.scheme === 'light' || msg.scheme === 'dark') {
      previewScheme = msg.scheme;
      holdScheme();
    }
  });

  // the frame shares localStorage with the editor: Mantine persists every scheme change, and a preview's scheme must
  // never become the admin's own; nor may the frame's cache write replace the editor's
  const setItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
    if (previewScheme && key === SCHEME_KEY) return;
    if (previewing && key === CACHE_KEY) return;
    setItem.call(this, key, value);
  };
  // Mantine sets the attribute again when it mounts, when the OS scheme flips on 'auto' and from other tabs
  new MutationObserver(holdScheme).observe(document.documentElement, { attributeFilter: [SCHEME_ATTR] });

  // the panel initialises extensions after its settings request, so the editor waits for this before sending
  window.parent.postMessage({ type: READY_MSG }, window.location.origin);
}
