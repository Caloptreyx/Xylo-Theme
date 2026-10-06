import {
  faArrowRightArrowLeft,
  faCircleCheck,
  faShuffle,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Slider } from '@mantine/core';
import { type CSSProperties, useState } from 'react';
import { hsl } from '../../lib/color.ts';
import { ActionIcon, Button, SegmentedControl, TextInput, Tooltip } from '../../lib/core.ts';
import {
  applyPreset,
  BACKDROPS,
  BUTTON_STYLES,
  type ContrastIssue,
  contrastIssues,
  DENSITIES,
  type Density,
  FONTS,
  generatePalette,
  lightBase,
  MONO_FONTS,
  MOTIONS,
  type MonoFont,
  type Motion,
  NAV_STYLES,
  PATTERNS,
  PRESETS,
  type PresetLook,
  SAFE_URL,
  SHADOWS,
  type Shadow,
  SIDEBARS,
  SURFACES,
  TRANSITIONS,
  type XyloTheme,
} from '../../lib/theme.ts';
import { useExtTranslations } from '../../translations.ts';
import { ChoiceTiles, ColorField, Group, SliderField, ToggleField } from './controls.tsx';
import {
  BackdropMock,
  ButtonMock,
  FontMock,
  NavMock,
  PatternMock,
  PresetMock,
  SidebarMock,
  SurfaceMock,
  TransitionMock,
} from './mocks.tsx';

export interface SectionProps {
  /** The raw draft: colour fields may hold half typed text. */
  draft: XyloTheme;
  /** The last valid normalized draft, which the drawings and checks use. */
  valid: XyloTheme;
  set: (patch: Partial<XyloTheme>) => void;
}

const LOOK_KEYS = Object.keys(PRESETS[0].look) as (keyof PresetLook)[];

export function PresetsSection({ valid, set }: SectionProps) {
  const { t } = useExtTranslations();
  const [hue, setHue] = useState(265);
  const palette = generatePalette(hue);

  return (
    <div className='flex flex-col gap-7'>
      {(['glass', 'minimal'] as const).map((style) => (
        <Group key={style} title={t(`presets.${style}`, {})}>
          <div className='grid grid-cols-2 gap-2.5'>
            {PRESETS.filter((preset) => preset.style === style).map((preset) => {
              const selected = LOOK_KEYS.every((key) => valid[key] === preset.look[key]);
              return (
                <button
                  key={preset.id}
                  type='button'
                  aria-pressed={selected}
                  onClick={() => set(applyPreset(valid, preset.look))}
                  className={`xylo-tile group flex cursor-pointer flex-col gap-1.5 rounded-2xl border p-1.5 text-left transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 ${
                    selected
                      ? 'border-(--xylo-accent) shadow-[0_0_0_3px_color-mix(in_srgb,var(--xylo-accent)_22%,transparent)]'
                      : 'border-(--mantine-color-default-border) hover:border-(--mantine-color-placeholder)'
                  }`}
                >
                  <div className='h-20 overflow-hidden rounded-xl'>
                    <PresetMock look={preset.look} />
                  </div>
                  <span className='flex items-center gap-1.5 px-1 pb-0.5 text-sm font-medium'>
                    <span
                      className='size-2.5 rounded-full'
                      style={{ background: `linear-gradient(135deg,${preset.look.accent},${preset.look.accent2})` }}
                    />
                    {t(`presets.${preset.id}`, {})}
                  </span>
                </button>
              );
            })}
          </div>
        </Group>
      ))}

      <Group title={t('presets.generate', {})} hint={t('presets.generateHint', {})}>
        <div className='flex flex-col gap-3 rounded-2xl border border-(--mantine-color-default-border) bg-(--mantine-color-default) p-3'>
          <div className='flex h-10 overflow-hidden rounded-lg'>
            {(['accent', 'accent2', 'background', 'surface', 'text'] as const).map((key) => (
              <div key={key} className='flex-1' style={{ background: palette[key] }} />
            ))}
          </div>
          <Slider
            min={0}
            max={359}
            value={hue}
            onChange={setHue}
            label={null}
            aria-label={t('presets.hue', {})}
            color='gray'
            styles={{
              // Mantine paints the track from `::before` with `--slider-track-bg`; the hue rainbow goes under it
              track: {
                '--slider-track-bg': 'transparent',
                borderRadius: 999,
                background: `linear-gradient(90deg,${[0, 60, 120, 180, 240, 300, 360].map((h) => hsl(h, 86, 60)).join(',')})`,
              } as CSSProperties,
              bar: { background: 'transparent' },
            }}
          />
          <div className='flex gap-2'>
            <Button
              variant='default'
              size='xs'
              leftSection={<FontAwesomeIcon icon={faShuffle} />}
              onClick={() => setHue(Math.floor(Math.random() * 360))}
            >
              {t('presets.shuffle', {})}
            </Button>
            <Button size='xs' className='flex-1' onClick={() => set(palette)}>
              {t('presets.applyPalette', {})}
            </Button>
          </div>
        </div>
      </Group>
    </div>
  );
}

