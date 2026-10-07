import { faCircleInfo, faTableColumns } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Drawer } from '@mantine/core';
import { type CSSProperties, type FC, type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActionIcon,
  CoreTerminal,
  formatMilliseconds,
  ServerCan,
  ServerContentContainer,
  ServerPowerControls,
  Tooltip,
  useCoreTranslations,
  useServerStore,
  useVisualViewportBottomInset,
} from '../../lib/core.ts';
import { useXyloTheme } from '../../lib/store.ts';
import { useExtTranslations } from '../../translations.ts';
import { phaseOf } from '../home/home.ts';
import { Inspector, type InspectorTab } from './Inspector.tsx';
import { CommandChips } from './QuickCommands.tsx';
import { Telemetry } from './Telemetry.tsx';

/** Whether the docked inspector is open, per browser ('hidden' when closed). */
const PANEL_KEY = 'xylo:console-panel';

/**
 * Page widths in rem: under PHONE it is a phone's page (app.css's phone rules key off `data-phone`, the shell's top
 * bar takes over at the same width), from DOCK the inspector docks beside the terminal; between, it slides over it.
 */
const PHONE = 64;
const DOCK = 80;

type PageSize = 'phone' | 'mid' | 'wide';

function pageSize(width: number, rem: number): PageSize {
  return width < PHONE * rem ? 'phone' : width < DOCK * rem ? 'mid' : 'wide';
}

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
 * Keeps `--xylo-con-top` on the workspace: where it starts on the page, so app.css can size it down to the bottom
 * of the viewport. Measured again when the page's height changes (a notice above it coming or going) and when the
 * window resizes.
 */
function useViewportFill(box: RefObject<HTMLElement | null>) {
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
    observer.observe(document.body);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [box]);
}

/**
 * The width class of the page holding `node`: its `page` container (the virtual window it is in, else the body),
 * measured as core's `usePageBreakpoint` does (that hook only exists from panel 1.2.2).
 */
function usePageSize(node: RefObject<HTMLElement | null>): PageSize {
  const [size, setSize] = useState(() => pageSize(document.body.getBoundingClientRect().width, 16));
  useLayoutEffect(() => {
    const page = node.current?.closest<HTMLElement>('.page-container') ?? document.body;
    const update = () => {
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      setSize(pageSize(page.getBoundingClientRect().width, rem));
    };
    const observer = new ResizeObserver(update);
    observer.observe(page);
    update();
    return () => observer.disconnect();
  }, [node]);
  return size;
}

function readDocked() {
  try {
    return localStorage.getItem(PANEL_KEY) !== 'hidden';
  } catch {
    return true;
  }
}

/**
 * Xylo's console page: one workspace from where it starts down to the viewport's bottom, painted in the terminal
 * scheme and worn by the terminal frame (app.css). Along its top the command bar: the server's name, state and
 * uptime, live telemetry with sparklines, core's power controls and the inspector toggle. Under it core's own
 * terminal (search, history, SSH, popout, its features and input row slots), its card dissolved into the
 * workspace: its header a toolbar, its input the prompt along the bottom, the quick command chips just above that.
 * The inspector (connect details, quick commands, other extensions' stat cards) docks on the right of wide pages,
 * slides over the terminal on narrower ones and is a sheet on phones. Core's three charts are left out.
 */
