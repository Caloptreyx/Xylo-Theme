import { faCheck, faGripVertical, faTableColumns } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { alpha } from '../../lib/color.ts';
import { Menu } from '../../lib/core.ts';
import { type ConsoleBarItem, type ConsoleMetric, terminalPalette, type ZoronTheme } from '../../lib/theme.ts';
import { useExtTranslations } from '../../translations.ts';
import { placeBarItem, placed, shownBarItems, toggleBar } from '../console/console.ts';
import { terminalInk } from './mocks.tsx';

/** The console's pieces the canvas places: the bar items, the quick command chips and the inspector. */
type Piece = ConsoleBarItem | 'chips' | 'inspector';

/** The canvas's slots: the two bars, the two chip rows, the two sides, and the tray of hidden pieces. */
type Zone = 'bar' | 'footer' | 'toolbar' | 'prompt' | 'left' | 'right' | 'hidden';

/** Where each piece may go; a drop anywhere else puts it back. */
const ZONES: Record<Piece, readonly Zone[]> = {
  identity: ['bar', 'footer', 'hidden'],
  metrics: ['bar', 'footer', 'hidden'],
  power: ['bar', 'footer', 'hidden'],
  chips: ['toolbar', 'prompt', 'hidden'],
  inspector: ['left', 'right', 'hidden'],
};

const PIECE_LABEL = {
  identity: 'consoleSection.pieceIdentity',
  metrics: 'consoleSection.pieceMetrics',
  power: 'consoleSection.piecePower',
  chips: 'consoleSection.pieceChips',
  inspector: 'consoleSection.pieceInspector',
} as const satisfies Record<Piece, string>;

const ZONE_LABEL = {
  bar: 'consoleSection.bar',
  footer: 'consoleSection.footer',
  toolbar: 'consoleSection.placeToolbar',
  prompt: 'consoleSection.placePrompt',
  left: 'consoleSection.inspectorLeft',
  right: 'consoleSection.inspectorRight',
  hidden: 'consoleSection.hidden',
} as const satisfies Record<Zone, string>;

/** The figures' names, here and in the Console tab's figure chips. */
export const METRIC_LABEL = {
  cpu: 'overview.cpu',
  memory: 'overview.memory',
  disk: 'overview.disk',
  netIn: 'console.netIn',
  netOut: 'console.netOut',
} as const satisfies Record<ConsoleMetric, string>;

/** How far a press must travel before it drags; a shorter one is a click, which opens the piece's menu. */
const DRAG_START = 5;

/** The accent tints every piece and target draws with (whole class names, so Tailwind finds them). */
const PIECE_LOOK =
  'border-[color-mix(in_srgb,var(--zoron-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--zoron-accent)_14%,transparent)]';
const TARGET_LOOK =
  'border-[color-mix(in_srgb,var(--zoron-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--zoron-accent)_7%,transparent)]';
const SNAP_LOOK = 'border-dashed border-(--zoron-accent) bg-[color-mix(in_srgb,var(--zoron-accent)_12%,transparent)]';

/** The insertion bar between two pieces of a bar, in the canvas's coordinates. */
interface Marker {
  left: number;
  top: number;
  height: number;
}

interface Drop {
  zone: Zone;
  /** The place in a bar, counted without the dragged piece. */
  index: number;
  marker: Marker | null;
}

interface Press {
  piece: Piece;
  pointerId: number;
  x: number;
  y: number;
  /** The pointer's offset in the piece, so the ghost stays where it was taken. */
  dx: number;
  dy: number;
  width: number;
  /** Escape ended the drag; the release that follows does nothing. */
  cancelled: boolean;
}

interface Drag extends Press {
  at: { x: number; y: number };
  drop: Drop | null;
}

/** A drag ends with a release whose click would open the piece's menu; this eats that one click. */
function swallowNextClick() {
  const stop = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
  window.addEventListener('click', stop, { capture: true, once: true });
  setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 0);
}

/**
 * Where the pointer falls among a row of wrapping elements, in reading order: before the first one it is above, or
 * level with and left of the middle of; after them all otherwise.
 */
