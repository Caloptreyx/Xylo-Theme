import {
  faArrowRotateLeft,
  faArrowRotateRight,
  faCodeCompare,
  faDesktop,
  faDownload,
  faDroplet,
  faEllipsisVertical,
  faFont,
  faLayerGroup,
  faMagnifyingGlass,
  faMobileScreen,
  faMoon,
  faRotateRight,
  faServer,
  faSun,
  faSwatchbook,
  faTableColumns,
  faTabletScreenButton,
  faTerminal,
  faTrashArrowUp,
  faUpload,
  faWandMagicSparkles,
  faWater,
  faXmark,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Loader, Select, useComputedColorScheme } from '@mantine/core';
import { isAxiosError } from 'axios';
import { type FC, useEffect, useReducer, useRef, useState } from 'react';
import { useBeforeUnload, useNavigate } from 'react-router';
import saveTheme from '../api/saveTheme.ts';
import {
  SECTION_IDS,
  type SectionId,
  sectionChanged,
  sectionSettings,
  withSection,
} from '../elements/editor/fields.ts';
import {
  BackdropSection,
  ColorsSection,
  ConsoleSection,
  LayoutSection,
  MotionSection,
  PresetsSection,
  type SectionProps,
  ServerSection,
  SurfacesSection,
  TypographySection,
} from '../elements/editor/sections.tsx';
import {
  ActionIcon,
  Button,
  ConfirmationModal,
  getServers,
  httpErrorToHuman,
  Menu,
  SegmentedControl,
  Tooltip,
  useAdminCan,
  useBlocker,
  useKeyboardShortcuts,
  useToast,
} from '../lib/core.ts';
import { useCanSaveTheme } from '../lib/permissions.ts';
import { loadTheme, type PreviewScheme, READY_MSG, rememberTheme, savedTheme, sendPreview } from '../lib/store.ts';
import { DEFAULT_THEME, normalizeTheme, SAFE_URL, sameTheme, type ZoronTheme } from '../lib/theme.ts';
import { useExtTranslations } from '../translations.ts';

/** Auth routes redirect signed in users, so the editor previews core's real login page here (index.ts). */
export const LOGIN_PREVIEW_PATH = '/zoron-preview/login';

const SECTIONS: Record<SectionId, { icon: IconDefinition; Component: FC<SectionProps> }> = {
  presets: { icon: faSwatchbook, Component: PresetsSection },
  colors: { icon: faDroplet, Component: ColorsSection },
  backdrop: { icon: faWater, Component: BackdropSection },
  surfaces: { icon: faLayerGroup, Component: SurfacesSection },
  layout: { icon: faTableColumns, Component: LayoutSection },
  typography: { icon: faFont, Component: TypographySection },
  server: { icon: faServer, Component: ServerSection },
  console: { icon: faTerminal, Component: ConsoleSection },
  motion: { icon: faWandMagicSparkles, Component: MotionSection },
};

type Device = 'desktop' | 'tablet' | 'phone';
const DEVICE_WIDTH: Record<Device, number> = { desktop: 1280, tablet: 834, phone: 390 };
const STAGE_PADDING = 28;
const HISTORY = 60;

/** Debounced undo and redo over whole drafts: a burst of edits (a slider drag) is one step. */
function useHistory(draft: ZoronTheme, setDraft: (theme: ZoronTheme) => void) {
  const past = useRef<ZoronTheme[]>([]);
  const future = useRef<ZoronTheme[]>([]);
  const committed = useRef(draft);
  const latest = useRef(draft);
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  /** Records the live draft as a step of its own, so undo inside the debounce window doesn't lose it. */
  const flush = () => {
    if (latest.current === committed.current) return;
    // a save swaps in the normalized copy of the same draft; that is not a step anyone wants to undo
    if (sameTheme(latest.current, committed.current)) {
      committed.current = latest.current;
      return;
    }
    past.current = [...past.current.slice(-(HISTORY - 1)), committed.current];
    future.current = [];
    committed.current = latest.current;
  };

  useEffect(() => {
    latest.current = draft;
    const id = setTimeout(() => {
      flush();
      rerender();
    }, 400);
    return () => clearTimeout(id);
  }, [draft]);

  const step = (from: typeof past, to: typeof past) => {
    flush();
    const next = from.current.pop();
    if (!next) return rerender();
    to.current.push(committed.current);
    committed.current = next;
    latest.current = next;
    setDraft(next);
    rerender();
  };

  const pending = draft !== committed.current;
  return {
    canUndo: past.current.length > 0 || pending,
    canRedo: future.current.length > 0 && !pending,
    undo: () => step(past, future),
    redo: () => step(future, past),
    restart: (theme: ZoronTheme) => {
      past.current = [];
      future.current = [];
      committed.current = theme;
      latest.current = theme;
    },
  };
}

