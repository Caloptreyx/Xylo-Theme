import type { CSSProperties, ReactNode } from 'react';
import { alpha, mix } from '../../lib/color.ts';
import {
  type Backdrop,
  type ButtonStyle,
  type ConsoleGraph,
  type ConsoleInspector,
  FONT_STACKS,
  type Font,
  type NavStyle,
  type OverviewHeader,
  type OverviewLayout,
  type OverviewSection,
  type OverviewUsage,
  type Pattern,
  type PresetLook,
  type Sidebar,
  type Surface,
  type TerminalPalette,
  type TerminalScheme,
  type TerminalSkin,
  type Transition,
} from '../../lib/theme.ts';
import { serverTile } from '../../lib/tiles.ts';
import { sparkBars, sparkPath } from '../console/telemetry.ts';
import { overviewRows } from '../server/overview.ts';

/**
 * Small drawings of each option, painted with the draft's own colours, so a choice shows what it does before it is
 * picked. They mirror app.css's rules at thumbnail scale; they never touch the real page.
 */

type Look = Pick<PresetLook, 'accent' | 'accent2' | 'background' | 'surface' | 'text'> &
  Partial<Pick<PresetLook, 'backdropIntensity' | 'radius' | 'controlRadius'>>;

const gradient = (t: Look) => `linear-gradient(135deg,${t.accent},${t.accent2})`;

/** The backdrop's light fields as one CSS background, the page colour last. */
export function backdropBackground(t: Look, backdrop: Backdrop, strength = (t.backdropIntensity ?? 60) / 100): string {
  const f1 = alpha(t.accent, 0.55 * strength);
  const f2 = alpha(t.accent2, 0.45 * strength);
  const f3 = alpha(mix(t.accent, t.accent2, 0.5), 0.35 * strength);
  const layers: Record<Backdrop, string[]> = {
    aurora: [
      `radial-gradient(70% 60% at 18% 12%,${f1},transparent 70%)`,
      `radial-gradient(60% 55% at 86% 18%,${f2},transparent 70%)`,
      `radial-gradient(80% 60% at 58% 100%,${f3},transparent 70%)`,
    ],
    spotlight: [
      `radial-gradient(90% 60% at 50% 0%,${f1},transparent 72%)`,
      `radial-gradient(45% 35% at 62% 4%,${f2},transparent 70%)`,
    ],
    mesh: [
      `radial-gradient(60% 55% at 8% 8%,${f1},transparent 70%)`,
      `radial-gradient(60% 55% at 94% 10%,${f2},transparent 70%)`,
      `radial-gradient(60% 55% at 90% 94%,${f1},transparent 70%)`,
      `radial-gradient(60% 55% at 10% 92%,${f3},transparent 70%)`,
    ],
    solid: [],
  };
  return [...layers[backdrop], t.background].join(',');
}

const frame = (t: Look, backdrop: Backdrop, children: ReactNode, extra: CSSProperties = {}) => (
  <div
    className='relative h-full w-full overflow-hidden'
    style={{ background: backdropBackground(t, backdrop), ...extra }}
  >
    {children}
  </div>
);

const card = (t: Look, style: CSSProperties = {}) => (
  <div
    className='absolute'
    style={{
      inset: '22% 14% 18% 30%',
      borderRadius: Math.max(3, (t.radius ?? 16) / 3),
      background: alpha(t.surface, 0.75),
      border: `1px solid ${alpha(t.text, 0.12)}`,
      ...style,
    }}
  />
);

export const BackdropMock = ({ look, backdrop }: { look: Look; backdrop: Backdrop }) =>
  frame(look, backdrop, card(look));