const PAIR_LABEL = {
  text: 'colors.pairText',
  dimmed: 'colors.pairDimmed',
  accentInk: 'colors.pairAccentInk',
  lightText: 'colors.pairLightText',
} as const satisfies Record<ContrastIssue['pair'], string>;

export function ColorsSection({ draft, valid, set }: SectionProps) {
  const { t } = useExtTranslations();
  const issues = contrastIssues(valid);
  const light = lightBase({ ...valid, lightBackground: '', lightSurface: '', lightText: '' });

  return (
    <div className='flex flex-col gap-7'>
      <div
        className={`flex items-start gap-2.5 rounded-xl border p-3 text-sm ${
          issues.length
            ? 'border-transparent bg-(--mantine-color-yellow-light)'
            : 'border-(--mantine-color-default-border) bg-(--mantine-color-default)'
        }`}
      >
        <FontAwesomeIcon
          icon={issues.length ? faTriangleExclamation : faCircleCheck}
          className={`mt-0.5 ${issues.length ? 'text-(--mantine-color-yellow-light-color)' : 'text-(--mantine-color-green-text)'}`}
        />
        <div className='flex flex-col gap-1'>
          <span className='font-medium'>{t('colors.contrast', {})}</span>
          {issues.length === 0 ? (
            <span className='text-xs text-(--mantine-color-dimmed)'>{t('colors.contrastOk', {})}</span>
          ) : (
            issues.map((issue) => (
              <span key={issue.pair} className='text-xs'>
                {t(PAIR_LABEL[issue.pair], {})}:{' '}
                <span className='text-(--mantine-color-dimmed)'>
                  {t('colors.contrastRatio', { ratio: issue.ratio, min: issue.min })}
                </span>
              </span>
            ))
          )}
        </div>
      </div>

      <Group
        title={t('colors.brand', {})}
        action={
          <Tooltip label={t('colors.swap', {})}>
            <ActionIcon
              variant='subtle'
              color='gray'
              aria-label={t('colors.swap', {})}
              onClick={() => set({ accent: draft.accent2, accent2: draft.accent })}
            >
              <FontAwesomeIcon icon={faArrowRightArrowLeft} />
            </ActionIcon>
          </Tooltip>
        }
      >
        <div
          className='h-2 rounded-full'
          style={{ background: `linear-gradient(90deg,${valid.accent},${valid.accent2})` }}
        />
        <ColorField label={t('colors.accent', {})} value={draft.accent} onChange={(accent) => set({ accent })} />
        <ColorField
          label={t('colors.accent2', {})}
          description={t('colors.accent2Hint', {})}
          value={draft.accent2}
          onChange={(accent2) => set({ accent2 })}
        />
      </Group>

      <Group title={t('colors.base', {})}>
        <ColorField
          label={t('colors.background', {})}
          value={draft.background}
          onChange={(background) => set({ background })}
        />
        <ColorField label={t('colors.surface', {})} value={draft.surface} onChange={(surface) => set({ surface })} />
        <ColorField label={t('colors.text', {})} value={draft.text} onChange={(text) => set({ text })} />
      </Group>

      <Group title={t('colors.status', {})} hint={t('colors.statusHint', {})}>
        <ColorField
          optional
          fallback='#40c057'
          label={t('colors.success', {})}
          value={draft.success}
          onChange={(success) => set({ success })}
        />
        <ColorField
          optional
          fallback='#fab005'
          label={t('colors.warning', {})}
          value={draft.warning}
          onChange={(warning) => set({ warning })}
        />
        <ColorField
          optional
          fallback='#fa5252'
          label={t('colors.danger', {})}
          value={draft.danger}
          onChange={(danger) => set({ danger })}
        />
      </Group>

      <Group title={t('colors.light', {})} hint={t('colors.lightHint', {})}>
        <ColorField
          optional
          fallback={light.background}
          label={t('colors.lightBackground', {})}
          value={draft.lightBackground}
          onChange={(lightBackground) => set({ lightBackground })}
        />
        <ColorField
          optional
          fallback={light.surface}
          label={t('colors.lightSurface', {})}
          value={draft.lightSurface}
          onChange={(lightSurface) => set({ lightSurface })}
        />
        <ColorField
          optional
          fallback={light.text}
          label={t('colors.lightText', {})}
          value={draft.lightText}
          onChange={(lightText) => set({ lightText })}
        />
      </Group>
    </div>
  );
}

