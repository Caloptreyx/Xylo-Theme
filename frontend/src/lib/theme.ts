import { alpha, contrastRatio, HEX, hsl, luminance, mix, readable, shades } from './color.ts';

/**
 * The saved theme is operator supplied JSON that ends up in a stylesheet served to every visitor (the login page
 * included). normalizeTheme() is the only way in: colours must be hex, numbers are clamped, choices allow listed,
 * URLs checked by SAFE_URL, unknown fields dropped. Nothing reaches buildCss() or the html attributes without it.
 */

export const FONTS = ['geist', 'inter', 'jakarta', 'space', 'outfit', 'system', 'panel'] as const;
export type Font = (typeof FONTS)[number];
export const MONO_FONTS = ['geistMono', 'jetbrains', 'system', 'panel'] as const;
export type MonoFont = (typeof MONO_FONTS)[number];
/** The ambient layer behind everything: drifting colour fields, a single glow, a four corner mesh, or none. */
export const BACKDROPS = ['aurora', 'spotlight', 'mesh', 'solid'] as const;
export type Backdrop = (typeof BACKDROPS)[number];
/** A faint texture over the backdrop. */
export const PATTERNS = ['none', 'grid', 'dots', 'noise'] as const;
export type Pattern = (typeof PATTERNS)[number];
/** Cards: translucent and blurred, opaque, or see-through with a stronger outline. */
export const SURFACES = ['glass', 'solid', 'outline'] as const;
export type Surface = (typeof SURFACES)[number];
export const SHADOWS = ['none', 'soft', 'deep'] as const;
export type Shadow = (typeof SHADOWS)[number];
/** Navigation: Xylo's icon rail and context panel (elements/shell), or core's sidebar floating or flush. */
export const SIDEBARS = ['rail', 'floating', 'docked'] as const;
export type Sidebar = (typeof SIDEBARS)[number];
export const BUTTON_STYLES = ['gradient', 'solid', 'soft', 'outline'] as const;
export type ButtonStyle = (typeof BUTTON_STYLES)[number];
/** The current sidebar link: a filled gradient pill, a soft tint with a glow, an edge bar, or a plain tint. */
export const NAV_STYLES = ['pill', 'glow', 'bar', 'subtle'] as const;
export type NavStyle = (typeof NAV_STYLES)[number];
export const DENSITIES = ['compact', 'comfortable', 'spacious'] as const;
export type Density = (typeof DENSITIES)[number];
/** 'subtle' keeps hovers and page transitions but stops the backdrop drifting; 'none' turns every animation off. */
export const MOTIONS = ['full', 'subtle', 'none'] as const;
export type Motion = (typeof MOTIONS)[number];
export const TRANSITIONS = ['rise', 'fade', 'zoom', 'none'] as const;
export type Transition = (typeof TRANSITIONS)[number];

/** The server overview's blocks: live usage, recent activity, how to connect, and backups, schedules, addresses. */
export const OVERVIEW_SECTIONS = ['usage', 'activity', 'connect', 'glance'] as const;
export type OverviewSection = (typeof OVERVIEW_SECTIONS)[number];
/**
 * How the overview lays its blocks out: activity beside a column of the connect and glance cards (usage across the
 * top), one column, or every block across with the connect and glance cards side by side.
 */
export const OVERVIEW_LAYOUTS = ['split', 'stacked', 'wide'] as const;
export type OverviewLayout = (typeof OVERVIEW_LAYOUTS)[number];
/** The usage figures: a bar against the limit, a sparkline of the last minute, or the figures alone. */
export const OVERVIEW_USAGE = ['bars', 'graphs', 'numbers'] as const;
export type OverviewUsage = (typeof OVERVIEW_USAGE)[number];
/** The overview's head: the name on the page, or a tinted band with the server's tile. */
export const OVERVIEW_HEADERS = ['plain', 'banner'] as const;
export type OverviewHeader = (typeof OVERVIEW_HEADERS)[number];
/** How many activity entries the overview may list; one page of core's activity holds 25. */
export const MIN_OVERVIEW_ACTIVITY = 3;
export const MAX_OVERVIEW_ACTIVITY = 20;

/**
 * The console's colours: derived from the theme, core's own (no override), or a named scheme. Named schemes keep
 * their own background in either mode, as a terminal usually does.
 */
export const TERMINAL_SCHEMES = [
  'theme',
  'panel',
  'oneDark',
  'dracula',
  'nord',
  'gruvbox',
  'tokyoNight',
  'catppuccin',
  'solarized',
  'monokai',
  'githubDark',
  'rosePine',
  'everforest',
  'kanagawa',
  'githubLight',
  'solarizedLight',
  'phosphor',
  'amber',
] as const;
export type TerminalScheme = (typeof TERMINAL_SCHEMES)[number];

/** The schemes as Studio and the console's picker list them: matched to the panel, dark, light, retro. */
export const TERMINAL_SCHEME_GROUPS = [
  { id: 'matched', schemes: ['theme', 'panel'] },
  {
    id: 'dark',
    schemes: [
      'oneDark',
      'dracula',
      'nord',
      'gruvbox',
      'tokyoNight',
      'catppuccin',
      'solarized',
      'monokai',
      'githubDark',
      'rosePine',
      'everforest',
      'kanagawa',
    ],
  },
  { id: 'light', schemes: ['githubLight', 'solarizedLight'] },
  { id: 'retro', schemes: ['phosphor', 'amber'] },
] as const satisfies readonly { id: string; schemes: readonly TerminalScheme[] }[];

/**
 * The frame around every console (app.css, on the card holding `.xterm`): core's card, a window with a title bar,
 * none, frosted glass, a CRT (static glow, scanlines, vignette) or a neon accent outline.
 */
export const TERMINAL_SKINS = ['card', 'window', 'flush', 'glass', 'crt', 'neon'] as const;
export type TerminalSkin = (typeof TERMINAL_SKINS)[number];

/** The figures the console's command bar can show, in the order it shows them. */
export const CONSOLE_METRICS = ['cpu', 'memory', 'disk', 'netIn', 'netOut'] as const;
export type ConsoleMetric = (typeof CONSOLE_METRICS)[number];
/** The command bar's sparklines: a line over a faint fill, the line alone, thin columns, or none (figures only). */
export const CONSOLE_GRAPHS = ['area', 'line', 'bars', 'none'] as const;
export type ConsoleGraph = (typeof CONSOLE_GRAPHS)[number];
/** Where the console's inspector sits (docked or sliding in from that side), or 'off' for none at all. */
export const CONSOLE_INSPECTORS = ['right', 'left', 'off'] as const;
export type ConsoleInspector = (typeof CONSOLE_INSPECTORS)[number];
/** Site wide quick commands: at most this many, each at most MAX_SITE_COMMAND characters. */
export const MAX_SITE_COMMANDS = 12;
export const MAX_SITE_COMMAND = 200;

export interface XyloTheme {
  accent: string;
  /** The gradient's second stop and the backdrop's second colour. */
  accent2: string;
  background: string;
  surface: string;
  text: string;
  /** Empty keeps core's status colours. */
  success: string;
  warning: string;
  danger: string;
  /** Empty derives light mode from the dark colours. */
  lightBackground: string;
  lightSurface: string;
  lightText: string;

