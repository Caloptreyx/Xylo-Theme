import { faAngleRight, faCircleInfo, faClock, faPen, faTableColumns, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Drawer } from '@mantine/core';
import {
  type CSSProperties,
  type FC,
  type FormEvent,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  ActionIcon,
  Button,
  CoreTerminal,
  ExtensionSlot,
  formatMilliseconds,
  ServerCan,
  ServerContentContainer,
  ServerPowerControls,
  SocketRequest,
  TextInput,
  Tooltip,
  useCoreTranslations,
  useServerCan,
  useServerStore,
  useVisualViewportBottomInset,
} from '../../lib/core.ts';
import { useXyloTheme } from '../../lib/store.ts';
import { useExtTranslations } from '../../translations.ts';
import { phaseOf } from '../home/home.ts';
import { ConnectDetails, Section, StatusChip, UsageStrip } from '../server/parts.tsx';
import { commandsKey, MAX_COMMAND, MAX_COMMANDS, parseCommands, withCommand } from './console.ts';

/** The details panel's state, per browser. */
const PANEL_KEY = 'xylo:console-panel';

/** Below this many rem the page is a phone's, as app.css's `@container page (width < 64rem)` has it. */
const PHONE_WIDTH = 64;

/**
 * Core's console page, wherever core shows it (`/terminal`, or `/` with the overview off): Xylo's with
 * `consolePage` on, else core's, which the interceptor in index.ts hands in. Reading the theme here lets Studio
 * switch it live.
 */
export function ConsoleSwitch({ Core }: { Core: FC }) {
  const theme = useXyloTheme();
  return theme.consolePage ? <ConsolePage /> : <Core />;
}

/**
 * Keeps `--xylo-con-top` on the terminal's box: where it starts on the page, so app.css can size it down to the
 * bottom of the viewport. Measured again when the header above it changes size and when the window does.
 */
function useViewportFill(box: RefObject<HTMLDivElement | null>, head: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const measure = () =>
      element.style.setProperty(
        '--xylo-con-top',
        `${Math.max(0, Math.round(element.getBoundingClientRect().top + window.scrollY))}px`,
      );
    measure();
    const observer = new ResizeObserver(measure);
    if (head.current) observer.observe(head.current);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [box, head]);
}

/**
 * Whether the page holding `node` is narrower than PHONE_WIDTH: its `page` container (the virtual window it is in,
 * else the body), measured as core's `usePageBreakpoint` does, so it agrees with app.css's container query. Core's
 * hook only exists from panel 1.2.2.
 */
function usePhone(node: RefObject<HTMLElement | null>) {
  const [phone, setPhone] = useState(() => document.body.getBoundingClientRect().width < PHONE_WIDTH * 16);
  useLayoutEffect(() => {
    const page = node.current?.closest<HTMLElement>('.page-container') ?? document.body;
    const update = () => {
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      setPhone(page.getBoundingClientRect().width < PHONE_WIDTH * rem);
    };
    const observer = new ResizeObserver(update);
    observer.observe(page);
    update();
    return () => observer.disconnect();
  }, [node]);
  return phone;
}

/** Lists saved while storage refused them, kept for this load; they win over storage until the next save. */
const unsaved = new Map<string, string>();
const commandListeners = new Set<() => void>();