export function BackdropSection({ draft, valid, set }: SectionProps) {
  const { t } = useExtTranslations();
  const imageInvalid = draft.backgroundImage !== '' && !SAFE_URL.test(draft.backgroundImage);
  return (
    <div className='flex flex-col gap-7'>
      <Group title={t('backdrop.style', {})}>
        <ChoiceTiles
          value={valid.backdrop}
          onChange={(backdrop) => set({ backdrop })}
          options={BACKDROPS.map((backdrop) => ({
            value: backdrop,
            label: t(`backdrop.${backdrop}`, {}),
            preview: <BackdropMock look={valid} backdrop={backdrop} />,
          }))}
        />
        <SliderField
          label={t('backdrop.intensity', {})}
          value={valid.backdropIntensity}
          min={0}
          max={100}
          unit='%'
          onChange={(backdropIntensity) => set({ backdropIntensity })}
        />
        <ToggleField
          label={t('backdrop.animate', {})}
          description={t('backdrop.animateHint', {})}
          checked={valid.backdropAnimate}
          onChange={(backdropAnimate) => set({ backdropAnimate })}
        />
      </Group>

      <Group title={t('backdrop.pattern', {})}>
        <ChoiceTiles
          columns={4}
          value={valid.pattern}
          onChange={(pattern) => set({ pattern })}
          options={PATTERNS.map((pattern) => ({
            value: pattern,
            label: t(`backdrop.${pattern}`, {}),
            preview: <PatternMock look={valid} pattern={pattern} />,
          }))}
        />
        <SliderField
          label={t('backdrop.patternOpacity', {})}
          value={valid.patternOpacity}
          min={0}
          max={100}
          unit='%'
          onChange={(patternOpacity) => set({ patternOpacity })}
        />
      </Group>

      <Group title={t('backdrop.image', {})} hint={t('backdrop.imageHint', {})}>
        <TextInput
          placeholder='https://'
          value={draft.backgroundImage}
          error={imageInvalid ? t('backdrop.imageInvalid', {}) : undefined}
          onChange={(e) => set({ backgroundImage: e.currentTarget.value.trim() })}
        />
        {valid.backgroundImage && (
          <SliderField
            label={t('backdrop.dim', {})}
            value={valid.backgroundDim}
            min={0}
            max={95}
            unit='%'
            onChange={(backgroundDim) => set({ backgroundDim })}
          />
        )}
      </Group>
    </div>
  );
}

