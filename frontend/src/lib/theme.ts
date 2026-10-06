import { alpha, contrastRatio, HEX, hsl, luminance, mix, readable, shades } from './color.ts';

/**
 * The saved theme is operator supplied JSON that ends up in a stylesheet served to every visitor (the login page
 * included). normalizeTheme() is the only way in: colours must be hex, numbers are clamped, choices allow listed,
 * URLs checked by SAFE_URL, unknown fields dropped. Nothing reaches buildCss() or the html attributes without it.
 */

export const FONTS = ['inter', 'jakarta', 'space', 'outfit', 'system', 'panel'] as const;
export type Font = (typeof FONTS)[number];
export const MONO_FONTS = ['jetbrains', 'system', 'panel'] as const;
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
/** Desktop sidebar: an inset glass panel, flush against the edge, or core's own card. */
export const SIDEBARS = ['floating', 'docked', 'classic'] as const;
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
}

/**
 * What a preset sets: the whole look. Status colours, light mode overrides, density, scale, the code font, motion
 * and the content fields (greeting, background image) stay the draft's, since they are about the site, not the style.
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
  sidebar: 'floating',
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
  ...AURORA,
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
  monoFont: 'jetbrains',
  motion: 'full',
  hoverLift: true,
  greeting: true,
};

export type PresetId = 'aurora' | 'nebula' | 'lagoon' | 'verdant' | 'ember' | 'graphite' | 'mono' | 'sandstone';

export interface Preset {
  id: PresetId;
  style: 'glass' | 'minimal';
  look: PresetLook;
}

export const PRESETS: Preset[] = [
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
      sidebar: 'floating',
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
      sidebar: 'floating',
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
      sidebar: 'floating',
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
      sidebar: 'floating',
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
      sidebar: 'docked',
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
      sidebar: 'docked',
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
      sidebar: 'floating',
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

export function normalizeTheme(raw: unknown, d: XyloTheme = DEFAULT_THEME): XyloTheme {
  const r = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
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
  };
}

/** A preset's look laid over `base`, which keeps the fields a preset leaves alone. */
export function applyPreset(base: XyloTheme, look: PresetLook): XyloTheme {
  return normalizeTheme({ ...base, ...look }, base);
}

/** Field by field equality; comparing JSON would depend on key order, which differs between sources. */
export function sameTheme(a: XyloTheme, b: XyloTheme): boolean {
  return (Object.keys(DEFAULT_THEME) as (keyof XyloTheme)[]).every((key) => a[key] === b[key]);
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
  inter: "'Inter Variable', 'Inter', ui-sans-serif, system-ui, sans-serif",
  jakarta: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif",
  space: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
  outfit: "'Outfit', ui-sans-serif, system-ui, sans-serif",
  system: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  panel: null,
};

export const MONO_STACKS: Record<MonoFont, string | null> = {
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