function readCommands(key: string): string | null {
  const kept = unsaved.get(key);
  if (kept !== undefined) return kept;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function subscribeCommands(listener: () => void) {
  commandListeners.add(listener);
  return () => {
    commandListeners.delete(listener);
  };
}

function saveCommands(key: string, next: string[]) {
  const raw = JSON.stringify(next);
  try {
    localStorage.setItem(key, raw);
    unsaved.delete(key);
  } catch {
    unsaved.set(key, raw);
  }
  for (const listener of commandListeners) listener();
}

/**
 * A server's quick commands (`xylo:commands:<uuid>`, per browser), shared by every part showing them (the phone's
 * chips and its sheet, the details panel), with the setter that saves them.
 */
function useQuickCommands(uuid: string) {
  const key = commandsKey(uuid);
  const raw = useSyncExternalStore(subscribeCommands, () => readCommands(key));
  const commands = useMemo(() => parseCommands(raw), [raw]);
  return [commands, (next: string[]) => saveCommands(key, next)] as const;
}

/** Sends a command over the server's websocket; `ready` while it is connected and the server is not offline. */
function useCommandSender() {
  const state = useServerStore((state) => state.state);
  const socketConnected = useServerStore((state) => state.socketConnected);
  const socketInstance = useServerStore((state) => state.socketInstance);
  const connected = socketConnected && socketInstance !== null;
  return {
    connected,
    ready: connected && state !== 'offline',
    send: (command: string) => socketInstance?.send(SocketRequest.SEND_COMMAND, command),
  };
}

/**
 * The quick commands' card: the saved list (a click sends one) and the field adding one. Needs `control.console`,
 * as core's command input does, and a connected, running server to send.
 */
function QuickCommands() {
  const { t } = useExtTranslations();
  const uuid = useServerStore((state) => state.server.uuid);
  const canConsole = useServerCan('control.console');
  const [commands, save] = useQuickCommands(uuid);
  const { connected, ready, send } = useCommandSender();
  const [draft, setDraft] = useState('');

  if (!canConsole) return null;

  const add = (event: FormEvent) => {
    event.preventDefault();
    const next = withCommand(commands, draft);
    if (!next) return;
    save(next);
    setDraft('');
  };

  const full = commands.length >= MAX_COMMANDS;

  return (
    <Section title={t('console.commands', {})}>
      {commands.length === 0 ? (
        <p className='text-sm text-(--mantine-color-dimmed)'>{t('console.commandsEmpty', {})}</p>
      ) : (
        <ul className='xylo-con-commands'>
          {commands.map((command) => (
            <li key={command}>
              <button
                type='button'
                className='xylo-con-command'
                disabled={!ready}
                title={t('console.sendCommand', { command })}
                onClick={() => send(command)}
              >
                <FontAwesomeIcon icon={faAngleRight} className='shrink-0 opacity-50' />
                <span className='truncate'>{command}</span>
              </button>
              <ActionIcon
                variant='subtle'
                color='gray'
                size='md'
                aria-label={t('console.removeCommand', { command })}
                onClick={() => save(commands.filter((saved) => saved !== command))}
              >
                <FontAwesomeIcon icon={faXmark} />
              </ActionIcon>
            </li>
          ))}
        </ul>
      )}
      {!ready && commands.length > 0 && (
        <p className='text-xs text-(--mantine-color-dimmed)'>
          {connected ? t('console.offline', {}) : t('console.connecting', {})}
        </p>
      )}
      {full ? (
        <p className='text-xs text-(--mantine-color-dimmed)'>
          {t('console.commandsFull', { count: `${MAX_COMMANDS}` })}
        </p>
      ) : (
        <form onSubmit={add} className='flex gap-2'>
          <TextInput
            className='min-w-0 flex-1'
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value)}
            placeholder={t('console.commandPlaceholder', {})}
            aria-label={t('console.commandPlaceholder', {})}
            maxLength={MAX_COMMAND}
            classNames={{ input: 'font-mono' }}
          />
          <Button type='submit' variant='default' disabled={withCommand(commands, draft) === null}>
            {t('console.addCommand', {})}
          </Button>
        </form>
      )}
    </Section>
  );
}

/**
 * The phone's quick commands: one scrolling row of chips just above the terminal, a tap sending one (same rules as
 * the card), and a last chip opening the sheet at the card. Nothing while none are saved; the sheet adds them.
 */