function slotAt(items: readonly HTMLElement[], x: number, y: number): number {
  for (const [i, item] of items.entries()) {
    const box = item.getBoundingClientRect();
    if (y < box.top || (y <= box.bottom && x < box.left + box.width / 2)) return i;
  }
  return items.length;
}

/**
 * The insertion bar for `index` among `items`, relative to `origin`: in the gap before the item at `index`, or after
 * the one before it when that is the end, or the pointer is still on that one's line (`y`); at `empty`'s start when
 * there are no items.
 */
function markerAt(items: readonly HTMLElement[], index: number, y: number, origin: DOMRect, empty: DOMRect): Marker {
  const next = items[index]?.getBoundingClientRect();
  const previous = items[index - 1]?.getBoundingClientRect();
  if (previous && (!next || (y < next.top && y <= previous.bottom))) {
    return { left: previous.right + 2 - origin.left, top: previous.top - origin.top, height: previous.height };
  }
  if (next) return { left: next.left - 4 - origin.left, top: next.top - origin.top, height: next.height };
  return {
    left: empty.left + 6 - origin.left,
    top: empty.top + 6 - origin.top,
    height: Math.max(12, empty.height - 12),
  };
}

/** The slot under the pointer that takes `piece`, with the place in it; null over anything else. */
function dropAt(root: HTMLElement, piece: Piece, x: number, y: number): Drop | null {
  const slot = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-arrange-zone]');
  if (!slot || !root.contains(slot)) return null;
  // set on the slots below, one of ZONES' names
  const zone = slot.dataset.arrangeZone as Zone;
  if (!ZONES[piece].includes(zone)) return null;
  if (zone !== 'bar' && zone !== 'footer') return { zone, index: 0, marker: null };
  const items = Array.from(slot.querySelectorAll<HTMLElement>(':scope > [data-arrange-piece]')).filter(
    (item) => item.dataset.arrangePiece !== piece,
  );
  const index = slotAt(items, x, y);
  return {
    zone,
    index,
    marker: markerAt(items, index, y, root.getBoundingClientRect(), slot.getBoundingClientRect()),
  };
}

function sameList<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

/** Where `piece` is now. */
function zoneOf(theme: ZoronTheme, piece: Piece): Zone {
  if (piece === 'chips') return theme.consoleChips === 'off' ? 'hidden' : theme.consoleChips;
  if (piece === 'inspector') return theme.consoleInspector === 'off' ? 'hidden' : theme.consoleInspector;
  if (theme.consoleBar.includes(piece)) return 'bar';
  return theme.consoleFooter.includes(piece) ? 'footer' : 'hidden';
}

/**
 * The patch that puts `piece` in `zone` (a bar piece at `index`, by default its end), both bars at once when it
 * moves between them; null when that is where it already is.
 */
function moved(
  theme: ZoronTheme,
  piece: Piece,
  zone: Zone,
  index = Number.POSITIVE_INFINITY,
): Partial<ZoronTheme> | null {
  if (piece === 'chips') {
    const consoleChips = zone === 'toolbar' || zone === 'prompt' ? zone : 'off';
    return consoleChips === theme.consoleChips ? null : { consoleChips };
  }
  if (piece === 'inspector') {
    const consoleInspector = zone === 'left' || zone === 'right' ? zone : 'off';
    return consoleInspector === theme.consoleInspector ? null : { consoleInspector };
  }
  const bars = placeBarItem(theme, piece, zone === 'bar' || zone === 'footer' ? zone : null, index);
  const same = sameList(bars.consoleBar, theme.consoleBar) && sameList(bars.consoleFooter, theme.consoleFooter);
  return same ? null : bars;
}

/**
 * The shown figures as small chips in the Figures piece: dragged sideways they take the place they snap to (an
 * insertion bar marks it), the arrow keys move the focused one; each move is one `consoleMetrics` change.
 */
