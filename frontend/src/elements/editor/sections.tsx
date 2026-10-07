import {
  faArrowRightArrowLeft,
  faCircleCheck,
  faEllipsis,
  faPen,
  faPlus,
  faShuffle,
  faTrash,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Slider } from '@mantine/core';
import { type CSSProperties, useState } from 'react';
import { hsl } from '../../lib/color.ts';
import { ActionIcon, Button, Menu, Modal, ModalFooter, SegmentedControl, TextInput, Tooltip } from '../../lib/core.ts';
import {
  applyPreset,
  BACKDROPS,
  BUTTON_STYLES,
  type ContrastIssue,
  type CustomPreset,
  contrastIssues,
  DENSITIES,
  type Density,
  FONTS,
  generatePalette,
  LOOK_KEYS,
  lightBase,
  MAX_CUSTOM_PRESETS,
  MAX_PRESET_NAME,
  MONO_FONTS,
  MOTIONS,
  type MonoFont,
  type Motion,
  NAV_STYLES,
  PATTERNS,
  PRESETS,
  type PresetLook,
  pickLook,
  presetName,
  SAFE_URL,
  SHADOWS,
  type Shadow,
  SIDEBARS,
  SURFACES,
  TERMINAL_SCHEME_GROUPS,
  TERMINAL_SKINS,
  TRANSITIONS,
  terminalPalette,
  type XyloTheme,
} from '../../lib/theme.ts';
import { useExtTranslations } from '../../translations.ts';
import { ChoiceTiles, ColorField, Group, Setting, SliderField, ToggleField } from './controls.tsx';
import {
  BackdropMock,
  ButtonMock,
  FontMock,
  NavMock,
  PatternMock,
  PresetMock,
  SidebarMock,
  SurfaceMock,
  TerminalMock,
  TerminalSkinMock,
  TransitionMock,
} from './mocks.tsx';

export interface SectionProps {
  /** The raw draft: colour fields may hold half typed text. */
  draft: XyloTheme;
  /** The last valid normalized draft, which the drawings and checks use. */
  valid: XyloTheme;
  set: (patch: Partial<XyloTheme>) => void;
}

/** A preset's drawing and name; picking it lays its look over the draft, and it reads as picked while it matches. */
function PresetTile({ name, look, valid, set }: { name: string; look: PresetLook } & Omit<SectionProps, 'draft'>) {
  const selected = LOOK_KEYS.every((key) => valid[key] === look[key]);
  return (
    <button
      type='button'
      aria-pressed={selected}
      onClick={() => set(applyPreset(valid, look))}
      className={`xylo-tile group flex w-full cursor-pointer flex-col gap-1.5 rounded-2xl border p-1.5 text-left transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 ${
        selected
          ? 'border-(--xylo-accent) shadow-[0_0_0_3px_color-mix(in_srgb,var(--xylo-accent)_22%,transparent)]'
          : 'border-(--mantine-color-default-border) hover:border-(--mantine-color-placeholder)'
      }`}
    >
      <div className='h-20 overflow-hidden rounded-xl'>
        <PresetMock look={look} />
      </div>
      <span className='flex min-w-0 items-center gap-1.5 px-1 pb-0.5 text-sm font-medium'>
        <span
          className='size-2.5 shrink-0 rounded-full'
          style={{ background: `linear-gradient(135deg,${look.accent},${look.accent2})` }}
        />
        <span className='truncate'>{name}</span>
      </span>
    </button>
  );
}

/** The cleaned name, and whether another preset already has it (`own` is the name being renamed, if any). */
function checkName(raw: string, presets: CustomPreset[], own?: string) {
  const name = presetName(raw);
  return { name, taken: name !== null && name !== own && presets.some((preset) => preset.name === name) };
}