  backdrop: Backdrop;
  backdropIntensity: number;
  backdropAnimate: boolean;
  pattern: Pattern;
  patternOpacity: number;
  /** http(s) or root relative, checked by SAFE_URL; empty for none. */
  backgroundImage: string;
  backgroundDim: number;

  surfaceStyle: Surface;
  surfaceOpacity: number;
  blur: number;
  borderStrength: number;
  shadow: Shadow;
  radius: number;
  controlRadius: number;

  sidebar: Sidebar;
  density: Density;
  /** Percent of the browser's base font size; everything sized in rem follows. */
  uiScale: number;

  buttonStyle: ButtonStyle;
  navStyle: NavStyle;
  glow: number;

  font: Font;
  headingFont: Font;
  monoFont: MonoFont;
  headingWeight: number;
  gradientTitles: boolean;

  motion: Motion;
  pageTransition: Transition;
  hoverLift: boolean;
  /** A greeting with the user's name above the servers list. */
  greeting: boolean;
  /** Xylo's servers page (elements/home): live stats, filters and power controls in place of core's list. */
  homePage: boolean;
  /** Xylo's server overview (elements/server) as the page a server opens on; the console moves to `/terminal`. */
  serverOverview: boolean;
  /** The overview's blocks in the order they show; one left out is hidden (each also needs its permission). */
  overviewSections: OverviewSection[];
  overviewLayout: OverviewLayout;
  overviewUsage: OverviewUsage;
  /** How many recent activity entries the overview lists, MIN_OVERVIEW_ACTIVITY to MAX_OVERVIEW_ACTIVITY. */
  overviewActivityCount: number;
  overviewHeader: OverviewHeader;
  /** Whether the overview shows the server's description under its name. */
  overviewDescription: boolean;
  /** Xylo's console page (elements/console): a full height terminal, live readouts, a details panel. */
  consolePage: boolean;
  terminalScheme: TerminalScheme;
  terminalSkin: TerminalSkin;
  /** Line height in percent of the font size. */
  terminalLineHeight: number;
  /** Tints uncoloured console lines that read as errors or warnings (lib/terminal.ts). */
  consoleHighlight: boolean;
  /**
   * A button in the terminal's header lets each visitor pick their own scheme and frame, kept in their browser
   * (lib/terminal.ts, lib/store.ts).
   */
  terminalUserChoice: boolean;
  /** The figures the console's command bar shows; none hides the telemetry. */
  consoleMetrics: ConsoleMetric[];
  /** How the command bar draws each figure's last minute. */
  consoleGraphs: ConsoleGraph;
  consoleInspector: ConsoleInspector;
  /** Whether the docked inspector starts open for visitors who never toggled it (`xylo:console-panel` wins). */
  consoleInspectorOpen: boolean;
  /** The spacing of the console's command bar, toolbar, chip row and prompt. */
  consoleDensity: Density;
  /** Quick commands at all: the chip row above the prompt and the inspector's Commands tab. */
  consoleQuickCommands: boolean;
  /** Quick commands the admins set for everyone who may use the console, shown before each visitor's own. */
  consoleCommands: string[];
  /** Looks the admins saved in Studio, applied like the built in presets. */
  customPresets: CustomPreset[];
}

export interface CustomPreset {
  name: string;
  look: PresetLook;
}

/**
 * What a preset sets: the whole look. Status colours, light mode overrides, density, scale, the code font, motion
 * and the content fields (greeting, servers page, background image) stay the draft's, since they are about the site,
 * not the style.
 */
export type PresetLook = Pick<
  XyloTheme,
  | 'accent'
  | 'accent2'
  | 'background'
  | 'surface'
  | 'text'
  | 'backdrop'
  | 'backdropIntensity'
  | 'backdropAnimate'
  | 'pattern'
  | 'patternOpacity'
  | 'surfaceStyle'
  | 'surfaceOpacity'
  | 'blur'
  | 'borderStrength'
  | 'shadow'
  | 'radius'
  | 'controlRadius'
  | 'sidebar'
  | 'buttonStyle'
  | 'navStyle'
  | 'glow'
  | 'font'
  | 'headingFont'
  | 'headingWeight'
  | 'gradientTitles'
  | 'pageTransition'
>;

/**
 * The default look: a cool off-black base, one desaturated accent (accent2 only a lighter step of it, so the
 * "gradient" stays a single hue), solid surfaces, a faint spotlight and grain, no glow, Geist. Aurora's violet to
 * cyan glass is a preset to choose rather than the default.
 */
const CARBON: PresetLook = {
  accent: '#7c9fe0',
  accent2: '#93b1e9',
  background: '#0c0d10',
  surface: '#15171b',
  text: '#e6e8ec',
  backdrop: 'spotlight',
  backdropIntensity: 22,
  backdropAnimate: false,
  pattern: 'noise',
  patternOpacity: 30,
  surfaceStyle: 'solid',
  surfaceOpacity: 100,
  blur: 0,
  borderStrength: 40,
  shadow: 'soft',
  radius: 14,
  controlRadius: 9,
  sidebar: 'rail',
  buttonStyle: 'solid',
  navStyle: 'bar',
  glow: 0,
  font: 'geist',
  headingFont: 'geist',
  headingWeight: 600,
  gradientTitles: false,
  pageTransition: 'fade',
};

const AURORA: PresetLook = {
  accent: '#7c5cff',
  accent2: '#22d3ee',
  background: '#09090f',
  surface: '#12121c',
  text: '#e9e9f2',
  backdrop: 'aurora',
  backdropIntensity: 60,
  backdropAnimate: true,
  pattern: 'grid',
  patternOpacity: 35,
  surfaceStyle: 'glass',
  surfaceOpacity: 72,
  blur: 18,
  borderStrength: 45,
  shadow: 'soft',
  radius: 16,
  controlRadius: 10,
  sidebar: 'rail',
  buttonStyle: 'gradient',
  navStyle: 'pill',
  glow: 55,
  font: 'inter',
  headingFont: 'inter',
  headingWeight: 650,
  gradientTitles: false,
  pageTransition: 'rise',
};

export const DEFAULT_THEME: XyloTheme = {
  ...CARBON,
  success: '',
  warning: '',
  danger: '',
  lightBackground: '',
  lightSurface: '',
  lightText: '',
  backgroundImage: '',
  backgroundDim: 70,
  density: 'comfortable',
  uiScale: 100,
  monoFont: 'geistMono',
  motion: 'full',
  hoverLift: true,
  greeting: true,
  homePage: true,
  serverOverview: true,
  overviewSections: [...OVERVIEW_SECTIONS],
  overviewLayout: 'split',
  overviewUsage: 'bars',
  overviewActivityCount: 8,
  overviewHeader: 'plain',
  overviewDescription: true,
  consolePage: true,
  terminalScheme: 'theme',
  terminalSkin: 'card',
  terminalLineHeight: 120,
  consoleHighlight: true,
  terminalUserChoice: true,
  consoleMetrics: [...CONSOLE_METRICS],
  consoleGraphs: 'area',
  consoleInspector: 'right',
  consoleInspectorOpen: true,
  consoleDensity: 'comfortable',
  consoleQuickCommands: true,
  consoleCommands: [],
  customPresets: [],
};

export type PresetId =
  | 'carbon'
  | 'aurora'
  | 'nebula'
  | 'lagoon'
  | 'verdant'
  | 'ember'
  | 'graphite'
  | 'mono'
  | 'sandstone';

export interface Preset {
  id: PresetId;
  style: 'glass' | 'minimal';
  look: PresetLook;
}

