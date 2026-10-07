import { faAngleRight, faClock, faTableColumns, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { type CSSProperties, type FC, type FormEvent, type RefObject, useEffect, useRef, useState } from 'react';
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
 * Commands saved per server in this browser (`xylo:commands:<uuid>`); a click sends one through the server's
 * websocket. Needs `control.console`, as core's command input does, and a connected, running server to send.
 */
function QuickCommands() {
  const { t } = useExtTranslations();
  const uuid = useServerStore((state) => state.server.uuid);
  const state = useServerStore((state) => state.state);
  const socketConnected = useServerStore((state) => state.socketConnected);
  const socketInstance = useServerStore((state) => state.socketInstance);
  const canConsole = useServerCan('control.console');
  const [commands, setCommands] = useState(() => {
    try {
      return parseCommands(localStorage.getItem(commandsKey(uuid)));
    } catch {
      return [];
    }
  });
  const [draft, setDraft] = useState('');

  if (!canConsole) return null;

  const save = (next: string[]) => {
    setCommands(next);
    try {
      localStorage.setItem(commandsKey(uuid), JSON.stringify(next));
    } catch {
      // storage blocked: the list lasts until the next load
    }
  };

  const add = (event: FormEvent) => {
    event.preventDefault();
    const next = withCommand(commands, draft);
    if (!next) return;
    save(next);
    setDraft('');
  };

  const connected = socketConnected && socketInstance !== null;
  const ready = connected && state !== 'offline';
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
                onClick={() => socketInstance?.send(SocketRequest.SEND_COMMAND, command)}
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
 * Xylo's console page: the server's name, state and uptime with core's power controls; one strip of live usage;
 * core's own terminal (search, history, SSH, popout, its features and input row) filling the rest of the viewport;
 * and a details panel beside it on wide pages, under it on narrow ones, hidden with its toggle: how to connect,
 * quick commands, and the stat cards and blocks other extensions add to core's console. Core's three charts are
 * left out.
 */
function ConsolePage() {
  const { t } = useExtTranslations();
  const { t: coreT } = useCoreTranslations();
  const server = useServerStore((state) => state.server);
  const state = useServerStore((state) => state.state);
  const stats = useServerStore((state) => state.stats);
  const keyboardInset = useVisualViewportBottomInset();
  const box = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const [panel, setPanel] = useState(() => {
    try {
      return localStorage.getItem(PANEL_KEY) !== 'hidden';
    } catch {
      return true;
    }
  });
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

  return (
    <ServerContentContainer
      title={coreT('pages.server.console.title', {})}
      hideTitleComponent
      registry={registry.container}
    >
      <div className='xylo-con'>
        <div ref={head} className='flex flex-col gap-4'>
          <header className='flex flex-wrap items-center justify-between gap-x-4 gap-y-3'>
            <div className='min-w-0'>
              <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
                <h1 className='truncate text-xl font-semibold tracking-tight sm:text-2xl'>{server.name}</h1>
                <StatusChip phase={phase} />
                {live && stats && stats.uptime > 0 && (
                  <span className='inline-flex items-center gap-1.5 text-sm text-(--mantine-color-dimmed)'>
                    <FontAwesomeIcon icon={faClock} className='opacity-60' />
                    {t('overview.uptime', { time: formatMilliseconds(stats.uptime, true, false) })}
                  </span>
                )}
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
              <ServerCan action={['control.start', 'control.stop', 'control.restart']} matchAny>
                <ServerPowerControls />
              </ServerCan>
            </div>
          </header>
          <UsageStrip compact />
        </div>

        <div className='xylo-con-body' data-panel={panel || undefined}>
          <div
            ref={box}
            className='xylo-con-term'
            data-keyboard={keyboardInset > 0 || undefined}
            style={{ '--xylo-con-inset': `${keyboardInset}px` } as CSSProperties}
          >
            <CoreTerminal />
          </div>
          {panel && (
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
      </div>
    </ServerContentContainer>
  );
}