function RenamePresetModal({
  preset,
  presets,
  onClose,
  onRename,
}: {
  preset: string;
  presets: CustomPreset[];
  onClose: () => void;
  onRename: (name: string) => void;
}) {
  const { t } = useExtTranslations();
  const [raw, setRaw] = useState(preset);
  const { name, taken } = checkName(raw, presets, preset);

  return (
    <Modal opened onClose={onClose} title={t('presets.renameTitle', { name: preset })}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!name || taken) return;
          onClose();
          if (name !== preset) onRename(name);
        }}
      >
        <TextInput
          label={t('presets.name', {})}
          value={raw}
          maxLength={MAX_PRESET_NAME}
          onChange={(event) => setRaw(event.currentTarget.value)}
          error={taken ? t('presets.nameTaken', {}) : undefined}
          data-autofocus
        />
        <ModalFooter>
          <Button variant='default' onClick={onClose}>
            {t('presets.cancel', {})}
          </Button>
          <Button type='submit' disabled={!name || taken}>
            {t('presets.save', {})}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

/** The admins' own presets: saved from the current look, kept in the theme, renamed and deleted from a menu. */
function CustomPresets({ draft, valid, set }: SectionProps) {
  const { t } = useExtTranslations();
  const [raw, setRaw] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const presets = draft.customPresets;
  const { name, taken } = checkName(raw, presets);
  const full = presets.length >= MAX_CUSTOM_PRESETS;

  return (
    <Group title={t('presets.custom', {})} hint={t('presets.customHint', {})}>
      <Setting field='customPresets'>
        <div className='flex flex-col gap-3'>
          {presets.length > 0 && (
            <div className='grid grid-cols-2 gap-2.5'>
              {presets.map((preset) => (
                <div key={preset.name} className='relative'>
                  <PresetTile name={preset.name} look={preset.look} valid={valid} set={set} />
                  <div className='absolute top-2.5 right-2.5'>
                    <Menu position='bottom-end' zIndex={400}>
                      <Menu.Target>
                        <ActionIcon size='sm' variant='default' aria-label={t('presets.options', {})}>
                          <FontAwesomeIcon icon={faEllipsis} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Label>{preset.name}</Menu.Label>
                        <Menu.Item
                          leftSection={<FontAwesomeIcon icon={faPen} />}
                          onClick={() => setRenaming(preset.name)}
                        >
                          {t('presets.rename', {})}
                        </Menu.Item>
                        <Menu.Item
                          color='red'
                          leftSection={<FontAwesomeIcon icon={faTrash} />}
                          onClick={() => set({ customPresets: presets.filter((p) => p.name !== preset.name) })}
                        >
                          {t('presets.delete', {})}
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </div>
                </div>
              ))}
            </div>
          )}
          <form
            className='flex items-start gap-2'
            onSubmit={(event) => {
              event.preventDefault();
              if (!name || taken || full) return;
              set({ customPresets: [...presets, { name, look: pickLook(valid) }] });
              setRaw('');
            }}
          >
            <TextInput
              size='xs'
              className='flex-1'
              placeholder={t('presets.name', {})}
              aria-label={t('presets.name', {})}
              value={raw}
              maxLength={MAX_PRESET_NAME}
              disabled={full}
              onChange={(event) => setRaw(event.currentTarget.value)}
              error={taken ? t('presets.nameTaken', {}) : undefined}
            />
            <Button
              type='submit'
              size='xs'
              variant='default'
              disabled={!name || taken || full}
              leftSection={<FontAwesomeIcon icon={faPlus} />}
            >
              {t('presets.saveLook', {})}
            </Button>
          </form>
          {full && (
            <p className='text-xs text-(--mantine-color-dimmed)'>{t('presets.full', { max: MAX_CUSTOM_PRESETS })}</p>
          )}
        </div>
      </Setting>
      {renaming !== null && (
        <RenamePresetModal
          preset={renaming}
          presets={presets}
          onClose={() => setRenaming(null)}
          onRename={(newName) =>
            set({ customPresets: presets.map((p) => (p.name === renaming ? { ...p, name: newName } : p)) })
          }
        />
      )}
    </Group>
  );
}