export const PRESETS: Preset[] = [
  { id: 'carbon', style: 'minimal', look: CARBON },
  { id: 'aurora', style: 'glass', look: AURORA },
  {
    id: 'nebula',
    style: 'glass',
    look: {
      accent: '#ec4899',
      accent2: '#8b5cf6',
      background: '#0c0710',
      surface: '#171019',
      text: '#f4e9f3',
      backdrop: 'aurora',
      backdropIntensity: 70,
      backdropAnimate: true,
      pattern: 'noise',
      patternOpacity: 40,
      surfaceStyle: 'glass',
      surfaceOpacity: 68,
      blur: 22,
      borderStrength: 40,
      shadow: 'deep',
      radius: 20,
      controlRadius: 12,
      sidebar: 'rail',
      buttonStyle: 'gradient',
      navStyle: 'glow',
      glow: 70,
      font: 'jakarta',
      headingFont: 'jakarta',
      headingWeight: 700,
      gradientTitles: true,
      pageTransition: 'zoom',
    },
  },
  {
    id: 'lagoon',
    style: 'glass',
    look: {
      accent: '#06b6d4',
      accent2: '#3b82f6',
      background: '#050d12',
      surface: '#0b1820',
      text: '#e2f3f8',
      backdrop: 'spotlight',
      backdropIntensity: 65,
      backdropAnimate: true,
      pattern: 'dots',
      patternOpacity: 35,
      surfaceStyle: 'glass',
      surfaceOpacity: 74,
      blur: 16,
      borderStrength: 45,
      shadow: 'soft',
      radius: 14,
      controlRadius: 10,
      sidebar: 'rail',
      buttonStyle: 'gradient',
      navStyle: 'pill',
      glow: 50,
      font: 'inter',
      headingFont: 'space',
      headingWeight: 600,
      gradientTitles: false,
      pageTransition: 'rise',
    },
  },
  {
    id: 'verdant',
    style: 'glass',
    look: {
      accent: '#10b981',
      accent2: '#a3e635',
      background: '#060f0b',
      surface: '#0d1a14',
      text: '#e5f4ec',
      backdrop: 'mesh',
      backdropIntensity: 55,
      backdropAnimate: true,
      pattern: 'grid',
      patternOpacity: 30,
      surfaceStyle: 'glass',
      surfaceOpacity: 76,
      blur: 16,
      borderStrength: 45,
      shadow: 'soft',
      radius: 16,
      controlRadius: 10,
      sidebar: 'rail',
      buttonStyle: 'gradient',
      navStyle: 'bar',
      glow: 45,
      font: 'outfit',
      headingFont: 'outfit',
      headingWeight: 600,
      gradientTitles: false,
      pageTransition: 'rise',
    },
  },
  {
    id: 'ember',
    style: 'glass',
    look: {
      accent: '#f97316',
      accent2: '#f43f5e',
      background: '#100907',
      surface: '#1b1210',
      text: '#f8ece6',
      backdrop: 'aurora',
      backdropIntensity: 55,
      backdropAnimate: true,
      pattern: 'noise',
      patternOpacity: 35,
      surfaceStyle: 'glass',
      surfaceOpacity: 74,
      blur: 18,
      borderStrength: 40,
      shadow: 'deep',
      radius: 18,
      controlRadius: 12,
      sidebar: 'rail',
      buttonStyle: 'gradient',
      navStyle: 'glow',
      glow: 60,
      font: 'jakarta',
      headingFont: 'jakarta',
      headingWeight: 700,
      gradientTitles: true,
      pageTransition: 'rise',
    },
  },
  {
    id: 'graphite',
    style: 'minimal',
    look: {
      accent: '#3b82f6',
      accent2: '#6366f1',
      background: '#0b0b0d',
      surface: '#141417',
      text: '#ededf0',
      backdrop: 'solid',
      backdropIntensity: 0,
      backdropAnimate: false,
      pattern: 'none',
      patternOpacity: 0,
      surfaceStyle: 'solid',
      surfaceOpacity: 100,
      blur: 0,
      borderStrength: 55,
      shadow: 'none',
      radius: 10,
      controlRadius: 8,
      sidebar: 'rail',
      buttonStyle: 'solid',
      navStyle: 'subtle',
      glow: 0,
      font: 'inter',
      headingFont: 'inter',
      headingWeight: 600,
      gradientTitles: false,
      pageTransition: 'fade',
    },
  },
  {
    id: 'mono',
    style: 'minimal',
    look: {
      accent: '#fafafa',
      accent2: '#a1a1aa',
      background: '#000000',
      surface: '#0a0a0a',
      text: '#ededed',
      backdrop: 'spotlight',
      backdropIntensity: 18,
      backdropAnimate: false,
      pattern: 'grid',
      patternOpacity: 25,
      surfaceStyle: 'outline',
      surfaceOpacity: 100,
      blur: 0,
      borderStrength: 70,
      shadow: 'none',
      radius: 12,
      controlRadius: 8,
      sidebar: 'rail',
      buttonStyle: 'solid',
      navStyle: 'bar',
      glow: 0,
      font: 'inter',
      headingFont: 'inter',
      headingWeight: 600,
      gradientTitles: false,
      pageTransition: 'fade',
    },
  },
  {
    id: 'sandstone',
    style: 'minimal',
    look: {
      accent: '#e4b363',
      accent2: '#e07a5f',
      background: '#11100d',
      surface: '#1a1814',
      text: '#efe8dc',
      backdrop: 'spotlight',
      backdropIntensity: 30,
      backdropAnimate: false,
      pattern: 'noise',
      patternOpacity: 30,
      surfaceStyle: 'solid',
      surfaceOpacity: 100,
      blur: 0,
      borderStrength: 40,
      shadow: 'soft',
      radius: 14,
      controlRadius: 10,
      sidebar: 'rail',
      buttonStyle: 'soft',
      navStyle: 'subtle',
      glow: 15,
      font: 'jakarta',
      headingFont: 'space',
      headingWeight: 600,
      gradientTitles: false,
      pageTransition: 'rise',
    },
  },
];

// anything that could close the url("...") or the rule it sits in is refused outright; `//host` is protocol
// relative (another origin), not root relative, so a leading `/` must not be followed by another
export const SAFE_URL = /^(https?:\/\/|\/(?!\/))[^\s"'()\\<>;{}]+$/i;
const MAX_URL = 2048;

const color = (v: unknown, fallback: string) => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : fallback);
const optionalColor = (v: unknown, fallback: string) => (v === '' ? '' : color(v, fallback));
const choice = <T extends string>(v: unknown, list: readonly T[], fallback: T): T =>
  list.includes(v as T) ? (v as T) : fallback;
const int = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
const flag = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
const record = (v: unknown) =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/** The fields a preset sets, in PresetLook's order. */
export const LOOK_KEYS = Object.keys(CARBON) as (keyof PresetLook)[];
export const MAX_CUSTOM_PRESETS = 12;
export const MAX_PRESET_NAME = 32;

/** A name as shown: control characters dropped, trimmed; null when nothing or too much is left. */
export function presetName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what it removes
  const name = v.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return name.length > 0 && name.length <= MAX_PRESET_NAME ? name : null;
}

export const pickLook = (t: XyloTheme): PresetLook =>
  Object.fromEntries(LOOK_KEYS.map((key) => [key, t[key]])) as PresetLook;