function patternStyle(t: Look, pattern: Pattern): CSSProperties {
  const ink = alpha(t.text, 0.14);
  if (pattern === 'grid') {
    return {
      backgroundImage: `linear-gradient(${ink} 1px,transparent 1px),linear-gradient(90deg,${ink} 1px,transparent 1px)`,
      backgroundSize: '12px 12px',
    };
  }
  if (pattern === 'dots')
    return { backgroundImage: `radial-gradient(${ink} 1px,transparent 1.5px)`, backgroundSize: '8px 8px' };
  if (pattern === 'noise') {
    return {
      opacity: 0.35,
      backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
    };
  }
  return {};
}

export const PatternMock = ({ look, pattern }: { look: Look; pattern: Pattern }) =>
  frame(look, 'spotlight', <div className='absolute inset-0' style={patternStyle(look, pattern)} />);

export function SurfaceMock({ look, surface }: { look: Look; surface: Surface }) {
  const fill =
    surface === 'glass' ? alpha(look.surface, 0.55) : surface === 'outline' ? alpha(look.surface, 0.3) : look.surface;
  return frame(
    look,
    'aurora',
    <>
      <div
        className='absolute rounded-full'
        style={{ width: 26, height: 26, left: '40%', top: '30%', background: gradient(look) }}
      />
      {card(look, {
        background: fill,
        backdropFilter: surface === 'glass' ? 'blur(6px)' : undefined,
        border: `1px solid ${alpha(look.text, surface === 'outline' ? 0.3 : 0.12)}`,
      })}
    </>,
    { backgroundColor: look.background },
  );
}

export function SidebarMock({ look, sidebar }: { look: Look; sidebar: Sidebar }) {
  const edge = `1px solid ${alpha(look.text, 0.12)}`;
  const lines = (
    <>
      <div className='h-1.5 w-3/4 rounded-sm' style={{ background: alpha(look.text, 0.3) }} />
      <div className='h-1.5 w-2/3 rounded-sm' style={{ background: alpha(look.text, 0.18) }} />
      <div className='h-1.5 w-1/2 rounded-sm' style={{ background: alpha(look.text, 0.18) }} />
    </>
  );
  if (sidebar === 'rail') {
    return frame(
      look,
      'aurora',
      <>
        {/* the rail, its first square current */}
        <div className='absolute top-1.5 bottom-1.5 left-1 flex flex-col items-center gap-1'>
          {(['current', 'b', 'c', 'd'] as const).map((square) => (
            <div
              key={square}
              className='size-2.5 rounded-[3px]'
              style={{ background: square === 'current' ? gradient(look) : alpha(look.text, 0.18) }}
            />
          ))}
        </div>
        <div className='absolute top-2 bottom-2 flex flex-col gap-1' style={{ left: 18, width: '22%' }}>
          {lines}
        </div>
        {card(look, { inset: '6% 5% 6% 44%', background: alpha(mix(look.surface, look.background, 0.55), 0.8) })}
      </>,
    );
  }
  const inset = sidebar === 'docked' ? 0 : 6;
  return frame(
    look,
    'aurora',
    <>
      <div
        className='absolute flex flex-col gap-1 p-1.5'
        style={{
          left: inset,
          top: inset,
          bottom: inset,
          width: '30%',
          borderRadius: sidebar === 'docked' ? 0 : 8,
          background: alpha(look.surface, 0.7),
          border: sidebar === 'docked' ? undefined : edge,
          borderRight: edge,
        }}
      >
        <div className='h-1.5 rounded-sm' style={{ background: gradient(look) }} />
        {lines}
      </div>
      {card(look, { inset: '18% 8% 18% 42%' })}
    </>,
  );
}

function navActive(t: Look, nav: NavStyle): CSSProperties {
  if (nav === 'pill') return { background: gradient(t), boxShadow: `0 3px 10px -4px ${alpha(t.accent, 0.7)}` };
  if (nav === 'glow')
    return {
      background: alpha(t.accent, 0.2),
      boxShadow: `inset 0 0 0 1px ${alpha(t.accent, 0.45)}, 0 0 10px ${alpha(t.accent, 0.45)}`,
    };
  if (nav === 'bar') return { background: alpha(t.text, 0.08), boxShadow: `inset 3px 0 0 ${t.accent}` };
  return { background: alpha(t.text, 0.1) };
}

