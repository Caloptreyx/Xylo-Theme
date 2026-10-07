import { useSyncExternalStore } from 'react';
import { parseTerminalPrefs, TERMINAL_PREFS_KEY, type TerminalPrefs, withTerminalPrefs } from './terminal.ts';
import { buildCss, DEFAULT_THEME, normalizeTheme, sameTheme, themeAttributes, type ZoronTheme } from './theme.ts';

const STYLE_ID = 'zoron-theme';
const CACHE_KEY = 'zoron:theme';
export const THEME_URL = '/zoron/theme';
const PREVIEW_MSG = 'zoron:preview';
export const READY_MSG = 'zoron:ready';
/**
 * A first visit has no cached theme: the page stays hidden (`data-zoron-pending`, app.css) until loadTheme() settles,
 * and at most this long, so a slow or failing request never leaves it blank.
 */
const PENDING_MS = 1500;

let saved: ZoronTheme = DEFAULT_THEME;
/** The theme given to paint (the site's, or a draft in the editor's preview), before the visitor's terminal look. */
let base: ZoronTheme = DEFAULT_THEME;
/** What is on screen: `base` with the visitor's terminal look over it. */
let current: ZoronTheme = DEFAULT_THEME;
let terminalPrefs: TerminalPrefs = {};
let previewing = false;
let pendingTimer: number | undefined;
const listeners = new Set<() => void>();
/** Studio's preview frame always shows the admin's terminal look, never the visitor's own. */
export const inPreviewFrame = window.parent !== window;

export const savedTheme = () => saved;

/**
 * Calls `listener` whenever the theme on screen (a draft included), the site's or the visitor's terminal look
 * changes; returns the unsubscribe.
 */
export function subscribeTheme(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The theme on screen, a draft included while the editor previews one; re-renders when it changes. */
export const useZoronTheme = () => useSyncExternalStore(subscribeTheme, () => current);
/** The theme on screen, for code that runs outside a component (route names and filters); no re-render. */
export const currentTheme = () => current;
/** The theme before the visitor's terminal look: what "Site default" shows. */
export const useBaseTheme = () => useSyncExternalStore(subscribeTheme, () => base);
export const useTerminalPrefs = () => useSyncExternalStore(subscribeTheme, () => terminalPrefs);

/**
 * Writes only what changed: a new stylesheet restyles the whole page, so a repaint with the same theme (the fetch
 * after the cached paint) must not replace it.
 */
function applyTheme(theme: ZoronTheme) {
  const shown = inPreviewFrame ? theme : withTerminalPrefs(theme, terminalPrefs);
  let el = document.getElementById(STYLE_ID);
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  const css = buildCss(shown);
  if (el.textContent !== css) el.textContent = css;

  const data = document.documentElement.dataset;
  for (const [key, value] of Object.entries(themeAttributes(shown))) {
    if (data[key] !== value) data[key] = value;
  }
  if ('zoronPending' in data) delete data.zoronPending;

  let changed = false;
  if (!sameTheme(theme, base)) {
    base = theme;
    changed = true;
  }
  if (!sameTheme(shown, current)) {
    current = shown;
    changed = true;
  }
  if (changed) for (const listener of listeners) listener();
}

/** Takes the visitor's terminal look (the picker, or another window's), repainting once the page is shown. */
function takeTerminalPrefs(prefs: TerminalPrefs) {
  terminalPrefs = prefs;
  if ('zoronPending' in document.documentElement.dataset) return;
  const before = current;
  applyTheme(base);
  // the picker shows the choice even when the look on screen stays the same (the site's own scheme picked)
  if (current === before) for (const listener of listeners) listener();
}

/** Keeps the visitor's terminal look in this browser and paints it; empty prefs return to the site's. */
export function setTerminalPrefs(prefs: TerminalPrefs) {
  try {
    if (prefs.scheme || prefs.skin) localStorage.setItem(TERMINAL_PREFS_KEY, JSON.stringify(prefs));
    else localStorage.removeItem(TERMINAL_PREFS_KEY);
  } catch {
    // private mode or full storage: the choice lasts until the page closes
  }
  takeTerminalPrefs(prefs);
}

/** Ends the first visit guard with whatever is known by then. */
function reveal() {
  window.clearTimeout(pendingTimer);
  if ('zoronPending' in document.documentElement.dataset) applyTheme(previewing ? base : saved);
}

/** Makes `theme` the site theme on this page (the editor after a save) and caches it for the next load. */
export function rememberTheme(theme: ZoronTheme) {
  saved = theme;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(theme));
  } catch {
    // private mode or full storage: the next load waits for the fetch again
  }
  if (!previewing) applyTheme(theme);
}

/**
 * Paints the last known theme right away so the look never flashes in after the fetch, with the visitor's terminal
 * look, which other windows (the console popout) may change later.
 */
export function applyCachedTheme() {
  let cached: string | null = null;
  try {
    cached = localStorage.getItem(CACHE_KEY);
    terminalPrefs = parseTerminalPrefs(localStorage.getItem(TERMINAL_PREFS_KEY));
  } catch {
    // storage blocked: nothing cached
  }
  window.addEventListener('storage', (event) => {
    if (event.key === TERMINAL_PREFS_KEY) takeTerminalPrefs(parseTerminalPrefs(event.newValue));
  });
  if (cached !== null) {
    try {
      saved = normalizeTheme(JSON.parse(cached));
    } catch {
      cached = null;
    }
  }
  if (cached === null) {
    document.documentElement.dataset.zoronPending = '';
    pendingTimer = window.setTimeout(reveal, PENDING_MS);
    return;
  }
  applyTheme(saved);
}

/**
 * Fetches the site theme and the version the server holds (the editor sends it back on save, so a save over someone
 * else's is refused). The route answers 304 to the browser's revalidation. Null when it failed.
 */
export async function loadTheme(): Promise<{ theme: ZoronTheme; version: string } | null> {
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
export function sendPreview(frame: HTMLIFrameElement | null, theme: ZoronTheme, scheme: PreviewScheme) {
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