/** A site command as shown and sent: control characters dropped, trimmed; null when nothing or too much is left. */
export function siteCommand(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what it removes
  const command = v.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return command.length > 0 && command.length <= MAX_SITE_COMMAND ? command : null;
}

/** Valid site commands only, no repeats, at most MAX_SITE_COMMANDS. */
function siteCommands(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback;
  const out: string[] = [];
  for (const item of v) {
    const command = siteCommand(item);
    if (command && !out.includes(command)) out.push(command);
    if (out.length === MAX_SITE_COMMANDS) break;
  }
  return out;
}

/** The allow listed figures in `v`, each once, in CONSOLE_METRICS order. */
function consoleMetrics(v: unknown, fallback: ConsoleMetric[]): ConsoleMetric[] {
  if (!Array.isArray(v)) return fallback;
  return CONSOLE_METRICS.filter((metric) => v.includes(metric));
}

/** The allow listed overview blocks in `v`, each once, in the order given. */
function overviewSections(v: unknown, fallback: OverviewSection[]): OverviewSection[] {
  if (!Array.isArray(v)) return fallback;
  const out: OverviewSection[] = [];
  for (const item of v) {
    if (OVERVIEW_SECTIONS.includes(item) && !out.includes(item)) out.push(item);
  }
  return out;
}

/** At most MAX_CUSTOM_PRESETS entries with a valid, unique name; each look normalized like a theme. */
function customPresets(v: unknown, fallback: CustomPreset[]): CustomPreset[] {
  if (!Array.isArray(v)) return fallback;
  const out: CustomPreset[] = [];
  for (const item of v) {
    const entry = record(item);
    const name = presetName(entry?.name);
    const look = record(entry?.look);
    if (!name || !look || out.some((p) => p.name === name)) continue;
    // a look never carries presets of its own, so this does not recurse
    out.push({ name, look: pickLook(normalizeTheme({ ...look, customPresets: [] })) });
    if (out.length === MAX_CUSTOM_PRESETS) break;
  }
  return out;
}

export function normalizeTheme(raw: unknown, d: XyloTheme = DEFAULT_THEME): XyloTheme {
  const r = record(raw) ?? {};
  const image = r.backgroundImage;

  return {
    accent: color(r.accent, d.accent),
    accent2: color(r.accent2, d.accent2),
    background: color(r.background, d.background),
    surface: color(r.surface, d.surface),
    text: color(r.text, d.text),
    success: optionalColor(r.success, d.success),
    warning: optionalColor(r.warning, d.warning),
    danger: optionalColor(r.danger, d.danger),
    lightBackground: optionalColor(r.lightBackground, d.lightBackground),
    lightSurface: optionalColor(r.lightSurface, d.lightSurface),
    lightText: optionalColor(r.lightText, d.lightText),

    backdrop: choice(r.backdrop, BACKDROPS, d.backdrop),
    backdropIntensity: int(r.backdropIntensity, 0, 100, d.backdropIntensity),
    backdropAnimate: flag(r.backdropAnimate, d.backdropAnimate),
    pattern: choice(r.pattern, PATTERNS, d.pattern),
    patternOpacity: int(r.patternOpacity, 0, 100, d.patternOpacity),
    backgroundImage:
      image === ''
        ? ''
        : typeof image === 'string' && image.length <= MAX_URL && SAFE_URL.test(image)
          ? image
          : d.backgroundImage,
    backgroundDim: int(r.backgroundDim, 0, 95, d.backgroundDim),

    surfaceStyle: choice(r.surfaceStyle, SURFACES, d.surfaceStyle),
    surfaceOpacity: int(r.surfaceOpacity, 30, 100, d.surfaceOpacity),
    blur: int(r.blur, 0, 40, d.blur),
    borderStrength: int(r.borderStrength, 0, 100, d.borderStrength),
    shadow: choice(r.shadow, SHADOWS, d.shadow),
    radius: int(r.radius, 0, 32, d.radius),
    controlRadius: int(r.controlRadius, 0, 24, d.controlRadius),

    sidebar: choice(r.sidebar, SIDEBARS, d.sidebar),
    density: choice(r.density, DENSITIES, d.density),
    uiScale: int(r.uiScale, 85, 115, d.uiScale),

    buttonStyle: choice(r.buttonStyle, BUTTON_STYLES, d.buttonStyle),
    navStyle: choice(r.navStyle, NAV_STYLES, d.navStyle),
    glow: int(r.glow, 0, 100, d.glow),

    font: choice(r.font, FONTS, d.font),
    headingFont: choice(r.headingFont, FONTS, d.headingFont),
    monoFont: choice(r.monoFont, MONO_FONTS, d.monoFont),
    headingWeight: int(r.headingWeight, 400, 800, d.headingWeight),
    gradientTitles: flag(r.gradientTitles, d.gradientTitles),

    motion: choice(r.motion, MOTIONS, d.motion),
    pageTransition: choice(r.pageTransition, TRANSITIONS, d.pageTransition),
    hoverLift: flag(r.hoverLift, d.hoverLift),
    greeting: flag(r.greeting, d.greeting),
    homePage: flag(r.homePage, d.homePage),
    serverOverview: flag(r.serverOverview, d.serverOverview),
    overviewSections: overviewSections(r.overviewSections, d.overviewSections),
    overviewLayout: choice(r.overviewLayout, OVERVIEW_LAYOUTS, d.overviewLayout),
    overviewUsage: choice(r.overviewUsage, OVERVIEW_USAGE, d.overviewUsage),
    overviewActivityCount: int(
      r.overviewActivityCount,
      MIN_OVERVIEW_ACTIVITY,
      MAX_OVERVIEW_ACTIVITY,
      d.overviewActivityCount,
    ),
    overviewHeader: choice(r.overviewHeader, OVERVIEW_HEADERS, d.overviewHeader),
    overviewDescription: flag(r.overviewDescription, d.overviewDescription),
    consolePage: flag(r.consolePage, d.consolePage),
    terminalScheme: choice(r.terminalScheme, TERMINAL_SCHEMES, d.terminalScheme),
    terminalSkin: choice(r.terminalSkin, TERMINAL_SKINS, d.terminalSkin),
    terminalLineHeight: int(r.terminalLineHeight, 100, 180, d.terminalLineHeight),
    consoleHighlight: flag(r.consoleHighlight, d.consoleHighlight),
    terminalUserChoice: flag(r.terminalUserChoice, d.terminalUserChoice),
    consoleMetrics: consoleMetrics(r.consoleMetrics, d.consoleMetrics),
    consoleGraphs: choice(r.consoleGraphs, CONSOLE_GRAPHS, d.consoleGraphs),
    consoleInspector: choice(r.consoleInspector, CONSOLE_INSPECTORS, d.consoleInspector),
    consoleInspectorOpen: flag(r.consoleInspectorOpen, d.consoleInspectorOpen),
    consoleDensity: choice(r.consoleDensity, DENSITIES, d.consoleDensity),
    consoleQuickCommands: flag(r.consoleQuickCommands, d.consoleQuickCommands),
    consoleCommands: siteCommands(r.consoleCommands, d.consoleCommands),
    customPresets: customPresets(r.customPresets, d.customPresets),
  };
}

/** A preset's look laid over `base`, which keeps the fields a preset leaves alone. */
export function applyPreset(base: XyloTheme, look: PresetLook): XyloTheme {
  return normalizeTheme({ ...base, ...look }, base);
}