function CommandChips({ onEdit }: { onEdit: () => void }) {
  const { t } = useExtTranslations();
  const uuid = useServerStore((state) => state.server.uuid);
  const canConsole = useServerCan('control.console');
  const [commands] = useQuickCommands(uuid);
  const { ready, send } = useCommandSender();

  if (!canConsole || commands.length === 0) return null;

  return (
    <div className='xylo-con-chips' role='group' aria-label={t('console.commands', {})}>
      {commands.map((command) => (
        <button
          key={command}
          type='button'
          className='xylo-con-chip'
          disabled={!ready}
          aria-label={t('console.sendCommand', { command })}
          onClick={() => send(command)}
        >
          <FontAwesomeIcon icon={faAngleRight} className='opacity-50' />
          <span className='truncate'>{command}</span>
        </button>
      ))}
      <button
        type='button'
        className='xylo-con-chip'
        data-edit
        aria-label={t('console.editCommands', {})}
        onClick={onEdit}
      >
        <FontAwesomeIcon icon={faPen} />
      </button>
    </div>
  );
}

/** What the phone's sheet opens at: the top, or the quick commands card. */
type SheetAt = 'details' | 'commands';

const scrollToStart = (node: HTMLElement | null) => node?.scrollIntoView({ block: 'start' });

/**
 * The phone's details, in a sheet from the bottom: how to connect, the quick commands card, and core's stat card
 * and block slots (mounted here only, never beside a details panel).
 */
function DetailsSheet({ at, onClose }: { at: SheetAt | null; onClose: () => void }) {
  const { t } = useExtTranslations();
  const registry = window.extensionContext.extensionRegistry.pages.server.console;
  const uuid = useServerStore((state) => state.server.uuid);

  return (
    <Drawer
      opened={at !== null}
      onClose={onClose}
      position='bottom'
      title={t('console.details', {})}
      classNames={{ content: 'xylo-sheet', header: 'xylo-sheet-header', body: 'xylo-sheet-body' }}
    >
      <Section title={t('overview.connect', {})}>
        <ConnectDetails />
      </Section>
      <div ref={at === 'commands' ? scrollToStart : undefined} className='xylo-sheet-anchor empty:hidden'>
        <QuickCommands key={uuid} />
      </div>
      <ExtensionSlot components={registry.statCards} name='console-stat-card' />
      <ExtensionSlot components={registry.statBlocks} name='console-stat-block' />
    </Drawer>
  );
}

/**
 * Xylo's console page: the server's name, state and uptime with core's power controls; one strip of live usage;
 * core's own terminal (search, history, SSH, popout, its features and input row) filling the rest of the viewport;
 * and a details panel beside it on wide pages, under it on narrow ones, hidden with its toggle: how to connect,
 * quick commands, and the stat cards and blocks other extensions add to core's console. Core's three charts are
 * left out.
 *
 * On a page under 64rem (`usePhone`) it is a phone's page instead: name and state over the uptime with a Details
 * button opening the details as a sheet, the power buttons as one row, usage as one scrolling line, the saved quick
 * commands as chips, and the terminal to the canvas's edges.
 */
