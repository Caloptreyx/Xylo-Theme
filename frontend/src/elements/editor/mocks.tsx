import type { CSSProperties, ReactNode } from 'react';
import { alpha, mix } from '../../lib/color.ts';
import {
  type Backdrop,
  type ButtonStyle,
  FONT_STACKS,
  type Font,
  type NavStyle,
  type Pattern,
  type PresetLook,
  type Sidebar,
  type Surface,
  type TerminalPalette,
  type Transition,
} from '../../lib/theme.ts';

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
      className={`h-7 w-14 rounded-md xylo-tile-anim-${transition}`}
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

/** A few log lines in a terminal scheme: a timestamped line, a success, a warning, an error and the prompt. */
export function TerminalMock({ look, palette }: { look: Look; palette: TerminalPalette | null }) {
  const c = palette
    ? {
        foreground: palette.foreground,
        dim: palette.ansi[8],
        green: palette.ansi[2],
        yellow: palette.ansi[3],
        red: palette.ansi[1],
        blue: palette.ansi[4],
      }
    : PANEL_TERMINAL;
  const bar = (color: string, width: string) => <div className='h-1 rounded-sm' style={{ width, background: color }} />;
  return (
    <div
      className='flex h-full flex-col justify-center gap-1 px-2'
      style={{ background: palette?.background ?? look.surface }}
    >
      <div className='flex gap-1'>
        {bar(c.dim, '22%')}
        {bar(c.foreground, '50%')}
      </div>
      <div className='flex gap-1'>
        {bar(c.green, '30%')}
        {bar(c.foreground, '28%')}
      </div>
      <div className='flex gap-1'>{bar(c.yellow, '62%')}</div>
      <div className='flex gap-1'>
        {bar(c.red, '40%')}
        {bar(c.foreground, '22%')}
      </div>
      <div className='flex items-center gap-1'>
        <div className='h-1 w-1.5 rounded-sm' style={{ background: c.blue }} />
        <div className='h-1.5 w-1 rounded-[1px]' style={{ background: c.foreground }} />
      </div>
    </div>
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