function FigureChips({
  metrics,
  onReorder,
}: {
  metrics: readonly ConsoleMetric[];
  onReorder: (metrics: ConsoleMetric[]) => void;
}) {
  const { t } = useExtTranslations();
  const row = useRef<HTMLDivElement>(null);
  const press = useRef<{ metric: ConsoleMetric; pointerId: number; x: number; y: number } | null>(null);
  const [slide, setSlide] = useState<{
    metric: ConsoleMetric;
    dx: number;
    dy: number;
    index: number;
    marker: Marker;
  } | null>(null);
  // the chip the arrow keys just moved and the order that makes: React moves its node, which drops the focus, so the
  // render showing that order focuses it again
  const refocus = useRef<{ metric: ConsoleMetric; order: string } | null>(null);

  useEffect(() => {
    if (!refocus.current || refocus.current.order !== metrics.join()) return;
    row.current?.querySelector<HTMLElement>(`[data-metric="${refocus.current.metric}"]`)?.focus();
    refocus.current = null;
  });

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, metric: ConsoleMetric) => {
    // the chip drags on its own, not the piece around it
    event.stopPropagation();
    if (event.button !== 0 || !event.isPrimary) return;
    press.current = { metric, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = press.current;
    const box = row.current;
    if (!start || start.pointerId !== event.pointerId || !box) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!slide && Math.hypot(dx, dy) < DRAG_START) return;
    const others = Array.from(box.querySelectorAll<HTMLElement>('[data-metric]')).filter(
      (chip) => chip.dataset.metric !== start.metric,
    );
    const index = slotAt(others, event.clientX, event.clientY);
    const origin = box.getBoundingClientRect();
    setSlide({ metric: start.metric, dx, dy, index, marker: markerAt(others, index, event.clientY, origin, origin) });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (press.current?.pointerId !== event.pointerId) return;
    press.current = null;
    if (!slide) return;
    setSlide(null);
    swallowNextClick();
    const next = placed(metrics, slide.metric, slide.index);
    if (!sameList(next, metrics)) onReorder(next);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, metric: ConsoleMetric, i: number) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    event.stopPropagation();
    const next = placed(metrics, metric, event.key === 'ArrowLeft' ? i - 1 : i + 1);
    if (sameList(next, metrics)) return;
    refocus.current = { metric, order: next.join() };
    onReorder(next);
  };

  return (
    <div ref={row} className='relative flex min-w-0 flex-wrap gap-1'>
      {metrics.map((metric, i) => {
        const label = t(METRIC_LABEL[metric], {});
        const sliding = slide?.metric === metric ? slide : null;
        return (
          <button
            key={metric}
            type='button'
            data-metric={metric}
            aria-label={t('consoleSection.figureMove', { figure: label })}
            title={t('consoleSection.figureMove', { figure: label })}
            className={`h-4.5 touch-none rounded border px-1 text-[10px] leading-none font-medium outline-none focus-visible:ring-2 focus-visible:ring-(--zoron-accent) ${PIECE_LOOK} ${
              sliding ? 'relative z-10 cursor-grabbing shadow-md' : 'cursor-ew-resize'
            }`}
            style={sliding ? { transform: `translate(${sliding.dx}px, ${sliding.dy}px)` } : undefined}
            onPointerDown={(event) => onPointerDown(event, metric)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              press.current = null;
              setSlide(null);
            }}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => onKeyDown(event, metric, i)}
          >
            {label}
          </button>
        );
      })}
      {slide && (
        <div
          className='pointer-events-none absolute w-0.5 rounded-full bg-(--zoron-accent)'
          style={{ left: slide.marker.left, top: slide.marker.top, height: slide.marker.height }}
        />
      )}
    </div>
  );
}

/**
 * Studio's console canvas: the workspace drawn small from the draft (the top bar, the terminal with its toolbar, chip
 * rows, output and prompt in the scheme's colours, a side slot either side, the bottom bar) and a tray of hidden
 * pieces under it. The pieces (name and state, figures, power, quick commands, the inspector) drag between the slots
 * that take them, snapping into place: bar pieces between the others of either bar (an insertion bar marks where),
 * the chips into either chip row, the inspector to either side, any of them onto the tray to hide it. While one
 * drags, its slots are tinted and the rest dimmed; a drop elsewhere puts it back. A click (or Enter or Space) opens a
 * menu of the places it may go instead, for the keyboard and fingers that prefer it. Each change is one `set()`, so
 * one undo step. The Figures piece shows the shown figures, which reorder sideways (FigureChips); with none picked it
 * reads empty and the bar leaves the telemetry out, as the page does. The inspector button is drawn where the page
 * puts it (toggleBar()).
 */