function ConsolePage() {
  const { t } = useExtTranslations();
  const { t: coreT } = useCoreTranslations();
  const server = useServerStore((state) => state.server);
  const state = useServerStore((state) => state.state);
  const stats = useServerStore((state) => state.stats);
  const keyboardInset = useVisualViewportBottomInset();
  const root = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const phone = usePhone(root);
  const [panel, setPanel] = useState(() => {
    try {
      return localStorage.getItem(PANEL_KEY) !== 'hidden';
    } catch {
      return true;
    }
  });
  const [sheet, setSheet] = useState<SheetAt | null>(null);
  useViewportFill(box, head);

  const togglePanel = () => {
    const next = !panel;
    setPanel(next);
    try {
      if (next) localStorage.removeItem(PANEL_KEY);
      else localStorage.setItem(PANEL_KEY, 'hidden');
    } catch {
      // storage blocked: the state lasts until the next load
    }
  };

  const registry = window.extensionContext.extensionRegistry.pages.server.console;
  const phase = phaseOf(server, { state });
  const live = phase === 'running' || phase === 'starting';
  const panelLabel = panel ? t('console.hidePanel', {}) : t('console.showPanel', {});
  const uptime = live && stats && stats.uptime > 0 && (
    <span className='xylo-con-uptime inline-flex items-center gap-1.5 text-sm text-(--mantine-color-dimmed)'>
      <FontAwesomeIcon icon={faClock} className='opacity-60' />
      {t('overview.uptime', { time: formatMilliseconds(stats.uptime, true, false) })}
    </span>
  );
  const power = (
    <ServerCan action={['control.start', 'control.stop', 'control.restart']} matchAny>
      {phone ? (
        <div className='xylo-con-power'>
          <ServerPowerControls />
        </div>
      ) : (
        <ServerPowerControls />
      )}
    </ServerCan>
  );

  return (
    <ServerContentContainer
      title={coreT('pages.server.console.title', {})}
      hideTitleComponent
      registry={registry.container}
    >
      <div ref={root} className='xylo-con' data-phone={phone || undefined}>
        {phone ? (
          <div ref={head} className='xylo-con-head'>
            <header className='xylo-con-bar'>
              <div className='min-w-0 flex-1'>
                <div className='flex min-w-0 items-center gap-2'>
                  <h1 className='min-w-0 truncate text-lg font-semibold tracking-tight'>{server.name}</h1>
                  <StatusChip phase={phase} />
                </div>
                {uptime}
              </div>
              <Button
                variant='default'
                leftSection={<FontAwesomeIcon icon={faCircleInfo} />}
                aria-haspopup='dialog'
                onClick={() => setSheet('details')}
              >
                {t('console.details', {})}
              </Button>
            </header>
            {power}
            <UsageStrip compact />
            <CommandChips onEdit={() => setSheet('commands')} />
          </div>
        ) : (
          <div ref={head} className='flex flex-col gap-4'>
            <header className='flex flex-wrap items-center justify-between gap-x-4 gap-y-3'>
              <div className='min-w-0'>
                <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
                  <h1 className='truncate text-xl font-semibold tracking-tight sm:text-2xl'>{server.name}</h1>
                  <StatusChip phase={phase} />
                  {uptime}
                </div>
                {server.description && (
                  <p
                    className='mt-1 max-w-[80ch] truncate text-sm text-(--mantine-color-dimmed)'
                    title={server.description}
                  >
                    {server.description}
                  </p>
                )}
              </div>
              <div className='flex shrink-0 flex-wrap items-center gap-2'>
                <Tooltip label={panelLabel}>
                  <ActionIcon
                    variant={panel ? 'light' : 'default'}
                    color='gray'
                    size='input-sm'
                    aria-label={panelLabel}
                    aria-pressed={panel}
                    onClick={togglePanel}
                  >
                    <FontAwesomeIcon icon={faTableColumns} />
                  </ActionIcon>
                </Tooltip>
                {power}
              </div>
            </header>
            <UsageStrip compact />
          </div>
        )}

        <div className='xylo-con-body' data-panel={(panel && !phone) || undefined}>
          <div
            ref={box}
            className='xylo-con-term'
            data-keyboard={keyboardInset > 0 || undefined}
            style={{ '--xylo-con-inset': `${keyboardInset}px` } as CSSProperties}
          >
            <CoreTerminal />
          </div>
          {panel && !phone && (
            <aside className='xylo-con-side'>
              <Section title={t('overview.connect', {})}>
                <ConnectDetails />
              </Section>
              <QuickCommands key={server.uuid} />
              <ExtensionSlot components={registry.statCards} name='console-stat-card' />
              <ExtensionSlot components={registry.statBlocks} name='console-stat-block' />
            </aside>
          )}
        </div>
        {phone && <DetailsSheet at={sheet} onClose={() => setSheet(null)} />}
      </div>
    </ServerContentContainer>
  );
}