const SHADOW_LABEL = {
  none: 'surfaces.shadowNone',
  soft: 'surfaces.shadowSoft',
  deep: 'surfaces.shadowDeep',
} as const satisfies Record<Shadow, string>;

export function SurfacesSection({ valid, set }: SectionProps) {
  const { t } = useExtTranslations();
  return (
    <div className='flex flex-col gap-7'>
      <Group title={t('surfaces.material', {})}>
        <ChoiceTiles
          columns={3}
          value={valid.surfaceStyle}
          onChange={(surfaceStyle) => set({ surfaceStyle })}
          options={SURFACES.map((surface) => ({
            value: surface,
            label: t(`surfaces.${surface}`, {}),
            preview: <SurfaceMock look={valid} surface={surface} />,
          }))}
        />
        {valid.surfaceStyle === 'glass' && (
          <>
            <SliderField
              label={t('surfaces.opacity', {})}
              value={valid.surfaceOpacity}
              min={30}
              max={100}
              unit='%'
              onChange={(surfaceOpacity) => set({ surfaceOpacity })}
            />
            <SliderField
              label={t('surfaces.blur', {})}
              value={valid.blur}
              min={0}
              max={40}
              unit='px'
              onChange={(blur) => set({ blur })}
            />
          </>
        )}
        <SliderField
          label={t('surfaces.border', {})}
          value={valid.borderStrength}
          min={0}
          max={100}
          unit='%'
          onChange={(borderStrength) => set({ borderStrength })}
        />
      </Group>

      <Group title={t('surfaces.shadow', {})}>
        <SegmentedControl
          fullWidth
          value={valid.shadow}
          onChange={(shadow) => set({ shadow: shadow as Shadow })}
          data={SHADOWS.map((shadow) => ({ value: shadow, label: t(SHADOW_LABEL[shadow], {}) }))}
        />
      </Group>

      <Group title={t('surfaces.corners', {})}>
        <SliderField
          label={t('surfaces.radius', {})}
          value={valid.radius}
          min={0}
          max={32}
          unit='px'
          onChange={(radius) => set({ radius })}
        />
        <SliderField
          label={t('surfaces.controlRadius', {})}
          value={valid.controlRadius}
          min={0}
          max={24}
          unit='px'
          onChange={(controlRadius) => set({ controlRadius })}
        />
      </Group>
    </div>
  );
}

const BUTTON_LABEL = {
  gradient: 'layout.gradient',
  solid: 'layout.buttonSolid',
  soft: 'layout.soft',
  outline: 'layout.outline',
} as const satisfies Record<XyloTheme['buttonStyle'], string>;

export function LayoutSection({ valid, set }: SectionProps) {
  const { t } = useExtTranslations();
  return (
    <div className='flex flex-col gap-7'>
      <Group title={t('layout.sidebar', {})}>
        <ChoiceTiles
          columns={3}
          value={valid.sidebar}
          onChange={(sidebar) => set({ sidebar })}
          options={SIDEBARS.map((sidebar) => ({
            value: sidebar,
            label: t(`layout.${sidebar}`, {}),
            preview: <SidebarMock look={valid} sidebar={sidebar} />,
          }))}
        />
      </Group>

      <Group title={t('layout.home', {})}>
        <ToggleField
          label={t('layout.homePage', {})}
          description={t('layout.homePageHint', {})}
          checked={valid.homePage}
          onChange={(homePage) => set({ homePage })}
        />
      </Group>

      <Group title={t('layout.nav', {})}>
        <ChoiceTiles
          value={valid.navStyle}
          onChange={(navStyle) => set({ navStyle })}
          options={NAV_STYLES.map((nav) => ({
            value: nav,
            label: t(`layout.${nav}`, {}),
            preview: <NavMock look={valid} nav={nav} />,
          }))}
        />
      </Group>

      <Group title={t('layout.buttons', {})}>
        <ChoiceTiles
          value={valid.buttonStyle}
          onChange={(buttonStyle) => set({ buttonStyle })}
          options={BUTTON_STYLES.map((style) => ({
            value: style,
            label: t(BUTTON_LABEL[style], {}),
            preview: <ButtonMock look={valid} style={style} />,
          }))}
        />
        <SliderField
          label={t('layout.glowStrength', {})}
          value={valid.glow}
          min={0}
          max={100}
          unit='%'
          onChange={(glow) => set({ glow })}
        />
      </Group>

      <Group title={t('layout.density', {})}>
        <SegmentedControl
          fullWidth
          value={valid.density}
          onChange={(density) => set({ density: density as Density })}
          data={DENSITIES.map((density) => ({ value: density, label: t(`layout.${density}`, {}) }))}
        />
        <SliderField
          label={t('layout.scale', {})}
          value={valid.uiScale}
          min={85}
          max={115}
          unit='%'
          onChange={(uiScale) => set({ uiScale })}
        />
      </Group>
    </div>
  );
}