export function NavMock({ look, nav }: { look: Look; nav: NavStyle }) {
  return (
    <div className='flex h-full flex-col justify-center gap-1 px-3' style={{ background: look.surface }}>
      {(['above', 'current', 'below'] as const).map((row) => (
        <div
          key={row}
          className='flex h-3 items-center gap-1 rounded px-1'
          style={row === 'current' ? navActive(look, nav) : undefined}
        >
          <div
            className='size-1.5 rounded-full'
            style={{ background: alpha(look.text, row === 'current' ? 0.9 : 0.35) }}
          />
          <div
            className='h-1 w-10 rounded-sm'
            style={{ background: alpha(look.text, row === 'current' ? 0.8 : 0.25) }}
          />
        </div>
      ))}
    </div>
  );
}

function buttonFill(t: Look, style: ButtonStyle): CSSProperties {
  if (style === 'gradient') return { background: gradient(t), boxShadow: `0 4px 12px -5px ${alpha(t.accent, 0.8)}` };
  if (style === 'solid') return { background: t.accent };
  if (style === 'soft')
    return { background: alpha(t.accent, 0.22), boxShadow: `inset 0 0 0 1px ${alpha(t.accent, 0.35)}` };
  return { boxShadow: `inset 0 0 0 1px ${alpha(t.accent, 0.8)}` };
}

export const ButtonMock = ({ look, style }: { look: Look; style: ButtonStyle }) => (
  <div className='flex h-full items-center justify-center' style={{ background: look.surface }}>
    <div
      className='h-5 w-16'
      style={{ borderRadius: Math.max(2, (look.controlRadius ?? 10) / 1.6), ...buttonFill(look, style) }}
    />
  </div>
);

export const FontMock = ({ look, font }: { look: Look; font: Font }) => (
  <div
    className='flex h-full items-center justify-center text-2xl'
    style={{
      background: look.surface,
      color: look.text,
      fontFamily: FONT_STACKS[font] ?? 'Helvetica, Arial, sans-serif',
      fontWeight: 600,
    }}
  >
    Aa
  </div>
);

/** Plays the transition on hover; the keyframes are app.css's. */
export const TransitionMock = ({ look, transition }: { look: Look; transition: Transition }) => (
  <div className='flex h-full items-center justify-center' style={{ background: look.surface }}>
    <div
      className={`h-7 w-14 rounded-md zoron-tile-anim-${transition}`}
      style={{ background: alpha(look.text, 0.12), border: `1px solid ${alpha(look.text, 0.18)}` }}
    />
  </div>
);

/** Core's dark terminal: no background of its own (the card shows through), xterm's default (Tango) colours. */
const PANEL_TERMINAL = {
  foreground: '#f8f8f2',
  dim: '#555753',
  green: '#4e9a06',
  yellow: '#c4a000',
  red: '#cc0000',
  blue: '#3465a4',
};

/** The colours the drawings use from a scheme; core's own for 'panel'. */
const terminalInk = (palette: TerminalPalette | null) =>
  palette
    ? {
        foreground: palette.foreground,
        dim: palette.ansi[8],
        green: palette.ansi[2],
        yellow: palette.ansi[3],
        red: palette.ansi[1],
        blue: palette.ansi[4],
      }
    : PANEL_TERMINAL;

/** One log line's run of text; `glow` is the crt frame's. */
const inkBar = (color: string, width: string, glow = false) => (
  <div
    className='h-1 rounded-sm'
    style={{ width, background: color, boxShadow: glow ? `0 0 3px ${color}` : undefined }}
  />
);