/** Field by field equality; comparing JSON would depend on key order, which differs between sources. */
export function sameTheme(a: XyloTheme, b: XyloTheme): boolean {
  return (Object.keys(DEFAULT_THEME) as (keyof XyloTheme)[]).every((key) => {
    if (key === 'customPresets') {
      const [x, y] = [a.customPresets, b.customPresets];
      return (
        x.length === y.length &&
        x.every((p, i) => p.name === y[i].name && LOOK_KEYS.every((look) => p.look[look] === y[i].look[look]))
      );
    }
    const [x, y] = [a[key], b[key]];
    return Array.isArray(x) && Array.isArray(y)
      ? x.length === y.length && x.every((item, i) => item === y[i])
      : x === y;
  });
}

export type Palette = Pick<XyloTheme, 'accent' | 'accent2' | 'background' | 'surface' | 'text'>;

/**
 * A dark palette around one hue: a bright accent, an analogous second stop `spread` degrees on, and near black
 * neutrals tinted with the hue. Lightness is fixed per role, so text always reads on the surface.
 */
export function generatePalette(hue: number, spread = 48): Palette {
  return {
    accent: hsl(hue, 86, 64),
    accent2: hsl(hue + spread, 84, 60),
    background: hsl(hue, 32, 4.5),
    surface: hsl(hue, 26, 8.5),
    text: hsl(hue, 22, 93),
  };
}

export const FONT_STACKS: Record<Font, string | null> = {
  geist: "'Geist Variable', 'Geist', ui-sans-serif, system-ui, sans-serif",
  inter: "'Inter Variable', 'Inter', ui-sans-serif, system-ui, sans-serif",
  jakarta: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif",
  space: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
  outfit: "'Outfit', ui-sans-serif, system-ui, sans-serif",
  system: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  panel: null,
};

export const MONO_STACKS: Record<MonoFont, string | null> = {
  geistMono: "'Geist Mono Variable', 'Geist Mono', ui-monospace, Menlo, Consolas, monospace",
  jetbrains: "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace",
  system: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  panel: null,
};

/** Mantine's spacing scale in rem, multiplied per density. */
const SPACING: [string, number][] = [
  ['xs', 0.625],
  ['sm', 0.75],
  ['md', 1],
  ['lg', 1.25],
  ['xl', 2],
];
const DENSITY_SCALE: Record<Density, number> = { compact: 0.8, comfortable: 1, spacious: 1.2 };

/** Light mode's base colours: the dark page becomes the ink, the surfaces near white with a hint of accent. */
export function lightBase(t: XyloTheme) {
  const ink = mix(t.background, '#0b0b10', 0.5);
  const text = t.lightText || (luminance(ink) < 0.03 ? ink : '#14141c');
  return {
    background: t.lightBackground || mix(t.accent, '#f4f4f7', 0.05),
    surface: t.lightSurface || mix(t.accent, '#ffffff', 0.015),
    text,
  };
}

/** Mantine's dark scale: 0 is text, 4 borders, 6 cards, 7 the page. */
function darkScale(t: XyloTheme): string[] {
  const { text, background, surface } = t;
  return [
    text,
    mix(text, background, 0.8),
    mix(text, background, 0.6),
    mix(text, background, 0.42),
    mix(text, background, 0.16),
    mix(text, background, 0.09),
    surface,
    background,
    mix(background, '#000000', 0.75),
    mix(background, '#000000', 0.55),
  ];
}

/** The fills text sits on: the accent, and with gradient buttons or pill links both gradient stops. */
const accentFills = (t: XyloTheme) =>
  t.buttonStyle === 'gradient' || t.navStyle === 'pill' ? [t.accent, t.accent2] : [t.accent];

/** White or near black, whichever reads better on the worst of the accent fills; white wins ties. */
export function accentInk(t: XyloTheme): string {
  const fills = accentFills(t);
  const worst = (ink: string) => Math.min(...fills.map((fill) => contrastRatio(ink, fill)));
  return worst('#ffffff') >= worst('#0b0b10') ? '#ffffff' : '#0b0b10';
}

/** xterm's sixteen colour names in ANSI order: SGR 30 to 37, then the bright 90 to 97. */
export const ANSI_NAMES = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'brightBlack',
  'brightRed',
  'brightGreen',
  'brightYellow',
  'brightBlue',
  'brightMagenta',
  'brightCyan',
  'brightWhite',
] as const;

export interface TerminalPalette {
  background: string;
  foreground: string;
  /** In ANSI_NAMES order. */
  ansi: string[];
}

/**
 * The named schemes as their authors publish them (Catppuccin is Mocha, Everforest dark medium, Kanagawa Wave,
 * GitHub the Primer defaults; Solarized dark's bright black is base01 rather than the background, as most ports do,
 * so dim text stays visible). Phosphor and Amber are Xylo's own monochrome screens: every colour is a shade of the
 * one hue, so coloured output stays readable.
 */
