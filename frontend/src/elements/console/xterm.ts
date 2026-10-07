/**
 * Xylo's hooks into core's xterm (`pages.server.console.xterm`), for every console: Xylo's page, core's and the
 * popout. The theme's terminal colours, mono font and line height, live as the theme changes (the editor's drafts
 * and the visitor's own terminal look included), and the highlighting of uncoloured warning and error lines.
 */

import { FitAddon } from '@xterm/addon-fit';
import type { ITerminalInitOnlyOptions, ITerminalOptions, ITheme, Terminal } from '@xterm/xterm';
import { currentTheme, subscribeTheme } from '../../lib/store.ts';
import { highlightChunk } from '../../lib/terminal.ts';
import { ANSI_NAMES, MONO_STACKS, terminalPalette } from '../../lib/theme.ts';

interface Tracked {
  /** The theme core last gave the terminal, kept for the 'panel' scheme. */
  core: ITheme | undefined;
  /** Core's font, for the 'panel' mono font. */
  coreFont: string | undefined;
  fit: FitAddon;
  /** Writes the terminal's theme past the interception below. */
  setTheme: (theme: ITheme | undefined) => void;
  /** Ends the theme subscription; set once the terminal opens. */
  unsubscribe: (() => void) | null;
}

/** The consoles on screen, in the order they opened. */
const tracked = new Map<Terminal, Tracked>();
/** What core passed to the constructor, carried from the init handler to the terminal it builds (synchronously). */
let pending: { theme: ITheme | undefined; font: string | undefined } = { theme: undefined, font: undefined };
let schemeObserver: MutationObserver | null = null;

/** The terminal theme for core's `core` theme: Xylo's palette over it, or core's own with the 'panel' scheme. */
function themeOver(core: ITheme | undefined): ITheme | undefined {
  const dark = document.documentElement.getAttribute('data-mantine-color-scheme') === 'dark';
  const palette = terminalPalette(currentTheme(), dark);
  if (!palette) return core;
  const theme: ITheme = {
    ...core,
    // core's xterm.css forces the layers transparent; the card behind paints `--xylo-term-bg` (app.css)
    background: '#00000000',
    foreground: palette.foreground,
    selectionBackground: `${palette.foreground}4d`,
    selectionInactiveBackground: `${palette.foreground}33`,
  };
  ANSI_NAMES.forEach((name, i) => {
    theme[name] = palette.ansi[i];
  });
  return theme;
}

function refit(term: Terminal, entry: Tracked) {
  requestAnimationFrame(() => {
    if (!tracked.has(term)) return;
    entry.fit.fit();
    term.refresh(0, term.rows - 1);
  });
}

/**
 * xterm measures its cells when the font option changes, not when a web font finishes loading, so a terminal opened
 * before Geist Mono or JetBrains Mono arrived keeps the fallback's cell width; measure again once it has.
 */
function measureWhenLoaded(term: Terminal, entry: Tracked, family: string) {
  const font = `${term.options.fontSize ?? 14}px ${family}`;
  if (!document.fonts || document.fonts.check(font)) return;
  document.fonts.load(font).then(
    (faces) => {
      if (faces.length === 0 || !tracked.has(term) || term.options.fontFamily !== family) return;
      term.options.fontFamily = 'monospace';
      term.options.fontFamily = family;
      refit(term, entry);
    },
    () => undefined,
  );
}

/** Puts the theme's colours, font and line height on a console, then fits it to the new cell size. */
function apply(term: Terminal, entry: Tracked) {
  const theme = currentTheme();
  entry.setTheme(themeOver(entry.core));
  const family = MONO_STACKS[theme.monoFont] ?? entry.coreFont;
  if (family) term.options.fontFamily = family;
  term.options.lineHeight = theme.terminalLineHeight / 100;
  refit(term, entry);
  if (family) measureWhenLoaded(term, entry, family);
}

/**
 * Core sets `term.options.theme` again whenever the colour scheme changes. xterm 6's `options` is a plain object
 * whose keys are accessors defined on it, configurable, so `theme` is redefined on this one terminal: what core
 * assigns is kept as its theme and Xylo's palette over it is what reaches xterm. Where that is not possible, the
 * scheme observer reapplies after core.
 */
function interceptTheme(term: Terminal, entry: Tracked) {
  try {
    const options = term.options;
    const own = Object.getOwnPropertyDescriptor(options, 'theme');
    if (!own?.configurable || !own.get || !own.set) return;
    const { get, set } = own;
    Object.defineProperty(options, 'theme', {
      configurable: true,
      enumerable: own.enumerable,
      get: () => get.call(options),
      set: (value: ITheme | undefined) => {
        entry.core = value;
        set.call(options, themeOver(value));
      },
    });
    entry.setTheme = (value) => set.call(options, value);
  } catch {
    // left to the scheme observer
  }
}

/** Light and dark switch on html's attribute; one observer for every console on screen. */
function watchScheme() {
  if (schemeObserver) return;
  schemeObserver = new MutationObserver(() => {
    // after core's own scheme effect, which a failed interception lets through
    requestAnimationFrame(() => {
      for (const entry of tracked.values()) entry.setTheme(themeOver(entry.core));
    });
  });
  schemeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-mantine-color-scheme'],
  });
}

export function initTerminal(options: ITerminalOptions & ITerminalInitOnlyOptions) {
  pending = { theme: options.theme, font: options.fontFamily };
  const theme = currentTheme();
  const family = MONO_STACKS[theme.monoFont];
  if (family) options.fontFamily = family;
  options.lineHeight = theme.terminalLineHeight / 100;
  options.theme = themeOver(options.theme);
}

/** Before it opens: highlighting on writes, and a fit addon of Xylo's own for font and line height changes. */
export function prepareTerminal(term: Terminal) {
  const fit = new FitAddon();
  term.loadAddon(fit);
  tracked.set(term, {
    core: pending.theme,
    coreFont: pending.font,
    fit,
    setTheme: (value) => {
      term.options.theme = value;
    },
    unsubscribe: null,
  });

  const write = term.write.bind(term);
  term.write = (data, callback) =>
    write(typeof data === 'string' && currentTheme().consoleHighlight ? highlightChunk(data) : data, callback);
}

export function openTerminal(term: Terminal) {
  const entry = tracked.get(term);
  if (!entry) return;
  interceptTheme(term, entry);
  entry.unsubscribe = subscribeTheme(() => apply(term, entry));
  watchScheme();
  const family = term.options.fontFamily;
  if (family) measureWhenLoaded(term, entry, family);
}

/** Core calls this after disposing the terminal. */
export function closeTerminal(term: Terminal) {
  tracked.get(term)?.unsubscribe?.();
  tracked.delete(term);
  if (tracked.size === 0) {
    schemeObserver?.disconnect();
    schemeObserver = null;
  }
}

/** The console whose card holds `node` (a header button), else the newest one on screen. */
export function terminalNear(node: Element): Terminal | null {
  const card = node.closest('.mantine-Card-root');
  let newest: Terminal | null = null;
  for (const term of tracked.keys()) {
    if (card && term.element && card.contains(term.element)) return term;
    newest = term;
  }
  return newest;
}
