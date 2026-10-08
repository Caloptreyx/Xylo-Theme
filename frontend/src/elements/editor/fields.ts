import { sameTheme, type ZoronTheme } from '../../lib/theme.ts';
import type { ExtTranslationKey } from '../../translations.ts';

/** Studio's tabs, in the order the section nav lists them. */
export const SECTION_IDS = [
  'presets',
  'colors',
  'backdrop',
  'surfaces',
  'layout',
  'typography',
  'server',
  'console',
  'motion',
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

type Field = keyof ZoronTheme;

/**
 * Each section's theme fields, with the label the settings search shows for them (the control's own label, or its
 * group's title when the control has none). The changed dots, "Reset section" and the search all read this; every
 * control carries its field as `data-zoron-setting`, which the search scrolls to. Every ZoronTheme field belongs to
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
    homeLayout: 'layout.homeLayout',
    homeGroups: 'layout.homeGroups',
    homeLayoutChoice: 'layout.homeLayoutChoice',
    navStyle: 'layout.nav',
    buttonStyle: 'layout.buttons',
    glow: 'layout.glowStrength',
    density: 'layout.density',
    uiScale: 'layout.scale',
    loginLinks: 'layout.login',
  },
  typography: {
    font: 'typography.body',
    headingFont: 'typography.headings',
    headingWeight: 'typography.weight',
    gradientTitles: 'typography.gradientTitles',
    monoFont: 'typography.mono',
  },
  server: {
    serverOverview: 'overviewSection.serverOverview',
    overviewGrid: 'overviewSection.arrange',
    overviewUsage: 'overviewSection.usageStyle',
    overviewActivityCount: 'overviewSection.activityCount',
    overviewHeader: 'overviewSection.header',
    overviewDescription: 'overviewSection.description',
  },
  console: {
    consolePage: 'consoleSection.consolePage',
    consoleDensity: 'consoleSection.density',
    consoleMetrics: 'consoleSection.metrics',
    consoleGraphs: 'consoleSection.graphs',
    consoleInspector: 'consoleSection.inspector',
    consoleBar: 'consoleSection.bar',
    consoleFooter: 'consoleSection.footer',
    consoleChips: 'consoleSection.chips',
    consoleInspectorOpen: 'consoleSection.inspectorOpen',
    consoleQuickCommands: 'consoleSection.quickCommandsToggle',
    consoleCommands: 'consoleSection.siteCommands',
    terminalScheme: 'consoleSection.scheme',
    terminalSkin: 'consoleSection.frame',
    terminalLineHeight: 'consoleSection.lineHeight',
    consoleHighlight: 'consoleSection.highlight',
    terminalUserChoice: 'consoleSection.userChoice',
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
export const withSection = (theme: ZoronTheme, id: SectionId, from: ZoronTheme): ZoronTheme => ({
  ...theme,
  ...Object.fromEntries(sectionFields(id).map((key) => [key, from[key]])),
});

/** Whether any of section `id`'s fields differ between `theme` and `base`. */
export const sectionChanged = (id: SectionId, theme: ZoronTheme, base: ZoronTheme) =>
  !sameTheme(withSection(base, id, theme), base);