/** An imported file must be a JSON object with at least one theme field; normalizeTheme() handles the rest. */
const isThemeFile = (value: unknown) =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).some((key) => key in DEFAULT_THEME);

export default function ThemeEditor() {
  const { t } = useExtTranslations();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [draft, setDraft] = useState<ZoronTheme>(savedTheme);
  const [saved, setSaved] = useState<ZoronTheme>(savedTheme);
  // the cache can be stale or missing, so nothing is saved until the stored theme has loaded
  const [load, setLoad] = useState<'pending' | 'ok' | 'failed'>('pending');
  // the stored theme's version, sent as `base` so a save never replaces a theme saved elsewhere meanwhile
  const version = useRef('');
  const [conflict, setConflict] = useState<ZoronTheme | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [section, setSection] = useState<SectionId>('presets');
  const [device, setDevice] = useState<Device>('desktop');
  // the preview starts in the admin's own scheme; the toggle only ever touches the frame
  const adminScheme = useComputedColorScheme('dark', { getInitialValueInEffect: false });
  const [scheme, setScheme] = useState<PreviewScheme>(adminScheme);
  const [page, setPage] = useState('/');
  const [frameKey, setFrameKey] = useState(0);
  const [serverId, setServerId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  // the draft can hold half typed colours; the preview, drawings and checks use the last valid one
  const [valid, setValid] = useState(draft);
  // held down on the compare button: the frame shows the saved theme until it is let go
  const [holding, setHolding] = useState(false);
  const [query, setQuery] = useState('');
  // a setting picked in the search; a fresh object each time, so picking the same one again scrolls again
  const [jump, setJump] = useState<{ field: keyof ZoronTheme } | null>(null);

  const frame = useRef<HTMLIFrameElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const asideRef = useRef<HTMLDivElement>(null);
  const shown = useRef(draft);
  // what the frame shows: the valid draft, or the saved theme while comparing; re-sent when the frame reloads
  const onScreen = useRef(draft);
  const history = useHistory(draft, setDraft);

  const set = (patch: Partial<ZoronTheme>) => setDraft((d) => ({ ...d, ...patch }));
  const dirty = !sameTheme(normalizeTheme(draft, saved), saved);
  const badUrl = draft.backgroundImage !== '' && !SAFE_URL.test(draft.backgroundImage);
  const comparing = holding && dirty;
  const canSaveTheme = useCanSaveTheme();
  const canSave = dirty && load === 'ok' && !badUrl && canSaveTheme;
  // a role holding only the Zoron permission reaches the admin area, not necessarily its extensions page
  const closeTo = useAdminCan('extensions.*') ? '/admin/extensions' : '/admin';

  const blocker = useBlocker(dirty);
  useBeforeUnload((e) => {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = '';
  });

  /** Loads the stored theme; `replace` drops the draft, otherwise edits made meanwhile are kept. */
  const fetchTheme = (replace: boolean) => {
    const start = draft;
    setLoad('pending');
    loadTheme().then((res) => {
      if (!res) {
        setLoad('failed');
        return;
      }
      version.current = res.version;
      setSaved(res.theme);
      setDraft((d) => {
        if (!replace && d !== start) return d;
        history.restart(res.theme);
        return res.theme;
      });
      setLoad('ok');
    });
  };

  useEffect(() => {
    fetchTheme(false);
    getServers(1, undefined, false)
      .then((res) => setServerId(res.data[0]?.uuidShort ?? null))
      .catch(() => {
        // the server pages are simply left out of the picker
      });
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setStage({ width: el.clientWidth, height: el.clientHeight }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    shown.current = normalizeTheme(draft, shown.current);
    setValid(shown.current);
  }, [draft]);

  // drafts reach the frame at most every 50ms, so a slider drag stays smooth
  useEffect(() => {
    onScreen.current = comparing ? saved : valid;
    const id = setTimeout(() => sendPreview(frame.current, onScreen.current, scheme), 50);
    return () => clearTimeout(id);
  }, [valid, saved, comparing, scheme]);

  // the frame announces itself once Zoron runs in it (after every navigation inside it)
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      if ((event.data as { type?: string } | null)?.type === READY_MSG)
        sendPreview(frame.current, onScreen.current, scheme);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [scheme]);

  // a setting picked in the search: scrolled into view in its (now open) section and briefly lit, once
  useEffect(() => {
    if (!jump) return;
    const el = asideRef.current?.querySelector<HTMLElement>(`[data-zoron-setting="${jump.field}"]`);
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    const lit = 'color-mix(in srgb, var(--zoron-accent) 20%, transparent)';
    el.animate(
      [
        { borderRadius: '10px', backgroundColor: lit, boxShadow: `0 0 0 6px ${lit}` },
        { borderRadius: '10px', backgroundColor: 'transparent', boxShadow: '0 0 0 6px transparent' },
      ],
      { duration: 1600, easing: 'ease-out' },
    );
  }, [jump]);

  /** Stores `theme` (made from the draft `sent`); without `base` it replaces whatever is stored. */
  const store = (theme: ZoronTheme, sent: ZoronTheme, base?: string) => {
    setSaving(true);
    saveTheme(theme, base)
      .then((newVersion) => {
        version.current = newVersion;
        rememberTheme(theme);
        setSaved(theme);
        // edits made while the request was out stay in the draft (and count as unsaved)
        setDraft((d) => (d === sent ? theme : d));
        setConflict(null);
        addToast(t('editor.saved', {}), 'success');
      })
      .catch((err) => {
        if (base !== undefined && isAxiosError(err) && err.response?.status === 409) setConflict(theme);
        else addToast(httpErrorToHuman(err), 'error');
      })
      .finally(() => setSaving(false));
  };

  const doSave = () => {
    if (canSave && !saving) store(normalizeTheme(draft, saved), draft, version.current);
  };

  useKeyboardShortcuts({
    shortcuts: [
      { key: 's', modifiers: ['ctrlOrMeta'], allowWhenInputFocused: true, callback: doSave },
      // not while typing: there the field's own undo wins
      { key: 'z', modifiers: ['ctrlOrMeta', 'shift'], callback: history.redo },
      { key: 'z', modifiers: ['ctrlOrMeta'], callback: history.undo },
    ],
  });

  const doExport = () => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(
      new Blob([JSON.stringify(normalizeTheme(draft, saved), null, 2)], { type: 'application/json' }),
    );
    link.download = 'zoron-theme.json';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const doImport = (file: File) =>
    file
      .text()
      .then((body) => {
        const parsed: unknown = JSON.parse(body);
        if (!isThemeFile(parsed)) throw new Error('not a theme');
        setDraft(normalizeTheme(parsed, valid));
        addToast(t('editor.imported', {}), 'success');
      })
      .catch(() => addToast(t('editor.importFailed', {}), 'error'));

  const serverPath = serverId ? `/server/${serverId}` : null;
  const pages = [
    { value: '/', label: t('preview.servers', {}) },
    // with the overview on, a server opens on it and its console moves to /terminal (index.ts)
    ...(serverPath && valid.serverOverview ? [{ value: serverPath, label: t('preview.server', {}) }] : []),
    ...(serverPath
      ? [{ value: valid.serverOverview ? `${serverPath}/terminal` : serverPath, label: t('preview.console', {}) }]
      : []),
    { value: '/account', label: t('preview.account', {}) },
    { value: '/admin', label: t('preview.admin', {}) },
    { value: LOGIN_PREVIEW_PATH, label: t('preview.login', {}) },
  ];

  const searchData = SECTION_IDS.map((id) => ({
    group: t(`section.${id}`, {}),
    items: sectionSettings(id).map(([field, label]) => ({ value: field, label: t(label, {}) })),
  }));
  const changed = SECTION_IDS.filter((id) => sectionChanged(id, valid, saved));

  const available = Math.max(320, stage.width - STAGE_PADDING * 2);
  // the desktop preview is at least 1280px wide (the panel's sidebar layout), scaled down on a narrower stage
  const logicalWidth = device === 'desktop' ? Math.max(available, DEVICE_WIDTH.desktop) : DEVICE_WIDTH[device];
  const scale = Math.min(1, available / logicalWidth);
  const logicalHeight = Math.max(320, stage.height - STAGE_PADDING * 2) / scale;

  const saveBlocked = !canSaveTheme
    ? t('editor.noPermission', {})
    : load === 'pending'
      ? t('editor.loading', {})
      : load === 'failed'
        ? t('editor.loadFailed', {})
        : null;

  const SectionComponent = SECTIONS[section].Component;

  const iconButton = (label: string, icon: IconDefinition, onClick: () => void, disabled = false) => (
    <Tooltip label={label}>
      <ActionIcon variant='subtle' color='gray' size='lg' aria-label={label} disabled={disabled} onClick={onClick}>
        <FontAwesomeIcon icon={icon} />
      </ActionIcon>
    </Tooltip>
  );

  return (
    <div className='zoron-editor fixed inset-0 z-[120] flex flex-col bg-(--mantine-color-body) text-(--mantine-color-text)'>
      <header className='flex h-14 shrink-0 items-center gap-3 border-b border-(--mantine-color-default-border) bg-(--zoron-card-solid) px-3'>
        {iconButton(t('editor.close', {}), faXmark, () => navigate(closeTo))}
        <div className='flex min-w-0 items-center gap-2.5'>
          <div
            aria-hidden
            className='grid size-8 shrink-0 place-items-center rounded-lg text-sm font-bold text-(--zoron-accent-ink) shadow-[0_6px_18px_-8px_var(--zoron-glow-color)]'
            style={{ background: 'var(--zoron-gradient)' }}
          >
            Z
          </div>
          <div className='hidden min-w-0 flex-col leading-tight sm:flex'>
            <span className='truncate text-sm font-semibold'>{t('editor.title', {})}</span>
            <span className='flex items-center gap-1.5 text-xs text-(--mantine-color-dimmed)'>
              <span
                className={`size-1.5 rounded-full ${dirty ? 'bg-(--mantine-color-yellow-filled)' : 'bg-(--mantine-color-green-filled)'}`}
              />
              {dirty ? t('editor.unsaved', {}) : t('editor.upToDate', {})}
            </span>
          </div>
        </div>

        <div className='mx-auto flex min-w-0 items-center gap-2'>
          <Select
            size='xs'
            w={150}
            allowDeselect={false}
            aria-label={t('preview.page', {})}
            data={pages}
            value={pages.some((p) => p.value === page) ? page : null}
            onChange={(value) => value && setPage(value)}
            comboboxProps={{ zIndex: 400 }}
          />
          <SegmentedControl
            size='xs'
            value={device}
            onChange={(value) => setDevice(value as Device)}
            data={(
              [
                ['desktop', faDesktop],
                ['tablet', faTabletScreenButton],
                ['phone', faMobileScreen],
              ] as const
            ).map(([value, icon]) => ({
              value,
              label: (
                <Tooltip label={t(`preview.${value}`, {})}>
                  <span className='flex items-center px-0.5' aria-label={t(`preview.${value}`, {})}>
                    <FontAwesomeIcon icon={icon} />
                  </span>
                </Tooltip>
              ),
            }))}
          />
          {iconButton(
            scheme === 'dark' ? t('preview.light', {}) : t('preview.dark', {}),
            scheme === 'dark' ? faSun : faMoon,
            () => setScheme(scheme === 'dark' ? 'light' : 'dark'),
          )}
          {iconButton(t('preview.reload', {}), faRotateRight, () => setFrameKey((k) => k + 1))}
          <Tooltip label={t('editor.compare', {})}>
            <ActionIcon
              variant={comparing ? 'light' : 'subtle'}
              color='gray'
              size='lg'
              className='touch-none'
              aria-label={t('editor.compare', {})}
              aria-pressed={comparing}
              disabled={!dirty}
              onPointerDown={(e) => {
                if (e.button === 0) setHolding(true);
              }}
              onPointerUp={() => setHolding(false)}
              onPointerLeave={() => setHolding(false)}
              onPointerCancel={() => setHolding(false)}
              onContextMenu={(e) => e.preventDefault()}
              onKeyDown={(e) => {
                if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                  e.preventDefault();
                  setHolding(true);
                }
              }}
              onKeyUp={(e) => {
                if (e.key === ' ' || e.key === 'Enter') setHolding(false);
              }}
              onBlur={() => setHolding(false)}
            >
              <FontAwesomeIcon icon={faCodeCompare} />
            </ActionIcon>
          </Tooltip>
        </div>

        <div className='flex items-center gap-1'>
          {iconButton(t('editor.undo', {}), faArrowRotateLeft, history.undo, !history.canUndo)}
          {iconButton(t('editor.redo', {}), faArrowRotateRight, history.redo, !history.canRedo)}
          <Menu position='bottom-end' zIndex={400}>
            <Menu.Target>
              <ActionIcon variant='subtle' color='gray' size='lg' aria-label={t('editor.more', {})}>
                <FontAwesomeIcon icon={faEllipsisVertical} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<FontAwesomeIcon icon={faUpload} />} onClick={() => importRef.current?.click()}>
                {t('editor.import', {})}
              </Menu.Item>
              <Menu.Item leftSection={<FontAwesomeIcon icon={faDownload} />} onClick={doExport}>
                {t('editor.export', {})}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                leftSection={<FontAwesomeIcon icon={faArrowRotateLeft} />}
                disabled={!dirty}
                onClick={() => setDraft(saved)}
              >
                {t('editor.discard', {})}
              </Menu.Item>
              <Menu.Item
                color='red'
                leftSection={<FontAwesomeIcon icon={faTrashArrowUp} />}
                onClick={() => setConfirmReset(true)}
              >
                {t('editor.reset', {})}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <input
            ref={importRef}
            type='file'
            accept='application/json,.json'
            className='hidden'
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = '';
              if (file) void doImport(file);
            }}
          />
          <Tooltip label={saveBlocked ?? 'Ctrl / ⌘ + S'}>
            <Button className='ml-1' disabled={!canSave} loading={saving} onClick={doSave}>
              {t('editor.save', {})}
            </Button>
          </Tooltip>
        </div>
      </header>

      <div className='flex min-h-0 flex-1'>
        <nav className='flex w-[76px] shrink-0 flex-col items-stretch gap-1 overflow-y-auto border-r border-(--mantine-color-default-border) bg-(--zoron-card-solid) p-2'>
          {SECTION_IDS.map((id) => {
            const active = id === section;
            return (
              <button
                key={id}
                type='button'
                aria-current={active ? 'page' : undefined}
                onClick={() => setSection(id)}
                className={`relative flex cursor-pointer flex-col items-center gap-1 rounded-xl px-1 py-2 text-[0.6875rem] font-medium transition-colors duration-200 ${
                  active
                    ? 'bg-(--mantine-color-blue-light) text-(--mantine-color-blue-light-color)'
                    : 'text-(--mantine-color-dimmed) hover:bg-(--mantine-color-default-hover) hover:text-(--mantine-color-text)'
                }`}
              >
                <FontAwesomeIcon icon={SECTIONS[id].icon} className='text-base' />
                {t(`section.${id}`, {})}
                {changed.includes(id) && (
                  <>
                    <span
                      aria-hidden
                      className='absolute top-1.5 right-2 size-1.5 rounded-full bg-(--mantine-color-yellow-filled)'
                    />
                    <span className='sr-only'>{t('editor.changed', {})}</span>
                  </>
                )}
              </button>
            );
          })}
        </nav>

        <aside className='flex w-[360px] shrink-0 flex-col border-r border-(--mantine-color-default-border) bg-(--zoron-card-solid)'>
          <div className='border-b border-(--mantine-color-default-border) px-5 py-4'>
            <Select
              size='xs'
              mb='md'
              searchable
              aria-label={t('editor.search', {})}
              placeholder={t('editor.search', {})}
              leftSection={<FontAwesomeIcon icon={faMagnifyingGlass} className='text-xs' />}
              // a search field, not a picker: no chevron
              rightSection={null}
              nothingFoundMessage={t('editor.searchEmpty', {})}
              data={searchData}
              value={null}
              searchValue={query}
              onSearchChange={setQuery}
              onChange={(value) => {
                const field = value as keyof ZoronTheme | null;
                const target = field && SECTION_IDS.find((id) => sectionSettings(id).some(([f]) => f === field));
                if (field && target) {
                  setSection(target);
                  setJump({ field });
                }
                setQuery('');
              }}
              maxDropdownHeight={320}
              comboboxProps={{ zIndex: 400 }}
            />
            <div className='flex items-start justify-between gap-3'>
              <div className='min-w-0'>
                <h2 className='text-lg font-semibold tracking-tight'>{t(`section.${section}`, {})}</h2>
                <p className='mt-0.5 text-xs text-(--mantine-color-dimmed)'>{t(`section.${section}Hint`, {})}</p>
              </div>
              {/* presets are the admins' own saves, not settings with a default */}
              {section !== 'presets' && (
                <Tooltip label={t('editor.resetSectionHint', {})}>
                  <Button
                    size='compact-xs'
                    variant='subtle'
                    color='gray'
                    className='mt-1 shrink-0'
                    leftSection={<FontAwesomeIcon icon={faArrowRotateLeft} />}
                    disabled={!sectionChanged(section, valid, DEFAULT_THEME)}
                    onClick={() => setDraft((d) => withSection(d, section, DEFAULT_THEME))}
                  >
                    {t('editor.resetSection', {})}
                  </Button>
                </Tooltip>
              )}
            </div>
            {saveBlocked && load !== 'pending' && (
              <div className='mt-2 flex flex-col items-start gap-1.5 text-xs text-(--mantine-color-yellow-text)'>
                {saveBlocked}
                {load === 'failed' && (
                  <Button size='compact-xs' variant='default' onClick={() => fetchTheme(false)}>
                    {t('editor.retry', {})}
                  </Button>
                )}
              </div>
            )}
          </div>
          <div ref={asideRef} key={section} className='zoron-pop min-h-0 flex-1 overflow-y-auto px-5 py-5'>
            <SectionComponent draft={draft} valid={valid} set={set} />
          </div>
        </aside>

        <main
          ref={stageRef}
          className='zoron-stage relative flex min-w-0 flex-1 items-start justify-center overflow-hidden'
        >
          <div
            className='relative mt-7 shrink-0 overflow-hidden rounded-2xl border border-(--mantine-color-default-border) shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] transition-[width] duration-300'
            style={{ width: logicalWidth * scale, height: logicalHeight * scale }}
          >
            {load === 'pending' && (
              <div className='absolute inset-0 z-10 grid place-items-center bg-(--mantine-color-body)'>
                <Loader size='sm' />
              </div>
            )}
            <iframe
              key={frameKey}
              ref={frame}
              title={t('preview.page', {})}
              src={page}
              className='origin-top-left border-0'
              style={{ width: logicalWidth, height: logicalHeight, transform: `scale(${scale})` }}
            />
          </div>
        </main>
      </div>

      <ConfirmationModal
        opened={confirmReset}
        onClose={() => setConfirmReset(false)}
        title={t('editor.resetTitle', {})}
        confirm={t('editor.resetConfirm', {})}
        onConfirmed={() => {
          // the admins' own presets are saves, not part of the look being reset
          setDraft((d) => ({ ...DEFAULT_THEME, customPresets: d.customPresets }));
          setConfirmReset(false);
        }}
      >
        {t('editor.resetBody', {})}
      </ConfirmationModal>

      <ConfirmationModal
        opened={conflict !== null}
        onClose={() => setConflict(null)}
        title={t('editor.conflictTitle', {})}
        confirm={t('editor.conflictOverwrite', {})}
        onConfirmed={() => {
          if (conflict) store(conflict, draft);
        }}
      >
        <div className='flex flex-col items-start gap-3'>
          {t('editor.conflictBody', {})}
          <Button
            variant='default'
            onClick={() => {
              setConflict(null);
              fetchTheme(true);
            }}
          >
            {t('editor.conflictReload', {})}
          </Button>
        </div>
      </ConfirmationModal>

      <ConfirmationModal
        opened={blocker.state === 'blocked'}
        onClose={blocker.reset}
        title={t('editor.leaveTitle', {})}
        confirm={t('editor.leaveConfirm', {})}
        onConfirmed={blocker.proceed}
      >
        {t('editor.leaveBody', {})}
      </ConfirmationModal>
    </div>
  );
}