function ConsolePage() {
  const { t } = useExtTranslations();
  const { t: coreT } = useCoreTranslations();
  const server = useServerStore((state) => state.server);
  const state = useServerStore((state) => state.state);
  const uptime = useServerStore((state) => state.stats?.uptime ?? 0);
  const keyboardInset = useVisualViewportBottomInset();
  const root = useRef<HTMLElement>(null);
  const aside = useRef<HTMLElement>(null);
  const size = usePageSize(root);
  const [docked, setDocked] = useState(readDocked);
  // the sliding panel and the phone's sheet open on demand, never on load, and only at the size they were opened
  // at: a window crossing to a phone's width doesn't pop the sheet up
  const [shownAt, setShownAt] = useState<PageSize | null>(null);
  const shown = shownAt === size;
  const [tab, setTab] = useState<InspectorTab>('connect');
  useViewportFill(root);

  const phone = size === 'phone';
  const wide = size === 'wide';
  const open = wide ? docked : shown;

  // the sliding panel closes on Escape and on a press outside it (its toggles and anything in a portal, a menu
  // or tooltip it opened, excepted)
  useEffect(() => {
    if (size !== 'mid' || !shown) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShownAt(null);
    };
    const onDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || aside.current?.contains(target)) return;
      if (target.closest('[data-xylo-inspector-toggle], [data-portal]')) return;
      setShownAt(null);
    };
    // capture: the toggle's tooltip swallows the Escape that would close the panel
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [size, shown]);

  const setOpen = (next: boolean) => {
    if (!wide) {
      setShownAt(next ? size : null);
      return;
    }
    setDocked(next);
    try {
      if (next) localStorage.removeItem(PANEL_KEY);
      else localStorage.setItem(PANEL_KEY, 'hidden');
    } catch {
      // storage blocked: the state lasts until the next load
    }
  };

  const openAt = (next: InspectorTab) => {
    setTab(next);
    setOpen(true);
  };

  const phase = phaseOf(server, { state });
  const live = phase === 'running' || phase === 'starting';
  const toggleLabel = open ? t('console.hidePanel', {}) : t('console.showPanel', {});

  return (
    <ServerContentContainer
      title={coreT('pages.server.console.title', {})}
      hideTitleComponent
      registry={window.extensionContext.extensionRegistry.pages.server.console.container}
    >
      <section
        ref={root}
        className='xylo-con'
        data-phone={phone || undefined}
        data-inspector={phone ? undefined : wide ? 'docked' : 'over'}
        data-keyboard={keyboardInset > 0 || undefined}
        style={{ '--xylo-con-inset': `${keyboardInset}px` } as CSSProperties}
      >
        <header className='xylo-con-bar'>
          <div className='xylo-con-id'>
            <h1 className='xylo-con-name' title={server.name}>
              {server.name}
            </h1>
            <span className='xylo-con-state' data-phase={phase}>
              {t(`home.${phase}`, {})}
            </span>
            {live && uptime > 0 && (
              <span className='xylo-con-uptime'>
                {t('overview.uptime', { time: formatMilliseconds(uptime, true, false) })}
              </span>
            )}
          </div>
          <Telemetry key={server.uuid} live={live} />
          <ServerCan action={['control.start', 'control.stop', 'control.restart']} matchAny>
            <div className='xylo-con-power'>
              <ServerPowerControls />
            </div>
          </ServerCan>
          <Tooltip label={toggleLabel}>
            <ActionIcon
              className='xylo-con-toggle'
              variant={open && !phone ? 'light' : 'subtle'}
              color='gray'
              size={phone ? 'xl' : 'lg'}
              data-xylo-inspector-toggle
              aria-label={toggleLabel}
              aria-expanded={open}
              aria-haspopup={phone ? 'dialog' : undefined}
              onClick={() => setOpen(!open)}
            >
              <FontAwesomeIcon icon={phone ? faCircleInfo : faTableColumns} />
            </ActionIcon>
          </Tooltip>
        </header>

        <div className='xylo-con-main'>
          <div className='xylo-con-term'>
            <CoreTerminal />
            <CommandChips onEdit={() => openAt('commands')} />
          </div>
          {!phone && (
            <aside
              ref={aside}
              className='xylo-con-aside'
              data-open={open || undefined}
              inert={!open}
              aria-label={t('console.details', {})}
            >
              {/* the sliding panel stays mounted so it can slide out; a closed docked one is gone */}
              {(open || !wide) && <Inspector tab={tab} onTab={setTab} onClose={() => setOpen(false)} />}
            </aside>
          )}
        </div>

        {phone && (
          <Drawer
            opened={shown}
            onClose={() => setShownAt(null)}
            position='bottom'
            title={t('console.details', {})}
            classNames={{ content: 'xylo-sheet', header: 'xylo-sheet-header', body: 'xylo-sheet-body' }}
          >
            <Inspector tab={tab} onTab={setTab} />
          </Drawer>
        )}
      </section>
    </ServerContentContainer>
  );
}