export const NAMED_TERMINALS: Record<Exclude<TerminalScheme, 'theme' | 'panel'>, TerminalPalette> = {
  oneDark: {
    background: '#282c34',
    foreground: '#abb2bf',
    ansi: [
      '#3f4451',
      '#e06c75',
      '#98c379',
      '#e5c07b',
      '#61afef',
      '#c678dd',
      '#56b6c2',
      '#d7dae0',
      '#4f5666',
      '#ff7b86',
      '#b1e18b',
      '#efb074',
      '#67cdff',
      '#e48bff',
      '#63d4e0',
      '#e6e6e6',
    ],
  },
  dracula: {
    background: '#282a36',
    foreground: '#f8f8f2',
    ansi: [
      '#21222c',
      '#ff5555',
      '#50fa7b',
      '#f1fa8c',
      '#bd93f9',
      '#ff79c6',
      '#8be9fd',
      '#f8f8f2',
      '#6272a4',
      '#ff6e6e',
      '#69ff94',
      '#ffffa5',
      '#d6acff',
      '#ff92df',
      '#a4ffff',
      '#ffffff',
    ],
  },
  nord: {
    background: '#2e3440',
    foreground: '#d8dee9',
    ansi: [
      '#3b4252',
      '#bf616a',
      '#a3be8c',
      '#ebcb8b',
      '#81a1c1',
      '#b48ead',
      '#88c0d0',
      '#e5e9f0',
      '#4c566a',
      '#bf616a',
      '#a3be8c',
      '#ebcb8b',
      '#81a1c1',
      '#b48ead',
      '#8fbcbb',
      '#eceff4',
    ],
  },
  gruvbox: {
    background: '#282828',
    foreground: '#ebdbb2',
    ansi: [
      '#282828',
      '#cc241d',
      '#98971a',
      '#d79921',
      '#458588',
      '#b16286',
      '#689d6a',
      '#a89984',
      '#928374',
      '#fb4934',
      '#b8bb26',
      '#fabd2f',
      '#83a598',
      '#d3869b',
      '#8ec07c',
      '#ebdbb2',
    ],
  },
  tokyoNight: {
    background: '#1a1b26',
    foreground: '#c0caf5',
    ansi: [
      '#15161e',
      '#f7768e',
      '#9ece6a',
      '#e0af68',
      '#7aa2f7',
      '#bb9af7',
      '#7dcfff',
      '#a9b1d6',
      '#414868',
      '#f7768e',
      '#9ece6a',
      '#e0af68',
      '#7aa2f7',
      '#bb9af7',
      '#7dcfff',
      '#c0caf5',
    ],
  },
  catppuccin: {
    background: '#1e1e2e',
    foreground: '#cdd6f4',
    ansi: [
      '#45475a',
      '#f38ba8',
      '#a6e3a1',
      '#f9e2af',
      '#89b4fa',
      '#f5c2e7',
      '#94e2d5',
      '#bac2de',
      '#585b70',
      '#f38ba8',
      '#a6e3a1',
      '#f9e2af',
      '#89b4fa',
      '#f5c2e7',
      '#94e2d5',
      '#a6adc8',
    ],
  },
  solarized: {
    background: '#002b36',
    foreground: '#839496',
    ansi: [
      '#073642',
      '#dc322f',
      '#859900',
      '#b58900',
      '#268bd2',
      '#d33682',
      '#2aa198',
      '#eee8d5',
      '#586e75',
      '#cb4b16',
      '#586e75',
      '#657b83',
      '#839496',
      '#6c71c4',
      '#93a1a1',
      '#fdf6e3',
    ],
  },
  monokai: {
    background: '#272822',
    foreground: '#f8f8f2',
    ansi: [
      '#272822',
      '#f92672',
      '#a6e22e',
      '#f4bf75',
      '#66d9ef',
      '#ae81ff',
      '#a1efe4',
      '#f8f8f2',
      '#75715e',
      '#f92672',
      '#a6e22e',
      '#f4bf75',
      '#66d9ef',
      '#ae81ff',
      '#a1efe4',
      '#f9f8f5',
    ],
  },
  githubDark: {
    background: '#0d1117',
    foreground: '#e6edf3',
    ansi: [
      '#484f58',
      '#ff7b72',
      '#3fb950',
      '#d29922',
      '#58a6ff',
      '#bc8cff',
      '#39c5cf',
      '#b1bac4',
      '#6e7681',
      '#ffa198',
      '#56d364',
      '#e3b341',
      '#79c0ff',
      '#d2a8ff',
      '#56d4dd',
      '#ffffff',
    ],
  },
  rosePine: {
    background: '#191724',
    foreground: '#e0def4',
    ansi: [
      '#26233a',
      '#eb6f92',
      '#31748f',
      '#f6c177',
      '#9ccfd8',
      '#c4a7e7',
      '#ebbcba',
      '#e0def4',
      '#6e6a86',
      '#eb6f92',
      '#31748f',
      '#f6c177',
      '#9ccfd8',
      '#c4a7e7',
      '#ebbcba',
      '#e0def4',
    ],
  },
  everforest: {
    background: '#2d353b',
    foreground: '#d3c6aa',
    ansi: [
      '#475258',
      '#e67e80',
      '#a7c080',
      '#dbbc7f',
      '#7fbbb3',
      '#d699b6',
      '#83c092',
      '#d3c6aa',
      '#475258',
      '#e67e80',
      '#a7c080',
      '#dbbc7f',
      '#7fbbb3',
      '#d699b6',
      '#83c092',
      '#d3c6aa',
    ],
  },
  kanagawa: {
    background: '#1f1f28',
    foreground: '#dcd7ba',
    ansi: [
      '#090618',
      '#c34043',
      '#76946a',
      '#c0a36e',
      '#7e9cd8',
      '#957fb8',
      '#6a9589',
      '#c8c093',
      '#727169',
      '#e82424',
      '#98bb6c',
      '#e6c384',
      '#7fb4ca',
      '#938aa9',
      '#7aa89f',
      '#dcd7ba',
    ],
  },
  githubLight: {
    background: '#ffffff',
    foreground: '#1f2328',
    ansi: [
      '#24292f',
      '#cf222e',
      '#116329',
      '#4d2d00',
      '#0969da',
      '#8250df',
      '#1b7c83',
      '#6e7781',
      '#57606a',
      '#a40e26',
      '#1a7f37',
      '#633c01',
      '#218bff',
      '#a475f9',
      '#3192aa',
      '#8c959f',
    ],
  },
  solarizedLight: {
    background: '#fdf6e3',
    foreground: '#657b83',
    ansi: [
      '#073642',
      '#dc322f',
      '#859900',
      '#b58900',
      '#268bd2',
      '#d33682',
      '#2aa198',
      '#eee8d5',
      '#002b36',
      '#cb4b16',
      '#586e75',
      '#657b83',
      '#839496',
      '#6c71c4',
      '#93a1a1',
      '#fdf6e3',
    ],
  },
  phosphor: {
    background: '#050c07',
    foreground: '#5af58e',
    ansi: [
      '#1c3a27',
      '#c2ffd6',
      '#5af58e',
      '#a0fbbc',
      '#3dbd6b',
      '#7fe3a2',
      '#4fd69a',
      '#a8f0c0',
      '#4a8f62',
      '#dcffe8',
      '#8cffb2',
      '#c9ffda',
      '#5fd98a',
      '#acf5c6',
      '#7beec0',
      '#eafff1',
    ],
  },
  amber: {
    background: '#0e0903',
    foreground: '#ffb000',
    ansi: [
      '#3d2a0a',
      '#ffdcaa',
      '#ffb000',
      '#ffcc66',
      '#d98a00',
      '#ffc27a',
      '#e8a33a',
      '#ffd699',
      '#a8740f',
      '#ffe8c7',
      '#ffc23d',
      '#ffdb8f',
      '#f0a020',
      '#ffd3a3',
      '#f5bb5c',
      '#fff2dc',
    ],
  },
};

/**
 * The console's colours in dark or light mode; null for 'panel', which keeps core's. 'theme' sinks the terminal a
 * step below the page, takes red, green and yellow from the status colours and blue from the accent, and darkens or
 * lightens every hue until it reads on that background at 4.5:1.
 */
export function terminalPalette(t: XyloTheme, dark: boolean): TerminalPalette | null {
  if (t.terminalScheme === 'panel') return null;
  if (t.terminalScheme !== 'theme') return NAMED_TERMINALS[t.terminalScheme];

  const light = lightBase(t);
  const fg = dark ? t.text : light.text;
  const bg = dark ? mix(t.background, '#000000', 0.7) : mix(light.text, light.surface, 0.035);
  // black, bright black, white, bright white: steps between the background and the text
  const [black, brightBlack, white, brightWhite] = (dark ? [0.3, 0.5, 0.8, 1] : [0.95, 0.65, 0.5, 0.35]).map((w) =>
    mix(fg, bg, w),
  );
  const hues = [
    t.danger || '#ef6b73',
    t.success || '#7fcf8b',
    t.warning || '#e5c07b',
    t.accent,
    mix('#c792ea', t.accent, 0.8),
    mix('#6fc8d6', t.accent, 0.8),
  ];
  const normal = hues.map((c) => readable(c, fg, bg));
  const bright = hues.map((c) => readable(dark ? mix(c, '#ffffff', 0.8) : mix(c, '#000000', 0.85), fg, bg));
  return { background: bg, foreground: fg, ansi: [black, ...normal, white, brightBlack, ...bright, brightWhite] };
}

export interface ContrastIssue {
  pair: 'text' | 'dimmed' | 'accentInk' | 'lightText';
  ratio: number;
  min: number;
}