/** A few log lines in a terminal scheme: a timestamped line, a success, a warning, an error and the prompt. */
export function TerminalMock({ look, palette }: { look: Look; palette: TerminalPalette | null }) {
  const c = terminalInk(palette);
  return (
    <div
      className='flex h-full flex-col justify-center gap-1 px-2'
      style={{ background: palette?.background ?? look.surface }}
    >
      <div className='flex gap-1'>
        {inkBar(c.dim, '22%')}
        {inkBar(c.foreground, '50%')}
      </div>
      <div className='flex gap-1'>
        {inkBar(c.green, '30%')}
        {inkBar(c.foreground, '28%')}
      </div>
      <div className='flex gap-1'>{inkBar(c.yellow, '62%')}</div>
      <div className='flex gap-1'>
        {inkBar(c.red, '40%')}
        {inkBar(c.foreground, '22%')}
      </div>
      <div className='flex items-center gap-1'>
        <div className='h-1 w-1.5 rounded-sm' style={{ background: c.blue }} />
        <div className='h-1.5 w-1 rounded-[1px]' style={{ background: c.foreground }} />
      </div>
    </div>
  );
}

/**
 * A terminal frame (`terminalSkin`) on the page's canvas around three log lines in `palette`, as app.css draws it:
 * card, window (title bar), flush (no card; 'theme' and 'panel' on the canvas), glass, crt (scanlines, vignette,
 * glow) and neon (accent outline and glow).
 */
export function TerminalSkinMock({
  look,
  palette,
  scheme,
  skin,
}: {
  look: Look;
  palette: TerminalPalette | null;
  scheme: TerminalScheme;
  skin: TerminalSkin;
}) {
  const c = terminalInk(palette);
  const radius = Math.max(3, (look.radius ?? 16) / 3);
  const bg = palette?.background ?? look.surface;
  const block: CSSProperties = {
    inset: '16% 12%',
    borderRadius: radius,
    border: `1px solid ${alpha(look.text, 0.14)}`,
    background: bg,
  };
  if (skin === 'flush') {
    Object.assign(block, {
      border: '1px solid transparent',
      borderRadius: 0,
      background: scheme === 'theme' || !palette ? 'transparent' : bg,
    });
  } else if (skin === 'glass') {
    Object.assign(block, {
      border: `1px solid ${alpha(c.foreground, 0.16)}`,
      background: alpha(bg, 0.72),
      backdropFilter: 'blur(3px)',
    });
  } else if (skin === 'crt') {
    Object.assign(block, { borderRadius: radius * 2 + 2, boxShadow: `0 0 0 2px ${alpha('#000000', 0.45)}` });
  } else if (skin === 'neon') {
    Object.assign(block, { border: `1px solid ${look.accent}`, boxShadow: `0 0 8px ${alpha(look.accent, 0.55)}` });
  }
  const glow = skin === 'crt';
  return frame(
    look,
    'spotlight',
    <div className='absolute flex flex-col overflow-hidden' style={block}>
      {skin === 'window' && (
        <div
          className='flex h-[26%] shrink-0 items-center gap-[2px] px-1'
          style={{ borderBottom: `1px solid ${alpha(c.foreground, 0.14)}` }}
        >
          {[0, 1, 2].map((dot) => (
            <span key={dot} className='size-[3px] rounded-full' style={{ background: alpha(c.foreground, 0.35) }} />
          ))}
        </div>
      )}
      <div className='flex flex-1 flex-col justify-center gap-1 px-1.5'>
        <div className='flex gap-1'>
          {inkBar(c.dim, '22%', glow)}
          {inkBar(c.foreground, '46%', glow)}
        </div>
        <div className='flex gap-1'>
          {inkBar(c.green, '30%', glow)}
          {inkBar(c.foreground, '26%', glow)}
        </div>
        <div className='flex gap-1'>{inkBar(c.red, '40%', glow)}</div>
      </div>
      {glow && (
        <div
          className='pointer-events-none absolute inset-0'
          style={{
            background: `repeating-linear-gradient(to bottom, ${alpha('#000000', 0.22)} 0 1px, transparent 1px 3px)`,
            boxShadow: `inset 0 0 10px ${alpha('#000000', 0.5)}`,
          }}
        />
      )}
    </div>,
  );
}

