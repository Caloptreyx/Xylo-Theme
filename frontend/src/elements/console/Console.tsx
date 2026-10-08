import { faCircleInfo, faTableColumns } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Drawer } from '@mantine/core';
import {
  type CSSProperties,
  type FC,
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
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
import { useZoronTheme } from '../../lib/store.ts';
import type { ConsoleBarItem } from '../../lib/theme.ts';
import { useExtTranslations } from '../../translations.ts';
import { phaseOf } from '../home/home.ts';
import { TileHeading } from '../tiles/TileFace.tsx';
import { barLayout, shownBarItems, toggleBar } from './console.ts';
import { Inspector, type InspectorTab } from './Inspector.tsx';
import { CommandChips } from './QuickCommands.tsx';
import { Telemetry } from './Telemetry.tsx';

/**
 * The visitor's own open state of the docked inspector, per browser ('shown' or 'hidden'); without one the theme's
 * `consoleInspectorOpen` decides.
 */
const PANEL_KEY = 'zoron:console-panel';

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
 * Core's console page, wherever core shows it (`/terminal`, or `/` with the overview off): Zoron's with
 * `consolePage` on, else core's, which the interceptor in index.ts hands in. Reading the theme here lets Studio
 * switch it live.
 */
export function ConsoleSwitch({ Core }: { Core: FC }) {
  const theme = useZoronTheme();
  return theme.consolePage ? <ConsolePage /> : <Core />;
}

/**
 * Keeps `--zoron-con-top` on the workspace: where it starts on the page, so app.css can size it down to the bottom
 * of the viewport. Measured again when the page's height changes (a notice above it coming or going) and when the
 * window resizes.
 */
function useViewportFill(box: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const measure = () =>
      element.style.setProperty(
        '--zoron-con-top',
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

function readPanel(): boolean | null {
  try {
    const value = localStorage.getItem(PANEL_KEY);
    return value === 'hidden' ? false : value === 'shown' ? true : null;
  } catch {
    return null;
  }
}

/**
 * One of the workspace's bars, the top one (`header`) or the one under the terminal (`footer`): `children` are its
 * pieces in the order of `items`, the inspector toggle last with `toggle`. Its grid at each size comes from
 * barLayout() as custom properties app.css reads (area names only, never theme text); the top one also carries the
 * window frame's grid, with its dots first.
 */
function CommandBar({
  place,
  items,
  toggle,
  children,
}: {
  place: 'top' | 'bottom';
  items: readonly ConsoleBarItem[];
  toggle: boolean;
  children: ReactNode;
}) {
  const grid = barLayout(items, toggle);
  const vars: Record<string, string> = {
    '--zoron-bar-areas': grid.wide.areas,
    '--zoron-bar-cols': grid.wide.columns,
    '--zoron-bar-areas-narrow': grid.narrow.areas,
    '--zoron-bar-cols-narrow': grid.narrow.columns,
    '--zoron-bar-areas-phone': grid.phone.areas,
    '--zoron-bar-cols-phone': grid.phone.columns,
  };
  if (place === 'bottom') {
    return (
      <footer className='zoron-con-bar' data-place='bottom' style={vars as CSSProperties}>
        {children}
      </footer>
    );
  }
  const dotted = barLayout(items, toggle, true);
  vars['--zoron-bar-areas-dots'] = dotted.wide.areas;
  vars['--zoron-bar-cols-dots'] = dotted.wide.columns;
  vars['--zoron-bar-areas-narrow-dots'] = dotted.narrow.areas;
  vars['--zoron-bar-cols-narrow-dots'] = dotted.narrow.columns;
  vars['--zoron-bar-areas-phone-dots'] = dotted.phone.areas;
  vars['--zoron-bar-cols-phone-dots'] = dotted.phone.columns;
  return (
    <header className='zoron-con-bar' data-place='top' style={vars as CSSProperties}>
      {children}
    </header>
  );
}

/**
 * Zoron's console page: one workspace from where it starts down to the viewport's bottom, painted in the terminal
 * scheme and worn by the terminal frame (app.css). Its bars hold the theme's pieces in the theme's order, the top one
 * (`consoleBar`) above the terminal and another (`consoleFooter`) under it: the server's name, state and uptime, live
 * telemetry with sparklines (the theme's figures, in its order, and graph style), core's power controls; the
 * inspector toggle ends the top bar, or the bottom one when only that has pieces, and a bar with nothing in it is
 * left out. Between them core's own terminal (search, history, SSH, popout, its features and input row slots), its
 * card dissolved into the workspace: its header a toolbar, its input the prompt along the bottom, the quick command
 * chips just above that or just under the toolbar (`consoleChips`), all spaced by `consoleDensity`. The inspector
 * (connect details, quick commands, other extensions' stat cards) docks on the theme's side of wide pages, slides over
 * the terminal from that side on narrower ones and is a sheet on phones; `consoleInspector: 'off'` leaves it and its
 * toggle out. Core's three charts are left out. The theme is read here, so Studio's drafts change it live.
 */
function ConsolePage() {
  const { t } = useExtTranslations();
  const { t: coreT } = useCoreTranslations();
  const theme = useZoronTheme();
  const server = useServerStore((state) => state.server);
  const state = useServerStore((state) => state.state);
  const uptime = useServerStore((state) => state.stats?.uptime ?? 0);
  const keyboardInset = useVisualViewportBottomInset();
  const root = useRef<HTMLElement>(null);
  const aside = useRef<HTMLElement>(null);
  const size = usePageSize(root);
  // the visitor's own choice, null until they toggle it (the theme's default applies until then)
  const [docked, setDocked] = useState(readPanel);
  // the sliding panel and the phone's sheet open on demand, never on load, and only at the size they were opened
  // at: a window crossing to a phone's width doesn't pop the sheet up
  const [shownAt, setShownAt] = useState<PageSize | null>(null);
  const shown = shownAt === size;
  const [tab, setTab] = useState<InspectorTab>('connect');
  useViewportFill(root);

  const phone = size === 'phone';
  const wide = size === 'wide';
  const inspector = theme.consoleInspector !== 'off';
  const open = inspector && (wide ? (docked ?? theme.consoleInspectorOpen) : shown);

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
      if (target.closest('[data-zoron-inspector-toggle], [data-portal]')) return;
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
      localStorage.setItem(PANEL_KEY, next ? 'shown' : 'hidden');
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
  const top = shownBarItems(theme.consoleBar, theme.consoleMetrics);
  const bottom = shownBarItems(theme.consoleFooter, theme.consoleMetrics);
  const togglePlace = toggleBar(top, bottom, inspector);

  const piece = (item: ConsoleBarItem) => {
    if (item === 'identity') {
      return (
        <div key='identity' className='zoron-con-id'>
          <TileHeading server={server} size={22} className='zoron-con-name' />
          <span className='zoron-con-state' data-phase={phase}>
            {t(`home.${phase}`, {})}
          </span>
          {live && uptime > 0 && (
            <span className='zoron-con-uptime'>
              {t('overview.uptime', { time: formatMilliseconds(uptime, true, false) })}
            </span>
          )}
        </div>
      );
    }
    if (item === 'metrics') {
      // keyed by the server too, so another server starts its own minute of samples
      return (
        <Telemetry
          key={`metrics:${server.uuid}`}
          live={live}
          metrics={theme.consoleMetrics}
          graph={theme.consoleGraphs}
        />
      );
    }
    return (
      <ServerCan key='power' action={['control.start', 'control.stop', 'control.restart']} matchAny>
        <div className='zoron-con-power'>
          <ServerPowerControls />
        </div>
      </ServerCan>
    );
  };

  const toggle = (
    <Tooltip label={toggleLabel}>
      <ActionIcon
        className='zoron-con-toggle'
        variant={open && !phone ? 'light' : 'subtle'}
        color='gray'
        size={phone ? 'xl' : 'lg'}
        data-zoron-inspector-toggle
        aria-label={toggleLabel}
        aria-expanded={open}
        aria-haspopup={phone ? 'dialog' : undefined}
        onClick={() => setOpen(!open)}
      >
        <FontAwesomeIcon icon={phone ? faCircleInfo : faTableColumns} />
      </ActionIcon>
    </Tooltip>
  );

  return (
    <ServerContentContainer
      title={coreT('pages.server.console.title', {})}
      hideTitleComponent
      registry={window.extensionContext.extensionRegistry.pages.server.console.container}
    >
      <section
        ref={root}
        className='zoron-con'
        data-phone={phone || undefined}
        data-inspector={phone || !inspector ? undefined : wide ? 'docked' : 'over'}
        data-side={theme.consoleInspector === 'left' ? 'left' : undefined}
        data-density={theme.consoleDensity}
        data-chips={theme.consoleChips}
        data-keyboard={keyboardInset > 0 || undefined}
        style={{ '--zoron-con-inset': `${keyboardInset}px` } as CSSProperties}
      >
        {(top.length > 0 || togglePlace === 'top') && (
          <CommandBar place='top' items={top} toggle={togglePlace === 'top'}>
            {top.map(piece)}
            {togglePlace === 'top' && toggle}
          </CommandBar>
        )}

        <div className='zoron-con-main'>
          <div className='zoron-con-term'>
            <CoreTerminal />
            <CommandChips onEdit={inspector ? () => openAt('commands') : undefined} />
          </div>
          {!phone && inspector && (
            <aside
              ref={aside}
              className='zoron-con-aside'
              data-open={open || undefined}
              inert={!open}
              aria-label={t('console.details', {})}
            >
              {/* the sliding panel stays mounted so it can slide out; a closed docked one is gone */}
              {(open || !wide) && <Inspector tab={tab} onTab={setTab} onClose={() => setOpen(false)} />}
            </aside>
          )}
        </div>

        {(bottom.length > 0 || togglePlace === 'bottom') && (
          <CommandBar place='bottom' items={bottom} toggle={togglePlace === 'bottom'}>
            {bottom.map(piece)}
            {togglePlace === 'bottom' && toggle}
          </CommandBar>
        )}

        {phone && inspector && (
          <Drawer
            opened={shown}
            onClose={() => setShownAt(null)}
            position='bottom'
            title={t('console.details', {})}
            classNames={{ content: 'zoron-sheet', header: 'zoron-sheet-header', body: 'zoron-sheet-body' }}
          >
            <Inspector tab={tab} onTab={setTab} />
          </Drawer>
        )}
      </section>
    </ServerContentContainer>
  );
}