/** WCAG AA pairs the theme paints, below their minimum: 4.5:1 for text, 3:1 for the label text on accent fills. */
export function contrastIssues(t: XyloTheme): ContrastIssue[] {
  const light = lightBase(t);
  const dark = darkScale(t);
  const ink = accentInk(t);
  const pairs: [ContrastIssue['pair'], number, number][] = [
    ['text', contrastRatio(t.text, t.surface), 4.5],
    ['dimmed', contrastRatio(dark[2], t.surface), 4.5],
    ['accentInk', Math.min(...accentFills(t).map((fill) => contrastRatio(ink, fill))), 3],
    ['lightText', contrastRatio(light.text, light.surface), 4.5],
  ];
  return pairs
    .map(([pair, ratio, min]) => ({ pair, ratio: Math.round(ratio * 100) / 100, min }))
    .filter((issue) => issue.ratio < issue.min);
}

/** What static CSS (app.css) keys off; every value is an allow listed choice. */
export function themeAttributes(t: XyloTheme): Record<string, string> {
  return {
    xylo: '',
    xyloBackdrop: t.backgroundImage ? 'image' : t.backdrop,
    xyloAnimate: t.backdropAnimate && t.motion === 'full' && t.backdrop !== 'solid' ? 'on' : 'off',
    xyloPattern: t.patternOpacity > 0 ? t.pattern : 'none',
    xyloSurface: t.surfaceStyle,
    xyloShadow: t.shadow,
    xyloSidebar: t.sidebar,
    xyloButtons: t.buttonStyle,
    xyloNav: t.navStyle,
    xyloMotion: t.motion,
    xyloTransition: t.motion === 'none' ? 'none' : t.pageTransition,
    xyloLift: t.hoverLift && t.motion !== 'none' ? 'on' : 'off',
    xyloTitles: t.gradientTitles ? 'gradient' : 'plain',
    xyloTerminal: t.terminalScheme === 'panel' ? 'panel' : 'custom',
    xyloTermSkin: t.terminalSkin,
  };
}

type Vars = [string, string][];

const vars = (entries: Vars) => entries.map(([k, v]) => `${k}:${v};`).join('');
const scale = (name: string, values: string[]): Vars => values.map((v, i) => [`--mantine-color-${name}-${i}`, v]);

/** The scheme dependent Xylo variables app.css paints with. */
function surfaceVars(t: XyloTheme, s: { surface: string; text: string; background: string }, dark: boolean): Vars {
  const a = t.surfaceOpacity / 100;
  const card =
    t.surfaceStyle === 'glass'
      ? alpha(s.surface, a)
      : t.surfaceStyle === 'outline'
        ? alpha(s.surface, dark ? 0.35 : 0.55)
        : s.surface;
  const raised = mix(s.text, s.surface, dark ? 0.035 : 0.02);
  const border = (dark ? 0.05 : 0.08) + (t.borderStrength / 100) * (dark ? 0.13 : 0.14);
  const intensity = (t.backdropIntensity / 100) * (dark ? 1 : 0.55);
  const glow = t.glow / 100;
  return [
    ['--xylo-card', card],
    ['--xylo-card-solid', s.surface],
    ['--xylo-overlay', t.surfaceStyle === 'glass' ? alpha(raised, 0.9) : raised],
    // the rail layout's content canvas: halfway between page and card, translucent unless the surfaces are solid
    [
      '--xylo-canvas',
      t.surfaceStyle === 'solid'
        ? mix(s.surface, s.background, 0.55)
        : alpha(mix(s.surface, s.background, 0.55), dark ? 0.6 : 0.7),
    ],
    ['--xylo-hairline', alpha(s.text, t.surfaceStyle === 'outline' ? border * 1.5 : border)],
    ['--xylo-sheen', alpha('#ffffff', dark ? 0.035 + glow * 0.03 : 0.6)],
    ['--xylo-shadow-color', dark ? 'rgba(0, 0, 0, 0.55)' : alpha(mix(t.accent, '#1a1a2e', 0.15), 0.14)],
    ['--xylo-glow-color', alpha(t.accent, (dark ? 0.5 : 0.35) * glow)],
    ['--xylo-glow-color-2', alpha(t.accent2, (dark ? 0.4 : 0.28) * glow)],
    ['--xylo-field-1', alpha(t.accent, Math.min(1, 0.8 * intensity))],
    ['--xylo-field-2', alpha(t.accent2, Math.min(1, 0.6 * intensity))],
    ['--xylo-field-3', alpha(mix(t.accent, t.accent2, 0.5), Math.min(1, 0.45 * intensity))],
    ['--xylo-pattern-color', alpha(s.text, (dark ? 0.16 : 0.18) * (t.patternOpacity / 100))],
    ['--xylo-noise-opacity', String(Math.round((dark ? 0.22 : 0.14) * (t.patternOpacity / 100) * 1000) / 1000)],
    ['--xylo-ink', dark ? '#ffffff' : s.text],
  ];
}