/** A made up minute of load for the graph drawings, drawn with the console's own path builders. */
const GRAPH_SAMPLE = [3, 4, 4, 6, 5, 7, 9, 8, 6, 7, 10, 12, 11, 9, 8, 10, 13, 15, 14, 12, 11, 13, 16, 15];

/**
 * One of the command bar's figures in a graph style (`consoleGraphs`), on the scheme's background: a label over a
 * value, and beside it the line over a faint fill, the line, thin columns, or nothing.
 */
export function ConsoleGraphMock({
  look,
  palette,
  graph,
}: {
  look: Look;
  palette: TerminalPalette | null;
  graph: ConsoleGraph;
}) {
  const c = terminalInk(palette);
  const size = GRAPH_SAMPLE.length;
  const path = sparkPath(GRAPH_SAMPLE, 60, 20, 0, size);
  return (
    <div
      className='flex h-full items-center gap-1.5 px-2.5'
      style={{ background: palette?.background ?? look.surface }}
    >
      <div className='flex shrink-0 flex-col gap-1'>
        <div className='h-1 w-3.5 rounded-sm' style={{ background: c.dim }} />
        <div className='h-1.5 w-6 rounded-sm' style={{ background: c.foreground }} />
      </div>
      {graph !== 'none' && (
        <svg viewBox='0 0 60 20' preserveAspectRatio='none' className='h-5 min-w-0 flex-1' aria-hidden='true'>
          {graph === 'bars' ? (
            <path d={sparkBars(GRAPH_SAMPLE, 60, 20, 0, size, 12)} fill={alpha(look.accent, 0.75)} />
          ) : (
            <>
              {graph === 'area' && <path d={path.area} fill={alpha(look.accent, 0.16)} />}
              <path
                d={path.line}
                fill='none'
                stroke={look.accent}
                strokeWidth={1.25}
                strokeLinecap='round'
                strokeLinejoin='round'
                vectorEffect='non-scaling-stroke'
              />
            </>
          )}
        </svg>
      )}
    </div>
  );
}

/**
 * The console workspace's layout (`consoleInspector`) on the page's canvas: the command bar along the top, the
 * terminal's lines, and the inspector's column on the right, on the left, or none.
 */
export function ConsoleInspectorMock({
  look,
  palette,
  side,
}: {
  look: Look;
  palette: TerminalPalette | null;
  side: ConsoleInspector;
}) {
  const c = terminalInk(palette);
  const line = alpha(c.foreground, 0.14);
  const step = alpha(c.foreground, 0.06);
  const column = (
    <div
      className='flex w-[30%] shrink-0 flex-col gap-1 p-1'
      style={{
        background: step,
        borderLeft: side === 'left' ? undefined : `1px solid ${line}`,
        borderRight: side === 'left' ? `1px solid ${line}` : undefined,
        order: side === 'left' ? -1 : 0,
      }}
    >
      <div className='h-1 w-3/4 rounded-sm' style={{ background: alpha(c.foreground, 0.4) }} />
      <div className='h-1 w-1/2 rounded-sm' style={{ background: alpha(c.foreground, 0.2) }} />
    </div>
  );
  return frame(
    look,
    'spotlight',
    <div
      className='absolute flex flex-col overflow-hidden'
      style={{
        inset: '14% 10%',
        borderRadius: Math.max(3, (look.radius ?? 16) / 3),
        border: `1px solid ${alpha(look.text, 0.14)}`,
        background: palette?.background ?? look.surface,
      }}
    >
      <div className='flex h-[22%] shrink-0 items-center gap-1 px-1.5' style={{ background: step }}>
        <div className='h-1 w-4 rounded-sm' style={{ background: alpha(c.foreground, 0.55) }} />
        <div className='h-1 w-2 rounded-sm' style={{ background: c.green }} />
      </div>
      <div className='flex min-h-0 flex-1' style={{ borderTop: `1px solid ${line}` }}>
        <div className='flex min-w-0 flex-1 flex-col justify-center gap-1 px-1.5'>
          {inkBar(c.foreground, '70%')}
          {inkBar(c.green, '45%')}
          {inkBar(c.dim, '60%')}
        </div>
        {side !== 'off' && column}
      </div>
    </div>,
  );
}