export function ConsoleArrange({ valid, set }: { valid: ZoronTheme; set: (patch: Partial<ZoronTheme>) => void }) {
  const { t } = useExtTranslations();
  const root = useRef<HTMLDivElement>(null);
  const press = useRef<Press | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [menu, setMenu] = useState<Piece | null>(null);
  const dragging = drag !== null;

  useEffect(() => {
    if (!dragging) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (press.current) press.current.cancelled = true;
      setDrag(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dragging]);

  const apply = (patch: Partial<ZoronTheme> | null) => {
    if (patch) set(patch);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>, piece: Piece) => {
    if (event.button !== 0 || !event.isPrimary) return;
    const box = event.currentTarget.getBoundingClientRect();
    press.current = {
      piece,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      dx: event.clientX - box.left,
      dy: event.clientY - box.top,
      width: box.width,
      cancelled: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = press.current;
    if (!start || start.cancelled || start.pointerId !== event.pointerId || !root.current) return;
    if (!drag && Math.hypot(event.clientX - start.x, event.clientY - start.y) < DRAG_START) return;
    setMenu(null);
    setDrag({
      ...start,
      at: { x: event.clientX, y: event.clientY },
      drop: dropAt(root.current, start.piece, event.clientX, event.clientY),
    });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = press.current;
    if (start?.pointerId !== event.pointerId) return;
    press.current = null;
    if (start.cancelled) {
      swallowNextClick();
      return;
    }
    // a press that never moved is a click: the menu opens
    if (!drag) return;
    setDrag(null);
    swallowNextClick();
    if (drag.drop) apply(moved(valid, drag.piece, drag.drop.zone, drag.drop.index));
  };

  const onPointerCancel = () => {
    press.current = null;
    setDrag(null);
  };

  /**
   * A slot's border and fill: `rest` at rest; while a piece drags, tinted if it takes it (dashed under the pointer,
   * the bars marking the place with the insertion bar instead), dimmed if not.
   */
  const slotLook = (zone: Zone, rest: string) => {
    if (!drag) return rest;
    if (!ZONES[drag.piece].includes(zone)) return `${rest} opacity-40`;
    const snapped = drag.drop?.zone === zone && zone !== 'bar' && zone !== 'footer';
    return snapped ? SNAP_LOOK : TARGET_LOOK;
  };

  const palette = terminalPalette(valid, true);
  const ink = terminalInk(palette);
  const line = alpha(ink.foreground, 0.14);
  const chipsZone = zoneOf(valid, 'chips');
  const inspectorZone = zoneOf(valid, 'inspector');
  const togglePlace = toggleBar(
    shownBarItems(valid.consoleBar, valid.consoleMetrics),
    shownBarItems(valid.consoleFooter, valid.consoleMetrics),
    valid.consoleInspector !== 'off',
  );
  const hidden = (['identity', 'metrics', 'power', 'chips', 'inspector'] as const).filter(
    (piece) => zoneOf(valid, piece) === 'hidden',
  );

  const pieceEl = (piece: Piece, onTerminal = false) => {
    const zone = zoneOf(valid, piece);
    const label = t(PIECE_LABEL[piece], {});
    const empty = piece === 'metrics' && valid.consoleMetrics.length === 0;
    const off = piece === 'chips' && !valid.consoleQuickCommands;
    const upright = zone === 'left' || zone === 'right';
    return (
      <Menu
        key={piece}
        opened={menu === piece}
        onChange={(opened) => setMenu(opened ? piece : null)}
        position='bottom-start'
        zIndex={400}
      >
        <Menu.Target>
          <div
            data-arrange-piece={piece}
            title={off ? t('consoleSection.pieceChipsOff', {}) : undefined}
            className={`flex min-w-0 max-w-full cursor-grab touch-none items-center gap-1.5 rounded-md border px-1.5 py-1 text-[11px] font-medium select-none ${PIECE_LOOK} ${
              empty || off ? 'border-dashed' : ''
            } ${drag?.piece === piece ? 'opacity-35' : ''} ${upright ? 'w-full flex-1 flex-col justify-center' : ''}`}
            style={onTerminal ? { color: ink.foreground } : undefined}
            onPointerDown={(event) => onPointerDown(event, piece)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          >
            <button
              type='button'
              className={`flex min-w-0 items-center gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-(--zoron-accent) ${
                empty || off ? 'opacity-70' : ''
              } ${upright ? 'flex-col' : ''}`}
              aria-label={t('consoleSection.pieceAt', { piece: label, place: t(ZONE_LABEL[zone], {}) })}
              aria-haspopup='menu'
            >
              <FontAwesomeIcon icon={faGripVertical} className='text-[9px] opacity-50' />
              <span className='truncate'>{label}</span>
            </button>
            {piece === 'metrics' &&
              zone !== 'hidden' &&
              (empty ? (
                <span className='text-[10px] text-(--mantine-color-dimmed)'>
                  {t('consoleSection.pieceMetricsEmpty', {})}
                </span>
              ) : (
                <FigureChips metrics={valid.consoleMetrics} onReorder={(consoleMetrics) => set({ consoleMetrics })} />
              ))}
          </div>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>{label}</Menu.Label>
          {ZONES[piece].map((target) => (
            <Menu.Item
              key={target}
              onClick={() => apply(moved(valid, piece, target))}
              rightSection={target === zone ? <FontAwesomeIcon icon={faCheck} className='text-[0.625rem]' /> : null}
            >
              {t(target === 'hidden' ? 'consoleSection.hide' : ZONE_LABEL[target], {})}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    );
  };

  const bar = (zone: 'bar' | 'footer') => {
    const items = zone === 'bar' ? valid.consoleBar : valid.consoleFooter;
    const toggle = togglePlace === (zone === 'bar' ? 'top' : 'bottom');
    return (
      <div
        data-arrange-zone={zone}
        data-zoron-setting={zone === 'footer' ? 'consoleFooter' : undefined}
        role='group'
        aria-label={t(ZONE_LABEL[zone], {})}
        className={`flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border p-1.5 transition-[opacity,background-color,border-color] duration-150 ${slotLook(
          zone,
          'border-(--mantine-color-default-border) bg-(--mantine-color-body)',
        )}`}
      >
        {items.map((item) => pieceEl(item))}
        {items.length === 0 && (
          <span className='px-1 text-[10px] text-(--mantine-color-placeholder)'>{t(ZONE_LABEL[zone], {})}</span>
        )}
        {toggle && (
          <span
            title={t('consoleSection.inspectorToggle', {})}
            className='ml-auto flex size-5 shrink-0 items-center justify-center rounded border border-(--mantine-color-default-border) text-[9px] text-(--mantine-color-dimmed)'
          >
            <FontAwesomeIcon icon={faTableColumns} />
          </span>
        )}
      </div>
    );
  };

  const chipRow = (zone: 'toolbar' | 'prompt') => (
    <div
      data-arrange-zone={zone}
      data-zoron-setting='consoleChips'
      role='group'
      aria-label={t(ZONE_LABEL[zone], {})}
      className={`mx-1 my-0.5 flex min-h-7 items-center rounded border p-0.5 transition-[opacity,background-color,border-color] duration-150 ${slotLook(
        zone,
        'border-dashed border-transparent',
      )}`}
      style={drag ? undefined : { borderColor: chipsZone === zone ? 'transparent' : alpha(ink.foreground, 0.16) }}
    >
      {chipsZone === zone && pieceEl('chips', true)}
    </div>
  );

  const side = (zone: 'left' | 'right') => (
    <div
      data-arrange-zone={zone}
      data-zoron-setting='consoleInspector'
      role='group'
      aria-label={t(ZONE_LABEL[zone], {})}
      className={`flex shrink-0 rounded-md border p-1 transition-[opacity,background-color,border-color] duration-150 ${
        inspectorZone === zone ? 'w-19' : 'w-5'
      } ${slotLook(zone, 'border-dashed border-(--mantine-color-default-border)')}`}
    >
      {inspectorZone === zone && pieceEl('inspector')}
    </div>
  );

  return (
    <div ref={root} data-zoron-setting='consoleBar' className='relative flex flex-col gap-2'>
      <div className='flex flex-col gap-1.5 rounded-xl border border-(--mantine-color-default-border) bg-(--mantine-color-default) p-1.5'>
        {bar('bar')}
        <div className='flex min-h-36 gap-1.5'>
          {side('left')}
          <div
            className='flex min-w-0 flex-1 flex-col overflow-hidden rounded-md border'
            style={{ background: palette?.background ?? valid.surface, borderColor: line }}
          >
            <div className='flex h-4 shrink-0 items-center gap-1 px-1.5' style={{ borderBottom: `1px solid ${line}` }}>
              <div className='size-1 rounded-full' style={{ background: ink.green }} />
              <div className='h-1 w-6 rounded-sm' style={{ background: alpha(ink.foreground, 0.35) }} />
              <div className='ml-auto h-1 w-4 rounded-sm' style={{ background: alpha(ink.foreground, 0.2) }} />
            </div>
            {chipRow('toolbar')}
            <div className='flex flex-1 flex-col justify-center gap-1 px-1.5 py-1'>
              <div className='h-1 w-[70%] rounded-sm' style={{ background: alpha(ink.foreground, 0.6) }} />
              <div className='h-1 w-[45%] rounded-sm' style={{ background: ink.green }} />
              <div className='h-1 w-[60%] rounded-sm' style={{ background: ink.dim }} />
            </div>
            {chipRow('prompt')}
            <div className='flex h-4 shrink-0 items-center gap-1 px-1.5' style={{ borderTop: `1px solid ${line}` }}>
              <span className='text-[9px] leading-none' style={{ color: 'var(--zoron-accent)' }}>
                ›
              </span>
              <div className='h-1 w-8 rounded-sm' style={{ background: alpha(ink.foreground, 0.3) }} />
            </div>
          </div>
          {side('right')}
        </div>
        {bar('footer')}
      </div>

      <div
        data-arrange-zone='hidden'
        role='group'
        aria-label={t('consoleSection.hidden', {})}
        className={`flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-[opacity,background-color,border-color] duration-150 ${slotLook(
          'hidden',
          'border-dashed border-(--mantine-color-default-border)',
        )}`}
      >
        <span className='mr-0.5 text-[11px] text-(--mantine-color-dimmed)'>{t('consoleSection.hidden', {})}</span>
        {hidden.map((piece) => pieceEl(piece))}
        {hidden.length === 0 && (
          <span className='text-[10px] text-(--mantine-color-placeholder)'>{t('consoleSection.hiddenEmpty', {})}</span>
        )}
      </div>

      {drag?.drop?.marker && (
        <div
          className='pointer-events-none absolute w-0.5 rounded-full bg-(--zoron-accent)'
          style={{ left: drag.drop.marker.left, top: drag.drop.marker.top, height: drag.drop.marker.height }}
        />
      )}

      {/* on body, so no transformed or blurred panel around the canvas can offset it */}
      {drag &&
        createPortal(
          <div
            className='pointer-events-none fixed flex items-center gap-1 rounded-md border border-(--zoron-accent) px-1.5 py-1 text-[11px] font-medium text-(--mantine-color-text) shadow-lg'
            style={{
              left: drag.at.x - drag.dx,
              top: drag.at.y - drag.dy,
              width: drag.width,
              zIndex: 1000,
              background: 'color-mix(in srgb, var(--zoron-accent) 16%, var(--mantine-color-body))',
            }}
          >
            <FontAwesomeIcon icon={faGripVertical} className='text-[9px] opacity-50' />
            <span className='truncate'>{t(PIECE_LABEL[drag.piece], {})}</span>
          </div>,
          document.body,
        )}
    </div>
  );
}
