import {
  faCheck,
  faClockRotateLeft,
  faGaugeHigh,
  faLayerGroup,
  faPlug,
  faPlus,
  faXmark,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { type KeyboardEvent, type PointerEvent, useEffect, useId, useRef, useState } from 'react';
import { GRID_COLUMNS, gridRows, resizeItem, sortGrid } from '../../lib/grid.ts';
import {
  OVERVIEW_SECTIONS,
  OVERVIEW_TEMPLATES,
  type OverviewItem,
  type OverviewSection,
  overviewTemplate,
  type ZoronTheme,
} from '../../lib/theme.ts';
import { useExtTranslations } from '../../translations.ts';
import { BLOCK_SIZE, dropGrid, nudgeItem, snapCell, snapSize } from '../server/overview.ts';
import { OverviewLayoutMock } from './mocks.tsx';

/**
 * Studio's arrange canvas for the server overview (`overviewGrid`): the blocks on the twelve column snap grid
 * (lib/grid.ts), drawn at a fixed row height so a block's height in rows shows. A block's body drags to move it, its
 * corner to resize it, its × hides it; the hidden blocks wait in a tray below, from which they drag onto the canvas or
 * are added at the bottom with a press. While a drag runs the canvas shows the grid as the drop would leave it, the
 * dragged block's place as a dashed outline; the drop is one change to the draft, so one undo step. The keyboard does
 * the same from a focused block. Raw pointer events with capture, so mouse and touch behave alike, and a press that
 * does not move past THRESHOLD stays a click.
 */

/** A canvas row's height in pixels; the page's rows are as tall as their content, the canvas's all alike. */
const ROW = 44;
/** How far a press moves before it becomes a drag, in pixels. */
const THRESHOLD = 5;
/** Where the pointer holds a block dragged out of the tray: near its top left corner. */
const TRAY_GRAB = 14;

const ICONS: Record<OverviewSection, IconDefinition> = {
  usage: faGaugeHigh,
  activity: faClockRotateLeft,
  connect: faPlug,
  glance: faLayerGroup,
};

const TINT = 'bg-[color-mix(in_srgb,var(--zoron-accent)_14%,transparent)]';
const EDGE = 'border-[color-mix(in_srgb,var(--zoron-accent)_45%,transparent)]';

/** The arrow keys as one step across and down. */
const STEPS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** Where a moved block would land: a cell, the tray (hidden), or nowhere (the drop changes nothing). */
type Target = { x: number; y: number } | 'hide' | null;

type Gesture =
  | {
      kind: 'move';
      block: OverviewSection;
      from: 'grid' | 'tray';
      /** The block following the pointer: its top left corner relative to the canvas's root, and its size. */
      left: number;
      top: number;
      width: number;
      height: number;
      target: Target;
    }
  | { kind: 'resize'; block: OverviewSection; w: number; h: number };

/** A press on a block, its corner or a tray chip, which turns into a gesture once it moves past THRESHOLD. */
interface Press {
  pointerId: number;
  kind: Gesture['kind'];
  block: OverviewSection;
  from: 'grid' | 'tray';
  startX: number;
  startY: number;
  /** The pointer's offset from the dragged block's top left corner. */
  grabX: number;
  grabY: number;
  started: boolean;
}

/** The grid as `gesture` would leave it. */
function outcome(grid: readonly OverviewItem[], gesture: Gesture | null): OverviewItem[] {
  if (!gesture) return [...grid];
  if (gesture.kind === 'resize') return resizeItem(grid, gesture.block, gesture.w, gesture.h);
  return dropGrid(grid, gesture.block, gesture.target);
}

export function OverviewArrange({
  look,
  grid,
  onChange,
}: {
  look: ZoronTheme;
  grid: readonly OverviewItem[];
  onChange: (grid: OverviewItem[]) => void;
}) {
  const { t } = useExtTranslations();
  const keysId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const pressRef = useRef<Press | null>(null);
  // the gesture as the handlers last left it; a release may come before the move's render
  const gestureRef = useRef<Gesture | null>(null);
  // a drag that ends on a tray chip would otherwise click it, adding the block at the bottom
  const swallowRef = useRef(false);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [message, setMessage] = useState('');

  const preview = outcome(grid, gesture);
  // one empty row to drop into, which a drag fills rather than grows, so the tray below stays where it was
  const rows = Math.max(gridRows(grid) + 1, gridRows(preview));
  const hidden = OVERVIEW_SECTIONS.filter((block) => !grid.some((item) => item.block === block));
  const nameOf = (block: OverviewSection) => t(`overviewSection.${block}`, {});
  const moving = gesture?.kind === 'move' ? gesture : null;

  const show = (next: Gesture | null) => {
    gestureRef.current = next;
    setGesture(next);
  };

  const dragging = gesture !== null;
  useEffect(() => {
    if (!dragging) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // captured first and stopped, so Escape cancels the drag without closing anything around the canvas
      e.preventDefault();
      e.stopPropagation();
      swallowRef.current = pressRef.current?.from === 'tray';
      pressRef.current = null;
      gestureRef.current = null;
      setGesture(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [dragging]);

  /** Applies `next` as one change to the draft, if it is one, and says what happened to `block`. */
  const commit = (next: OverviewItem[], block: OverviewSection) => {
    if (JSON.stringify(next) === JSON.stringify(grid)) return;
    onChange(next);
    const before = grid.find((item) => item.block === block);
    const after = next.find((item) => item.block === block);
    const name = nameOf(block);
    if (!after) setMessage(t('overviewSection.hiddenBlock', { name }));
    else if (!before) setMessage(t('overviewSection.addedTo', { name, x: `${after.x + 1}`, y: `${after.y + 1}` }));
    else if (before.w !== after.w || before.h !== after.h)
      setMessage(t('overviewSection.resizedTo', { name, w: `${after.w}`, h: `${after.h}` }));
    else setMessage(t('overviewSection.movedTo', { name, x: `${after.x + 1}`, y: `${after.y + 1}` }));
  };

  const press = (e: PointerEvent<HTMLElement>, kind: Press['kind'], block: OverviewSection, from: Press['from']) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    swallowRef.current = false;
    // the box of the block pressed (the wrapper around its body and corner); a chip from the tray is held near the
    // dragged block's corner instead
    const box = (e.currentTarget.closest('[data-block]') ?? e.currentTarget).getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    pressRef.current = {
      pointerId: e.pointerId,
      kind,
      block,
      from,
      startX: e.clientX,
      startY: e.clientY,
      grabX: from === 'grid' ? e.clientX - box.left : TRAY_GRAB,
      grabY: from === 'grid' ? e.clientY - box.top : TRAY_GRAB,
      started: false,
    };
  };

  const move = (e: PointerEvent<HTMLElement>) => {
    const held = pressRef.current;
    const canvas = gridRef.current?.getBoundingClientRect();
    const root = rootRef.current?.getBoundingClientRect();
    if (!held || held.pointerId !== e.pointerId || !canvas || !root) return;
    if (!held.started && Math.hypot(e.clientX - held.startX, e.clientY - held.startY) < THRESHOLD) return;
    held.started = true;
    const cellWidth = canvas.width / GRID_COLUMNS;
    const item = grid.find((other) => other.block === held.block);

    if (held.kind === 'resize') {
      if (!item) return;
      const size = snapSize(item, e.clientX - held.startX, e.clientY - held.startY, cellWidth, ROW);
      show({ kind: 'resize', block: held.block, ...size });
      return;
    }

    const size = item ?? BLOCK_SIZE[held.block];
    const left = e.clientX - held.grabX;
    const top = e.clientY - held.grabY;
    // what lies under the pointer; the block following it lets presses through, so it is never the answer
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const others = grid.filter((other) => other.block !== held.block);
    let target: Target = null;
    if (trayRef.current?.contains(under)) target = held.from === 'grid' ? 'hide' : null;
    else if (held.from === 'grid' || gridRef.current?.contains(under))
      target = snapCell(left - canvas.left, top - canvas.top, cellWidth, ROW, size.w, gridRows(others));
    show({
      kind: 'move',
      block: held.block,
      from: held.from,
      left: left - root.left,
      top: top - root.top,
      width: size.w * cellWidth,
      height: size.h * ROW,
      target,
    });
  };

  const release = (e: PointerEvent<HTMLElement>) => {
    const held = pressRef.current;
    if (!held || held.pointerId !== e.pointerId) return;
    pressRef.current = null;
    if (!held.started) return;
    swallowRef.current = held.from === 'tray';
    commit(outcome(grid, gestureRef.current), held.block);
    show(null);
  };

  const cancel = () => {
    pressRef.current = null;
    show(null);
  };

  const pointer = (kind: Press['kind'], block: OverviewSection, from: Press['from']) => ({
    onPointerDown: (e: PointerEvent<HTMLElement>) => press(e, kind, block, from),
    onPointerMove: move,
    onPointerUp: release,
    onPointerCancel: cancel,
  });

  /** Hides `block`; its element leaves the canvas, so focus moves to the canvas rather than falling to the page. */
  const hide = (block: OverviewSection) => {
    commit(dropGrid(grid, block, 'hide'), block);
    gridRef.current?.focus();
  };

  const keys = (e: KeyboardEvent, block: OverviewSection) => {
    const step = STEPS[e.key];
    if (step) {
      e.preventDefault();
      commit(nudgeItem(grid, block, step[0], step[1], e.shiftKey), block);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      hide(block);
    }
  };

  // the blocks in a fixed order, so a moved block's element keeps its place in the document and its focus; a block
  // dragged off the canvas stays mounted, unseen, since its element holds the pointer capture until the release
  const placed = OVERVIEW_SECTIONS.flatMap((block) => {
    const item = preview.find((other) => other.block === block);
    if (item) return [{ item, gone: false }];
    const from = moving?.from === 'grid' && moving.block === block && grid.find((other) => other.block === block);
    return from ? [{ item: from, gone: true }] : [];
  });
  const shown = sortGrid(grid).map((item) => item.block);
  const templateBlocks = shown.length > 0 ? shown : OVERVIEW_SECTIONS;
  const current = JSON.stringify(grid);

  return (
    <div ref={rootRef} className='relative flex flex-col gap-4 select-none'>
      <div className='overflow-hidden rounded-lg border border-(--mantine-color-default-border) bg-(--mantine-color-default)'>
        <div className='flex h-6 items-center gap-2 border-b border-(--mantine-color-default-border) px-2.5 text-[0.625rem] text-(--mantine-color-dimmed)'>
          <span className='h-1 w-8 rounded-full bg-(--mantine-color-placeholder) opacity-60' />
          {t('overviewSection.header', {})}
        </div>
        <div
          ref={gridRef}
          tabIndex={-1}
          role='group'
          aria-label={t('overviewSection.canvas', {})}
          className={`relative outline-none transition-colors duration-150 ${
            moving ? 'bg-[color-mix(in_srgb,var(--zoron-accent)_5%,transparent)]' : ''
          }`}
          style={{ height: rows * ROW }}
        >
          <div className='pointer-events-none absolute inset-0 grid grid-cols-12' aria-hidden>
            {Array.from({ length: GRID_COLUMNS }, (_, i) => (
              <div key={i} className='border-r border-(--mantine-color-default-border) opacity-40 last:border-r-0' />
            ))}
          </div>
          {Array.from({ length: rows - 1 }, (_, i) => (
            <div
              key={i}
              aria-hidden
              className='pointer-events-none absolute inset-x-0 border-t border-(--mantine-color-default-border) opacity-40'
              style={{ top: (i + 1) * ROW }}
            />
          ))}

          {placed.map(({ item, gone }) => {
            const name = nameOf(item.block);
            const ghost = moving?.block === item.block;
            const resizing = gesture?.kind === 'resize' && gesture.block === item.block;
            return (
              <div
                key={item.block}
                data-block={item.block}
                className={`absolute p-[3px] motion-safe:transition-[left,top,width,height] motion-safe:duration-150 ${gone ? 'invisible' : ''}`}
                style={{
                  left: `${(item.x / GRID_COLUMNS) * 100}%`,
                  top: item.y * ROW,
                  width: `${(item.w / GRID_COLUMNS) * 100}%`,
                  height: item.h * ROW,
                }}
              >
                {/* the dragged block stays mounted (it holds the pointer capture) and is drawn as the ghost */}
                <div
                  className={`relative h-full rounded-md ${
                    ghost
                      ? 'border-2 border-dashed border-(--zoron-accent) bg-[color-mix(in_srgb,var(--zoron-accent)_6%,transparent)]'
                      : `border ${TINT} ${resizing ? 'border-(--zoron-accent)' : EDGE}`
                  }`}
                >
                  <button
                    type='button'
                    className='absolute inset-0 flex cursor-grab touch-none flex-col items-start justify-between rounded-md px-2 py-1 text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-(--zoron-accent) active:cursor-grabbing'
                    aria-label={t('overviewSection.block', {
                      name,
                      w: `${item.w}`,
                      h: `${item.h}`,
                      x: `${item.x + 1}`,
                      y: `${item.y + 1}`,
                    })}
                    aria-describedby={keysId}
                    title={name}
                    onKeyDown={(e) => keys(e, item.block)}
                    {...pointer('move', item.block, 'grid')}
                  >
                    <span
                      className={`flex w-full min-w-0 items-center gap-1.5 pr-5 text-xs font-medium ${ghost ? 'invisible' : ''}`}
                    >
                      <FontAwesomeIcon icon={ICONS[item.block]} className='shrink-0 text-[0.625rem] opacity-70' />
                      <span className='truncate'>{name}</span>
                    </span>
                    <span
                      className={`text-[0.625rem] leading-3 tabular-nums text-(--mantine-color-dimmed) ${ghost ? 'invisible' : ''}`}
                    >
                      {t('overviewSection.size', { w: `${item.w}`, h: `${item.h}` })}
                    </span>
                  </button>
                  {!ghost && (
                    <>
                      <button
                        type='button'
                        className='absolute top-0.5 right-0.5 grid size-5 cursor-pointer place-items-center rounded text-[0.625rem] text-(--mantine-color-dimmed) hover:bg-(--mantine-color-default-hover) hover:text-(--mantine-color-text)'
                        aria-label={t('overviewSection.hide', { name })}
                        onClick={() => hide(item.block)}
                      >
                        <FontAwesomeIcon icon={faXmark} />
                      </button>
                      <span
                        aria-hidden
                        title={t('overviewSection.resize', { name })}
                        className='absolute right-0 bottom-0 size-5 cursor-nwse-resize touch-none'
                        {...pointer('resize', item.block, 'grid')}
                      >
                        <span className='absolute right-1 bottom-1 size-1.5 rounded-br-[2px] border-r-2 border-b-2 border-(--zoron-accent) opacity-70' />
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        ref={trayRef}
        className={`flex flex-col gap-2 rounded-lg border border-dashed p-2.5 transition-colors duration-150 ${
          moving?.from === 'grid'
            ? moving.target === 'hide'
              ? 'border-(--zoron-accent) bg-[color-mix(in_srgb,var(--zoron-accent)_10%,transparent)]'
              : 'border-[color-mix(in_srgb,var(--zoron-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--zoron-accent)_4%,transparent)]'
            : 'border-(--mantine-color-default-border)'
        }`}
      >
        <span className='text-xs text-(--mantine-color-dimmed)'>{t('overviewSection.tray', {})}</span>
        {hidden.length > 0 ? (
          <div className='flex flex-wrap gap-1.5'>
            {hidden.map((block) => {
              const name = nameOf(block);
              return (
                <button
                  key={block}
                  type='button'
                  aria-label={t('overviewSection.add', { name })}
                  className={`flex cursor-grab touch-none items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${TINT} ${EDGE} ${
                    moving?.block === block ? 'opacity-40' : ''
                  }`}
                  onClick={(e) => {
                    // a keyboard press (no pointer, `detail` 0) is never the end of a drag
                    const swallow = swallowRef.current && e.detail > 0;
                    swallowRef.current = false;
                    if (!swallow) commit(dropGrid(grid, block, { x: 0, y: gridRows(grid) }), block);
                  }}
                  {...pointer('move', block, 'tray')}
                >
                  <FontAwesomeIcon icon={ICONS[block]} className='text-[0.625rem] opacity-70' />
                  {name}
                  <FontAwesomeIcon icon={faPlus} className='text-[0.625rem] opacity-50' />
                </button>
              );
            })}
          </div>
        ) : (
          <p className='text-xs text-(--mantine-color-placeholder)'>
            {moving?.from === 'grid' ? t('overviewSection.trayDrop', {}) : t('overviewSection.trayEmpty', {})}
          </p>
        )}
      </div>

      <div className='flex flex-col gap-1.5'>
        <span className='text-sm'>{t('overviewSection.startFrom', {})}</span>
        <div className='grid grid-cols-3 gap-2' role='group' aria-label={t('overviewSection.startFrom', {})}>
          {OVERVIEW_TEMPLATES.map((template) => {
            const out = overviewTemplate(templateBlocks, template);
            const picked = JSON.stringify(out) === current;
            return (
              <button
                key={template}
                type='button'
                aria-pressed={picked}
                onClick={() => {
                  if (!picked) onChange(out);
                }}
                className={`zoron-tile flex cursor-pointer flex-col gap-1 rounded-xl border p-1 text-left transition-[border-color,background-color,box-shadow] duration-200 ${
                  picked
                    ? 'border-(--zoron-accent) bg-(--mantine-color-default-hover) shadow-[0_0_0_3px_color-mix(in_srgb,var(--zoron-accent)_22%,transparent)]'
                    : 'border-(--mantine-color-default-border) bg-(--mantine-color-default) hover:border-(--mantine-color-placeholder)'
                }`}
              >
                <div className='h-12 w-full overflow-hidden rounded-lg'>
                  <OverviewLayoutMock look={look} grid={out} />
                </div>
                <span className='flex items-center justify-between gap-1 px-1 pb-0.5 text-xs font-medium'>
                  <span className='truncate'>{t(`overviewSection.${template}`, {})}</span>
                  {picked && <FontAwesomeIcon icon={faCheck} className='text-[0.625rem] text-(--zoron-accent)' />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* the dragged block under the pointer, inset like the blocks on the canvas */}
      {moving && (
        <div
          aria-hidden
          className='pointer-events-none absolute z-10 flex items-start gap-1.5 rounded-md border border-(--zoron-accent) bg-[color-mix(in_srgb,var(--zoron-accent)_22%,var(--mantine-color-body))] px-2 py-1 text-xs font-medium opacity-90 shadow-[0_10px_24px_-10px_color-mix(in_srgb,var(--zoron-accent)_55%,transparent)]'
          style={{ left: moving.left + 3, top: moving.top + 3, width: moving.width - 6, height: moving.height - 6 }}
        >
          <FontAwesomeIcon icon={ICONS[moving.block]} className='mt-0.5 shrink-0 text-[0.625rem] opacity-70' />
          <span className='truncate'>{nameOf(moving.block)}</span>
        </div>
      )}

      <p id={keysId} hidden>
        {t('overviewSection.keys', {})}
      </p>
      <p aria-live='polite' className='sr-only'>
        {message}
      </p>
    </div>
  );
}