/** A whole preset at a glance: backdrop, sidebar, a card and a button. */
export function PresetMock({ look }: { look: PresetLook }) {
  const fill =
    look.surfaceStyle === 'solid' ? look.surface : alpha(look.surface, look.surfaceStyle === 'glass' ? 0.7 : 0.35);
  const edge = alpha(look.text, 0.08 + (look.borderStrength / 100) * 0.14);
  const docked = look.sidebar === 'docked';
  return frame(
    look,
    look.backdrop,
    <>
      <div
        className='absolute flex flex-col gap-1 p-1.5'
        style={{
          left: docked ? 0 : 6,
          top: docked ? 0 : 6,
          bottom: docked ? 0 : 6,
          width: '28%',
          borderRadius: docked ? 0 : look.radius / 2,
          background: fill,
          border: `1px solid ${edge}`,
        }}
      >
        <div className='h-2 rounded-sm' style={navActive(look, look.navStyle)} />
        <div className='h-1.5 w-3/4 rounded-sm' style={{ background: alpha(look.text, 0.18) }} />
        <div className='h-1.5 w-2/3 rounded-sm' style={{ background: alpha(look.text, 0.18) }} />
      </div>
      <div
        className='absolute flex flex-col justify-between p-2'
        style={{
          left: '36%',
          right: 8,
          top: 10,
          bottom: 10,
          borderRadius: look.radius / 2,
          background: fill,
          border: `1px solid ${edge}`,
        }}
      >
        <div className='h-1.5 w-1/2 rounded-sm' style={{ background: alpha(look.text, 0.55) }} />
        <div className='h-1.5 w-3/4 rounded-sm' style={{ background: alpha(look.text, 0.18) }} />
        <div
          className='h-3.5 w-12 self-end'
          style={{ borderRadius: look.controlRadius / 2, ...buttonFill(look, look.buttonStyle) }}
        />
      </div>
    </>,
  );
}

/** How tall each overview block draws, relative to the others. */
const BLOCK_HEIGHT: Record<OverviewSection, number> = { usage: 1, activity: 3, connect: 2, glance: 1.5 };

/**
 * The overview's layout (`overviewLayout`) with the blocks the draft lists, in its order, laid out by the overview's
 * own rules (overviewRows): the header's line, then the usage strip (a faint accent) and the cards.
 */