export function TypographySection({ valid, set }: SectionProps) {
  const { t } = useExtTranslations();
  const fontTiles = FONTS.map((font) => ({
    value: font,
    label: t(`typography.${font}`, {}),
    preview: <FontMock look={valid} font={font} />,
  }));
  return (
    <div className='flex flex-col gap-7'>
      <Group title={t('typography.body', {})}>
        <ChoiceTiles columns={3} value={valid.font} onChange={(font) => set({ font })} options={fontTiles} />
      </Group>
      <Group title={t('typography.headings', {})}>
        <ChoiceTiles
          columns={3}
          value={valid.headingFont}
          onChange={(headingFont) => set({ headingFont })}
          options={fontTiles}
        />
        <SliderField
          label={t('typography.weight', {})}
          value={valid.headingWeight}
          min={400}
          max={800}
          step={50}
          onChange={(headingWeight) => set({ headingWeight })}
        />
        <ToggleField
          label={t('typography.gradientTitles', {})}
          description={t('typography.gradientTitlesHint', {})}
          checked={valid.gradientTitles}
          onChange={(gradientTitles) => set({ gradientTitles })}
        />
      </Group>
      <Group title={t('typography.mono', {})}>
        <SegmentedControl
          fullWidth
          value={valid.monoFont}
          onChange={(monoFont) => set({ monoFont: monoFont as MonoFont })}
          data={MONO_FONTS.map((font) => ({ value: font, label: t(`typography.${font}`, {}) }))}
        />
      </Group>
    </div>
  );
}

export function MotionSection({ valid, set }: SectionProps) {
  const { t } = useExtTranslations();
  return (
    <div className='flex flex-col gap-7'>
      <Group title={t('motion.level', {})} hint={t('motion.levelHint', {})}>
        <SegmentedControl
          fullWidth
          value={valid.motion}
          onChange={(motion) => set({ motion: motion as Motion })}
          data={MOTIONS.map((motion) => ({ value: motion, label: t(`motion.${motion}`, {}) }))}
        />
      </Group>
      {valid.motion !== 'none' && (
        <Group title={t('motion.transition', {})}>
          <ChoiceTiles
            columns={4}
            value={valid.pageTransition}
            onChange={(pageTransition) => set({ pageTransition })}
            options={TRANSITIONS.map((transition) => ({
              value: transition,
              label: t(transition === 'none' ? 'motion.transitionNone' : `motion.${transition}`, {}),
              preview: <TransitionMock look={valid} transition={transition} />,
            }))}
          />
          <ToggleField
            label={t('motion.lift', {})}
            description={t('motion.liftHint', {})}
            checked={valid.hoverLift}
            onChange={(hoverLift) => set({ hoverLift })}
          />
        </Group>
      )}
      <Group title={t('motion.extras', {})}>
        <ToggleField
          label={t('motion.greeting', {})}
          description={t('motion.greetingHint', {})}
          checked={valid.greeting}
          onChange={(greeting) => set({ greeting })}
        />
      </Group>
    </div>
  );
}