export function PresetsSection({ draft, valid, set }: SectionProps) {
  const { t } = useExtTranslations();
  const [hue, setHue] = useState(265);
  const palette = generatePalette(hue);

  return (
    <div className='flex flex-col gap-7'>
      {/* the default (Carbon) is minimal, so that group leads */}
      {(['minimal', 'glass'] as const).map((style) => (
        <Group key={style} title={t(`presets.${style}`, {})}>
          <div className='grid grid-cols-2 gap-2.5'>
            {PRESETS.filter((preset) => preset.style === style).map((preset) => (
              <PresetTile
                key={preset.id}
                name={t(`presets.${preset.id}`, {})}
                look={preset.look}
                valid={valid}
                set={set}
              />
            ))}
          </div>
        </Group>
      ))}

      <CustomPresets draft={draft} valid={valid} set={set} />

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
        <ColorField
          field='accent'
          label={t('colors.accent', {})}
          value={draft.accent}
          onChange={(accent) => set({ accent })}
        />
        <ColorField
          field='accent2'
          label={t('colors.accent2', {})}
          description={t('colors.accent2Hint', {})}
          value={draft.accent2}
          onChange={(accent2) => set({ accent2 })}
        />
      </Group>

      <Group title={t('colors.base', {})}>
        <ColorField
          field='background'
          label={t('colors.background', {})}
          value={draft.background}
          onChange={(background) => set({ background })}
        />
        <ColorField
          field='surface'
          label={t('colors.surface', {})}
          value={draft.surface}
          onChange={(surface) => set({ surface })}
        />
        <ColorField field='text' label={t('colors.text', {})} value={draft.text} onChange={(text) => set({ text })} />
      </Group>

      <Group title={t('colors.status', {})} hint={t('colors.statusHint', {})}>
        <ColorField
          field='success'
          optional
          fallback='#40c057'
          label={t('colors.success', {})}
          value={draft.success}
          onChange={(success) => set({ success })}
        />
        <ColorField
          field='warning'
          optional
          fallback='#fab005'
          label={t('colors.warning', {})}
          value={draft.warning}
          onChange={(warning) => set({ warning })}
        />
        <ColorField
          field='danger'
          optional
          fallback='#fa5252'
          label={t('colors.danger', {})}
          value={draft.danger}
          onChange={(danger) => set({ danger })}
        />
      </Group>

      <Group title={t('colors.light', {})} hint={t('colors.lightHint', {})}>
        <ColorField
          field='lightBackground'
          optional
          fallback={light.background}
          label={t('colors.lightBackground', {})}
          value={draft.lightBackground}
          onChange={(lightBackground) => set({ lightBackground })}
        />
        <ColorField
          field='lightSurface'
          optional
          fallback={light.surface}
          label={t('colors.lightSurface', {})}
          value={draft.lightSurface}
          onChange={(lightSurface) => set({ lightSurface })}
        />
        <ColorField
          field='lightText'
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
          field='backdrop'
          value={valid.backdrop}
          onChange={(backdrop) => set({ backdrop })}
          options={BACKDROPS.map((backdrop) => ({
            value: backdrop,
            label: t(`backdrop.${backdrop}`, {}),
            preview: <BackdropMock look={valid} backdrop={backdrop} />,
          }))}
        />
        <SliderField
          field='backdropIntensity'
          label={t('backdrop.intensity', {})}
          value={valid.backdropIntensity}
          min={0}
          max={100}
          unit='%'
          onChange={(backdropIntensity) => set({ backdropIntensity })}
        />
        <ToggleField
          field='backdropAnimate'
          label={t('backdrop.animate', {})}
          description={t('backdrop.animateHint', {})}
          checked={valid.backdropAnimate}
          onChange={(backdropAnimate) => set({ backdropAnimate })}
        />
      </Group>

      <Group title={t('backdrop.pattern', {})}>
        <ChoiceTiles
          field='pattern'
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
          field='patternOpacity'
          label={t('backdrop.patternOpacity', {})}
          value={valid.patternOpacity}
          min={0}
          max={100}
          unit='%'
          onChange={(patternOpacity) => set({ patternOpacity })}
        />
      </Group>

      <Group title={t('backdrop.image', {})} hint={t('backdrop.imageHint', {})}>
        <Setting field='backgroundImage'>
          <TextInput
            placeholder='https://'
            aria-label={t('backdrop.image', {})}
            value={draft.backgroundImage}
            error={imageInvalid ? t('backdrop.imageInvalid', {}) : undefined}
            onChange={(e) => set({ backgroundImage: e.currentTarget.value.trim() })}
          />
        </Setting>
        {valid.backgroundImage && (
          <SliderField
            field='backgroundDim'
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
          field='surfaceStyle'
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
              field='surfaceOpacity'
              label={t('surfaces.opacity', {})}
              value={valid.surfaceOpacity}
              min={30}
              max={100}
              unit='%'
              onChange={(surfaceOpacity) => set({ surfaceOpacity })}
            />
            <SliderField
              field='blur'
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
          field='borderStrength'
          label={t('surfaces.border', {})}
          value={valid.borderStrength}
          min={0}
          max={100}
          unit='%'
          onChange={(borderStrength) => set({ borderStrength })}
        />
      </Group>

      <Group title={t('surfaces.shadow', {})}>
        <Setting field='shadow'>
          <SegmentedControl
            fullWidth
            value={valid.shadow}
            onChange={(shadow) => set({ shadow: shadow as Shadow })}
            data={SHADOWS.map((shadow) => ({ value: shadow, label: t(SHADOW_LABEL[shadow], {}) }))}
          />
        </Setting>
      </Group>

      <Group title={t('surfaces.corners', {})}>
        <SliderField
          field='radius'
          label={t('surfaces.radius', {})}
          value={valid.radius}
          min={0}
          max={32}
          unit='px'
          onChange={(radius) => set({ radius })}
        />
        <SliderField
          field='controlRadius'
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
          field='sidebar'
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
          field='homePage'
          label={t('layout.homePage', {})}
          description={t('layout.homePageHint', {})}
          checked={valid.homePage}
          onChange={(homePage) => set({ homePage })}
        />
        <ToggleField
          field='serverOverview'
          label={t('layout.serverOverview', {})}
          description={t('layout.serverOverviewHint', {})}
          checked={valid.serverOverview}
          onChange={(serverOverview) => set({ serverOverview })}
        />
      </Group>

      <Group title={t('layout.nav', {})}>
        <ChoiceTiles
          field='navStyle'
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
          field='buttonStyle'
          value={valid.buttonStyle}
          onChange={(buttonStyle) => set({ buttonStyle })}
          options={BUTTON_STYLES.map((style) => ({
            value: style,
            label: t(BUTTON_LABEL[style], {}),
            preview: <ButtonMock look={valid} style={style} />,
          }))}
        />
        <SliderField
          field='glow'
          label={t('layout.glowStrength', {})}
          value={valid.glow}
          min={0}
          max={100}
          unit='%'
          onChange={(glow) => set({ glow })}
        />
      </Group>

      <Group title={t('layout.density', {})}>
        <Setting field='density'>
          <SegmentedControl
            fullWidth
            value={valid.density}
            onChange={(density) => set({ density: density as Density })}
            data={DENSITIES.map((density) => ({ value: density, label: t(`layout.${density}`, {}) }))}
          />
        </Setting>
        <SliderField
          field='uiScale'
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
        <ChoiceTiles
          field='font'
          columns={3}
          value={valid.font}
          onChange={(font) => set({ font })}
          options={fontTiles}
        />
      </Group>
      <Group title={t('typography.headings', {})}>
        <ChoiceTiles
          field='headingFont'
          columns={3}
          value={valid.headingFont}
          onChange={(headingFont) => set({ headingFont })}
          options={fontTiles}
        />
        <SliderField
          field='headingWeight'
          label={t('typography.weight', {})}
          value={valid.headingWeight}
          min={400}
          max={800}
          step={50}
          onChange={(headingWeight) => set({ headingWeight })}
        />
        <ToggleField
          field='gradientTitles'
          label={t('typography.gradientTitles', {})}
          description={t('typography.gradientTitlesHint', {})}
          checked={valid.gradientTitles}
          onChange={(gradientTitles) => set({ gradientTitles })}
        />
      </Group>
      <Group title={t('typography.mono', {})}>
        <Setting field='monoFont'>
          <SegmentedControl
            fullWidth
            value={valid.monoFont}
            onChange={(monoFont) => set({ monoFont: monoFont as MonoFont })}
            data={MONO_FONTS.map((font) => ({ value: font, label: t(`typography.${font}`, {}) }))}
          />
        </Setting>
      </Group>
    </div>
  );
}

export function ConsoleSection({ valid, set }: SectionProps) {
  const { t } = useExtTranslations();
  return (
    <div className='flex flex-col gap-7'>
      <Group title={t('consoleSection.page', {})}>
        <ToggleField
          field='consolePage'
          label={t('consoleSection.consolePage', {})}
          description={t('consoleSection.consolePageHint', {})}
          checked={valid.consolePage}
          onChange={(consolePage) => set({ consolePage })}
        />
      </Group>

      <Group title={t('consoleSection.scheme', {})} hint={t('consoleSection.schemeHint', {})}>
        {TERMINAL_SCHEME_GROUPS.map((group) => (
          <ChoiceTiles
            key={group.id}
            field='terminalScheme'
            label={t(`consoleSection.${group.id}`, {})}
            columns={3}
            value={valid.terminalScheme}
            onChange={(terminalScheme) => set({ terminalScheme })}
            options={group.schemes.map((scheme) => ({
              value: scheme,
              label: t(`consoleSection.${scheme}`, {}),
              // drawn in dark mode, like every other drawing
              preview: (
                <TerminalMock look={valid} palette={terminalPalette({ ...valid, terminalScheme: scheme }, true)} />
              ),
            }))}
          />
        ))}
      </Group>

      <Group title={t('consoleSection.frame', {})} hint={t('consoleSection.frameHint', {})}>
        <ChoiceTiles
          field='terminalSkin'
          columns={3}
          value={valid.terminalSkin}
          onChange={(terminalSkin) => set({ terminalSkin })}
          options={TERMINAL_SKINS.map((skin) => ({
            value: skin,
            label: t(`consoleSection.${skin}`, {}),
            preview: (
              <TerminalSkinMock
                look={valid}
                palette={terminalPalette(valid, true)}
                scheme={valid.terminalScheme}
                skin={skin}
              />
            ),
          }))}
        />
      </Group>

      <Group title={t('consoleSection.choice', {})}>
        <ToggleField
          field='terminalUserChoice'
          label={t('consoleSection.userChoice', {})}
          description={t('consoleSection.userChoiceHint', {})}
          checked={valid.terminalUserChoice}
          onChange={(terminalUserChoice) => set({ terminalUserChoice })}
        />
      </Group>

      <Group title={t('consoleSection.text', {})} hint={t('consoleSection.textHint', {})}>
        <SliderField
          field='terminalLineHeight'
          label={t('consoleSection.lineHeight', {})}
          value={valid.terminalLineHeight}
          min={100}
          max={180}
          step={5}
          format={(value) => String(value / 100)}
          onChange={(terminalLineHeight) => set({ terminalLineHeight })}
        />
        <ToggleField
          field='consoleHighlight'
          label={t('consoleSection.highlight', {})}
          description={t('consoleSection.highlightHint', {})}
          checked={valid.consoleHighlight}
          onChange={(consoleHighlight) => set({ consoleHighlight })}
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
        <Setting field='motion'>
          <SegmentedControl
            fullWidth
            value={valid.motion}
            onChange={(motion) => set({ motion: motion as Motion })}
            data={MOTIONS.map((motion) => ({ value: motion, label: t(`motion.${motion}`, {}) }))}
          />
        </Setting>
      </Group>
      {valid.motion !== 'none' && (
        <Group title={t('motion.transition', {})}>
          <ChoiceTiles
            field='pageTransition'
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
            field='hoverLift'
            label={t('motion.lift', {})}
            description={t('motion.liftHint', {})}
            checked={valid.hoverLift}
            onChange={(hoverLift) => set({ hoverLift })}
          />
        </Group>
      )}
      <Group title={t('motion.extras', {})}>
        <ToggleField
          field='greeting'
          label={t('motion.greeting', {})}
          description={t('motion.greetingHint', {})}
          checked={valid.greeting}
          onChange={(greeting) => set({ greeting })}
        />
      </Group>
    </div>
  );
}
