/**
 * Console line highlighting (`consoleHighlight`): a line the server printed without colour of its own is tinted when
 * it reads as an error or a warning. Pure, so the xterm hook (elements/console/xterm.ts) only wraps `term.write`.
 * Also each visitor's own terminal look (`terminalUserChoice`), parsed and laid over the theme here, kept by
 * lib/store.ts.
 */

import { TERMINAL_SCHEMES, TERMINAL_SKINS, type TerminalScheme, type TerminalSkin, type ZoronTheme } from './theme.ts';

// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escapes are what these match
const SGR = /\x1b\[([0-9;]*)m/g;
// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escapes are what these match
const ESCAPE = /\x1b\[[0-?]*[ -/]*[@-~]/g;
// biome-ignore lint/suspicious/noControlCharactersInRegex: a reset, `ESC[m` or `ESC[0m`
const RESET = /\x1b\[0?m/g;

/**
 * Upper case level words (`[12:00:00 ERROR]:`, `[Server thread/WARN]`), Java style exception and error class names,
 * stack frames and Python tracebacks. Lower case "error" is left alone: it shows up in chat and player names.
 */
const ERROR = /\b(?:ERROR|SEVERE|FATAL|CRITICAL|PANIC)\b|\b\w+(?:Exception|Error)\b|^\s+at [\w$.<>/]+\(|^Traceback \(/;
const WARN = /\bWARN(?:ING)?\b/;

/** SGR colour parameters: foreground 30 to 39 and 90 to 97, background 40 to 49 and 100 to 107. */
const isColour = (param: string) => {
  const n = Number(param);
  return (n >= 30 && n <= 49) || (n >= 90 && n <= 107);
};

export type LineLevel = 'error' | 'warn' | null;

export function lineLevel(line: string): LineLevel {
  const text = line.replace(ESCAPE, '');
  if (ERROR.test(text)) return 'error';
  if (WARN.test(text)) return 'warn';
  return null;
}

/**
 * `line` in ANSI red (errors) or yellow (warnings), so the terminal scheme picks the shade; untouched when it has
 * colour of its own or no level. A reset inside the line would end the tint, so the tint follows every reset.
 */
export function highlightLine(line: string): string {
  for (const match of line.matchAll(SGR)) {
    if (match[1].split(';').some(isColour)) return line;
  }
  const level = lineLevel(line);
  if (!level) return line;
  const tint = level === 'error' ? '\x1b[31m' : '\x1b[33m';
  return `${tint}${line.replace(RESET, (reset) => reset + tint)}\x1b[39m`;
}

/** What core writes: one line, or a newline and a line; `\r` stays with its line. */
export const highlightChunk = (chunk: string) => chunk.split('\n').map(highlightLine).join('\n');

/** A visitor's own terminal look; a missing field is the site's. */
export interface TerminalPrefs {
  scheme?: TerminalScheme;
  skin?: TerminalSkin;
}

/** Where a browser keeps its TerminalPrefs. */
export const TERMINAL_PREFS_KEY = 'zoron:terminal';

/** The stored prefs, each field allow listed; anything else (missing, broken JSON, unknown names) is the site's. */
export function parseTerminalPrefs(raw: string | null): TerminalPrefs {
  let value: unknown;
  try {
    value = JSON.parse(raw ?? 'null');
  } catch {
    return {};
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const { scheme, skin } = value as Record<string, unknown>;
  const prefs: TerminalPrefs = {};
  if (TERMINAL_SCHEMES.includes(scheme as TerminalScheme)) prefs.scheme = scheme as TerminalScheme;
  if (TERMINAL_SKINS.includes(skin as TerminalSkin)) prefs.skin = skin as TerminalSkin;
  return prefs;
}

/** `theme` with the visitor's choices over its scheme and frame, while the theme lets them choose. */
export function withTerminalPrefs(theme: ZoronTheme, prefs: TerminalPrefs): ZoronTheme {
  if (!theme.terminalUserChoice || (!prefs.scheme && !prefs.skin)) return theme;
  return {
    ...theme,
    terminalScheme: prefs.scheme ?? theme.terminalScheme,
    terminalSkin: prefs.skin ?? theme.terminalSkin,
  };
}