export function OverviewLayoutMock({
  look,
  layout,
  blocks,
}: {
  look: Look;
  layout: OverviewLayout;
  blocks: readonly OverviewSection[];
}) {
  const radius = Math.max(2, (look.radius ?? 16) / 5);
  return frame(
    look,
    'spotlight',
    <div className='absolute inset-1.5 flex flex-col gap-[3px]'>
      <div className='h-1.5 w-1/3 shrink-0 rounded-sm' style={{ background: alpha(look.text, 0.45) }} />
      {overviewRows(blocks, layout).map((row) => (
        <div
          key={row.columns.flat().join()}
          className='flex min-h-0 gap-[3px]'
          style={{
            flex: `${Math.max(...row.columns.map((column) => column.reduce((sum, b) => sum + BLOCK_HEIGHT[b], 0)))} 1 0`,
          }}
        >
          {row.columns.map((column) => (
            <div
              key={column.join()}
              className='flex min-w-0 flex-col gap-[3px]'
              style={{ flex: `${row.kind === 'even' || !column.includes('activity') ? 2 : 3} 1 0` }}
            >
              {column.map((block) => (
                <div
                  key={block}
                  style={{
                    flex: `${BLOCK_HEIGHT[block]} 1 0`,
                    borderRadius: radius,
                    background: block === 'usage' ? alpha(look.accent, 0.22) : alpha(look.surface, 0.85),
                    border: `1px solid ${alpha(look.text, 0.12)}`,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>,
  );
}

/** A made up minute for the usage drawing's two figures. */
const USAGE_SAMPLES = [
  [4, 6, 5, 8, 7, 9, 12, 10, 9, 13, 15, 12],
  [10, 10, 11, 11, 12, 12, 12, 13, 13, 13, 14, 14],
];

/**
 * Two figures of the usage strip (`overviewUsage`) on one card split by a hairline: a label and a value over a bar
 * against the limit, a sparkline drawn by the console's builders, or the value alone and larger.
 */
export function OverviewUsageMock({ look, usage }: { look: Look; usage: OverviewUsage }) {
  const edge = alpha(look.text, 0.12);
  return (
    <div className='flex h-full' style={{ background: look.surface }}>
      {USAGE_SAMPLES.map((samples, i) => {
        const path = sparkPath(samples, 60, 20, 20, samples.length);
        return (
          <div
            key={samples.join()}
            className='flex min-w-0 flex-1 flex-col justify-center gap-1 px-2'
            style={{ borderLeft: i > 0 ? `1px solid ${edge}` : undefined }}
          >
            <div className='h-1 w-4 rounded-sm' style={{ background: alpha(look.text, 0.3) }} />
            <div
              className={`${usage === 'numbers' ? 'h-2.5 w-9' : 'h-1.5 w-7'} rounded-sm`}
              style={{ background: alpha(look.text, 0.8) }}
            />
            {usage === 'bars' && (
              <div className='h-1 overflow-hidden rounded-full' style={{ background: alpha(look.text, 0.1) }}>
                <div className='h-full rounded-full' style={{ width: `${45 + i * 20}%`, background: look.accent }} />
              </div>
            )}
            {usage === 'graphs' && (
              <svg viewBox='0 0 60 20' preserveAspectRatio='none' className='h-3 w-full' aria-hidden='true'>
                <path d={path.area} fill={alpha(look.accent, 0.16)} />
                <path
                  d={path.line}
                  fill='none'
                  stroke={look.accent}
                  strokeWidth={1.25}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  vectorEffect='non-scaling-stroke'
                />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}

const SAMPLE_TILE = serverTile('Survival');

/**
 * The overview's head (`overviewHeader`): the server's tile, name, a status chip and the buttons on the page, or
 * the same with a larger tile in a band tinted with the accent.
 */
export function OverviewHeaderMock({ look, header }: { look: Look; header: OverviewHeader }) {
  const banner = header === 'banner';
  return frame(
    look,
    'spotlight',
    <div
      className='absolute flex items-center gap-1.5 px-1.5'
      style={{
        inset: '22% 6%',
        borderRadius: Math.max(3, (look.radius ?? 16) / 3),
        background: banner ? mix(look.surface, look.accent, 0.12) : undefined,
        border: banner ? `1px solid ${alpha(look.accent, 0.3)}` : undefined,
      }}
    >
      <div
        className={`${banner ? 'size-4' : 'size-3'} shrink-0 rounded-[4px]`}
        style={{ background: SAMPLE_TILE.background }}
      />
      <div className='flex min-w-0 flex-1 flex-col gap-1'>
        <div className='flex items-center gap-1'>
          <div className='h-1.5 w-8 rounded-sm' style={{ background: alpha(look.text, 0.75) }} />
          <div className='h-1.5 w-3 rounded-full' style={{ background: alpha('#22c55e', 0.5) }} />
        </div>
        <div className='h-1 w-10 rounded-sm' style={{ background: alpha(look.text, 0.25) }} />
      </div>
      <div className='h-2.5 w-4 shrink-0 rounded-[3px]' style={{ background: alpha(look.text, 0.18) }} />
      <div className='h-2.5 w-4 shrink-0 rounded-[3px]' style={{ background: look.accent }} />
    </div>,
  );
}