export function buildCss(t: XyloTheme): string {
  const blue = shades(t.accent);
  const dark = darkScale(t);
  const light = lightBase(t);
  const ink = accentInk(t);
  const density = DENSITY_SCALE[t.density];

  const shared: Vars = [
    ...scale('blue', blue),
    ['--xylo-accent', t.accent],
    ['--xylo-accent-2', t.accent2],
    ['--xylo-gradient', `linear-gradient(135deg,${t.accent} 0%,${t.accent2} 100%)`],
    ['--xylo-accent-ink', ink],
    ['--xylo-radius', `${t.radius}px`],
    ['--xylo-control-radius', `${t.controlRadius}px`],
    ['--xylo-blur', `${t.blur}px`],
    ['--mantine-radius-xs', `${Math.round(t.controlRadius * 0.6)}px`],
    ['--mantine-radius-sm', `${t.controlRadius}px`],
    ['--mantine-radius-default', `${t.controlRadius}px`],
    ['--mantine-radius-md', `${t.radius}px`],
    ['--mantine-radius-lg', `${t.radius + 4}px`],
    ['--mantine-radius-xl', `${t.radius + 8}px`],
    ...([1, 2, 3, 4, 5, 6].map((h) => [`--mantine-h${h}-font-weight`, String(t.headingWeight)]) as Vars),
  ];
  if (density !== 1) {
    for (const [size, rem] of SPACING)
      shared.push([`--mantine-spacing-${size}`, `${Math.round(rem * density * 1000) / 1000}rem`]);
  }
  const body = FONT_STACKS[t.font];
  if (body) shared.push(['--mantine-font-family', body], ['--font-sans', body]);
  const heading = FONT_STACKS[t.headingFont];
  if (heading) shared.push(['--mantine-font-family-headings', heading]);
  const mono = MONO_STACKS[t.monoFont];
  if (mono) shared.push(['--mantine-font-family-monospace', mono], ['--font-mono', mono]);

  const darkScheme: Vars = [
    ...scale('dark', dark),
    ...surfaceVars(t, t, true),
    ['--mantine-color-body', t.background],
    ['--mantine-color-text', t.text],
    ['--mantine-color-bright', mix(t.text, '#ffffff', 0.5)],
    ['--mantine-color-dimmed', dark[2]],
    ['--mantine-color-placeholder', dark[3]],
    ['--mantine-color-default', mix(t.text, t.surface, 0.04)],
    ['--mantine-color-default-hover', mix(t.text, t.surface, 0.08)],
    ['--mantine-color-default-border', mix(t.text, t.background, 0.07 + (t.borderStrength / 100) * 0.12)],
    ['--mantine-color-anchor', blue[4]],
    ['--mantine-color-blue-filled', blue[6]],
    ['--mantine-color-blue-filled-hover', blue[5]],
    ['--mantine-color-blue-light', alpha(t.accent, 0.16)],
    ['--mantine-color-blue-light-hover', alpha(t.accent, 0.24)],
    ['--mantine-color-blue-light-color', readable(blue[3], t.text, t.surface)],
    ['--mantine-color-blue-outline', blue[4]],
    ['--mantine-color-blue-outline-hover', alpha(blue[4], 0.08)],
    ['--mantine-color-blue-text', blue[4]],
    ['--mantine-primary-color-contrast', ink],
    ['--chart-series-1', blue[4]],
    ['--chart-series-2', t.accent2],
  ];

  const gray = [0.03, 0.06, 0.09, 0.13, 0.19, 0.33, 0.5, 0.7, 0.8, 0.88].map((w) => mix(light.text, light.surface, w));
  const lightInk = readable(t.accent, light.text, light.surface);
  const lightScheme: Vars = [
    ...scale('gray', gray),
    ...surfaceVars(t, light, false),
    ['--mantine-color-white', light.surface],
    ['--mantine-color-black', light.text],
    ['--mantine-color-bright', light.text],
    ['--mantine-color-body', light.background],
    ['--mantine-color-text', light.text],
    ['--mantine-color-dimmed', mix(light.text, light.surface, 0.62)],
    ['--mantine-color-placeholder', gray[5]],
    ['--mantine-color-default', light.surface],
    ['--mantine-color-default-hover', gray[0]],
    ['--mantine-color-default-color', light.text],
    ['--mantine-color-default-border', gray[3]],
    ['--mantine-color-anchor', lightInk],
    ['--mantine-color-blue-filled', blue[6]],
    ['--mantine-color-blue-filled-hover', blue[7]],
    ['--mantine-color-blue-light', alpha(t.accent, 0.1)],
    ['--mantine-color-blue-light-hover', alpha(t.accent, 0.15)],
    ['--mantine-color-blue-light-color', lightInk],
    ['--mantine-color-blue-outline', blue[6]],
    ['--mantine-color-blue-outline-hover', alpha(t.accent, 0.05)],
    ['--mantine-color-blue-text', lightInk],
    ['--mantine-primary-color-contrast', ink],
    ['--chart-series-1', blue[6]],
    ['--chart-series-2', readable(t.accent2, light.text, light.surface, 3)],
    ['--chart-tick-color', 'var(--mantine-color-dimmed)'],
  ];

  // the console's card behind the transparent xterm (app.css, `data-xylo-terminal='custom'`); the flush frame drops
  // the card, which leaves 'theme' on the canvas (its palette is made for the page) and a named scheme on its own
  // background, the one its colours read on. The crt frame's scanlines, vignette and glow are strong on a dark screen
  // and faint on a light one, where a glow would only blur dark text ('panel' follows the mode, as core's does).
  for (const [block, dark] of [
    [darkScheme, true],
    [lightScheme, false],
  ] as const) {
    const palette = terminalPalette(t, dark);
    const lit = palette ? luminance(palette.background) > 0.3 : !dark;
    block.push(
      ['--xylo-term-scan', lit ? 'rgba(0, 0, 0, 0.05)' : 'rgba(0, 0, 0, 0.2)'],
      ['--xylo-term-vignette', lit ? 'rgba(0, 0, 0, 0.1)' : 'rgba(0, 0, 0, 0.4)'],
      ['--xylo-term-glow', lit ? 'none' : '0 0 1px currentColor, 0 0 6px currentColor'],
    );
    if (!palette) continue;
    block.push(
      ['--xylo-term-bg', palette.background],
      ['--xylo-term-fg', palette.foreground],
      ['--xylo-term-flush', t.terminalScheme === 'theme' ? 'transparent' : palette.background],
    );
  }

  // status colours repaint their Mantine palette and the server state dots; the scales go in plain html:root, the
  // variants in the scheme blocks because core and Mantine pin those on `:root[data-mantine-color-scheme]`
  const status: [string, string][] = [
    [t.success, 'green'],
    [t.warning, 'yellow'],
    [t.danger, 'red'],
  ];
  for (const [value, name] of status) {
    if (!value) continue;
    const s = shades(value);
    const lightText = readable(value, light.text, light.surface);
    shared.push(...scale(name, s));
    darkScheme.push(
      [`--mantine-color-${name}-filled`, s[6]],
      [`--mantine-color-${name}-filled-hover`, s[5]],
      [`--mantine-color-${name}-light`, alpha(value, 0.16)],
      [`--mantine-color-${name}-light-hover`, alpha(value, 0.24)],
      [`--mantine-color-${name}-light-color`, s[3]],
      [`--mantine-color-${name}-outline`, s[4]],
      [`--mantine-color-${name}-text`, s[4]],
    );
    lightScheme.push(
      [`--mantine-color-${name}-filled`, s[6]],
      [`--mantine-color-${name}-filled-hover`, s[7]],
      [`--mantine-color-${name}-light`, alpha(value, 0.1)],
      [`--mantine-color-${name}-light-hover`, alpha(value, 0.15)],
      [`--mantine-color-${name}-light-color`, lightText],
      [`--mantine-color-${name}-outline`, s[6]],
      [`--mantine-color-${name}-text`, lightText],
    );
  }
  if (t.success) shared.push(['--color-server-status-running', t.success]);
  if (t.warning)
    shared.push(['--color-server-status-starting', t.warning], ['--color-server-status-stopping', t.warning]);
  if (t.danger) shared.push(['--color-server-status-offline', t.danger]);

  // html:root outranks Mantine's :root; the scheme blocks outrank core's and Mantine's `:root[data-mantine-color-scheme]`
  const css = [
    `html:root{${vars(shared)}}`,
    `html:root[data-mantine-color-scheme="dark"]{${vars(darkScheme)}}`,
    `html:root[data-mantine-color-scheme="light"]{${vars(lightScheme)}}`,
  ];
  if (t.uiScale !== 100) css.push(`html:root{font-size:${t.uiScale}%;}`);
  if (t.backgroundImage) {
    // a veil of the page colour over the image, `backgroundDim` percent strong, keeps text readable on it
    const veil = `color-mix(in srgb,var(--mantine-color-body) ${t.backgroundDim}%,transparent)`;
    css.push(`html:root[data-xylo]{background-image:linear-gradient(${veil},${veil}),url("${t.backgroundImage}");}`);
  }

  // Mantine gives accent filled buttons, action icons and badges white text through an inline variable beside the
  // inline fill, so where that fill is the accent the text follows the accent's ink (a white accent gets dark text)
  const fill = (name: string) => `[style*="${name}: var(--mantine-color-blue-filled)"]`;
  css.push(
    `html:root .mantine-Button-root${fill('--button-bg')}{--button-color:var(--xylo-accent-ink)!important;}`,
    `html:root .mantine-ActionIcon-root${fill('--ai-bg')}{--ai-color:var(--xylo-accent-ink)!important;}`,
    `html:root .mantine-Badge-root:is(${fill('--badge-bg')},:not([style*="--badge-bg"])){--badge-color:var(--xylo-accent-ink)!important;}`,
  );

  return css.join('\n');
}
