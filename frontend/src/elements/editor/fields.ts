import { sameTheme, type XyloTheme } from '../../lib/theme.ts';
import type { ExtTranslationKey } from '../../translations.ts';

/** Studio's tabs, in the order the section nav lists them. */
export const SECTION_IDS = [
  'presets',
  'colors',
  'backdrop',
  'surfaces',
  'layout',
  'typography',
  'console',
  'motion',
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

type Field = keyof XyloTheme;

/**
 * Each section's theme fields, with the label the settings search shows for them (the control's own label, or its
 * group's title when the control has none). The changed dots, "Reset section" and the search all read this; every
 * control carries its field as `data-xylo-setting`, which the search scrolls to. Every XyloTheme field belongs to
 * exactly one section (tests/fields.test.ts).
 */
export const SECTION_FIELDS = {
  presets: {
    customPresets: 'presets.custom',
  },
  colors: {
    accent: 'colors.accent',
    accent2: 'colors.accent2',
    background: 'colors.background',
    surface: 'colors.surface',
    text: 'colors.text',
    success: 'colors.success',
    warning: 'colors.warning',
    danger: 'colors.danger',
    lightBackground: 'colors.lightBackground',
    lightSurface: 'colors.lightSurface',
    lightText: 'colors.lightText',
  },
  backdrop: {
    backdrop: 'backdrop.style',
    backdropIntensity: 'backdrop.intensity',
    backdropAnimate: 'backdrop.animate',
    pattern: 'backdrop.pattern',
    patternOpacity: 'backdrop.patternOpacity',
    backgroundImage: 'backdrop.image',
    backgroundDim: 'backdrop.dim',
  },
  surfaces: {
    surfaceStyle: 'surfaces.material',
    surfaceOpacity: 'surfaces.opacity',
    blur: 'surfaces.blur',
    borderStrength: 'surfaces.border',
    shadow: 'surfaces.shadow',
    radius: 'surfaces.radius',
    controlRadius: 'surfaces.controlRadius',
  },
  layout: {
    sidebar: 'layout.sidebar',
    homePage: 'layout.homePage',
    serverOverview: 'layout.serverOverview',
    navStyle: 'layout.nav',
    buttonStyle: 'layout.buttons',
    glow: 'layout.glowStrength',
    density: 'layout.density',
    uiScale: 'layout.scale',
  },
  typography: {
    font: 'typography.body',
    headingFont: 'typography.headings',
    headingWeight: 'typography.weight',
    gradientTitles: 'typography.gradientTitles',
    monoFont: 'typography.mono',
  },
  console: {
    consolePage: 'consoleSection.consolePage',
    terminalScheme: 'consoleSection.scheme',
    terminalLineHeight: 'consoleSection.lineHeight',
    consoleHighlight: 'consoleSection.highlight',
  },
  motion: {
    motion: 'motion.level',
    pageTransition: 'motion.transition',
    hoverLift: 'motion.lift',
    greeting: 'motion.greeting',
  },
} as const satisfies Record<SectionId, Partial<Record<Field, ExtTranslationKey>>>;

/** The labels SECTION_FIELDS uses: keys without parameters, so `t(label, {})` takes any of them. */
type SettingLabel = { [K in SectionId]: (typeof SECTION_FIELDS)[K][keyof (typeof SECTION_FIELDS)[K]] }[SectionId];

/** Section `id`'s fields, each with its search label. */
export const sectionSettings = (id: SectionId) => Object.entries(SECTION_FIELDS[id]) as [Field, SettingLabel][];

export const sectionFields = (id: SectionId) => sectionSettings(id).map(([field]) => field);

/** `theme` with section `id`'s fields taken from `from`. */
export const withSection = (theme: XyloTheme, id: SectionId, from: XyloTheme): XyloTheme => ({
  ...theme,
  ...Object.fromEntries(sectionFields(id).map((key) => [key, from[key]])),
});

/** Whether any of section `id`'s fields differ between `theme` and `base`. */
export const sectionChanged = (id: SectionId, theme: XyloTheme, base: XyloTheme) =>
  !sameTheme(withSection(base, id, theme), base);
