/**
 * The console's live telemetry: the last minute of each figure the server's websocket reports, and the sparklines
 * drawn from it. Pure, so the tests can run it without the panel.
 */

/** How many samples a sparkline holds: about a minute of the websocket's stats, which come once a second. */
export const SAMPLES = 60;

/** `values` with `value` added at the end and the oldest dropped past `size`; anything not a finite, positive number counts as 0. */
export function pushSample(values: readonly number[], value: number, size = SAMPLES): number[] {
  const next = values.length >= size ? values.slice(values.length - size + 1) : values.slice();
  next.push(Number.isFinite(value) && value > 0 ? value : 0);
  return next;
}

/** A reading of the server's stats, as much of core's `serverResourceUsage` as the telemetry uses. */
export interface StatsReading {
  state: string;
  cpuAbsolute: number;
  memoryBytes: number;
  diskBytes: number;
  uptime: number;
  network: { rxBytes: number; txBytes: number };
}

/** The network's running totals at one reading, and when it came (milliseconds, any monotonic clock). */
export interface Counters {
  rx: number;
  tx: number;
  uptime: number;
  at: number;
}

/**
 * Bytes per second received and sent between two readings of the running totals; null without an earlier reading,
 * when no time passed, or when a total or the uptime went back (the server restarted, so the totals did too).
 */
export function ratesOf(previous: Counters | null, next: Counters): { rx: number; tx: number } | null {
  if (!previous) return null;
  const seconds = (next.at - previous.at) / 1000;
  if (!(seconds > 0) || next.uptime < previous.uptime || next.rx < previous.rx || next.tx < previous.tx) return null;
  return { rx: (next.rx - previous.rx) / seconds, tx: (next.tx - previous.tx) / seconds };
}

/** Each figure's recent samples, oldest first, and the network totals the next rates start from. */
export interface Telemetry {
  cpu: number[];
  memory: number[];
  disk: number[];
  rx: number[];
  tx: number[];
  counters: Counters | null;
}

export const EMPTY_TELEMETRY: Telemetry = { cpu: [], memory: [], disk: [], rx: [], tx: [], counters: null };

/**
 * The telemetry after one stats update that came at `at`. An offline server has no load and no traffic, so its
 * curves start over (the disk keeps its own: it is still there); without a reading nothing changes.
 */
export function withReading(history: Telemetry, stats: StatsReading | null, at: number): Telemetry {
  if (!stats) return history;
  const disk = pushSample(history.disk, stats.diskBytes);
  if (stats.state === 'offline') return { ...EMPTY_TELEMETRY, disk };
  const counters = { rx: stats.network.rxBytes, tx: stats.network.txBytes, uptime: stats.uptime, at };
  const rates = ratesOf(history.counters, counters);
  return {
    cpu: pushSample(history.cpu, stats.cpuAbsolute),
    memory: pushSample(history.memory, stats.memoryBytes),
    disk,
    rx: pushSample(history.rx, rates?.rx ?? 0),
    tx: pushSample(history.tx, rates?.tx ?? 0),
    counters,
  };
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * A sparkline as SVG path data in a `width` by `height` box: the line, and the area under it closed along the
 * bottom. The newest sample sits at the right edge and each older one a slot (`width / (size - 1)`) to its left, so
 * a short history fills in from the right as the samples come. The scale runs from 0 at the bottom to `max`, raised
 * to the largest sample so nothing clips, with a pixel kept free at the top and bottom for the stroke. One sample is
 * drawn as a slot wide step; none, as empty paths.
 */
export function sparkPath(
  values: readonly number[],
  width: number,
  height: number,
  max = 0,
  size = SAMPLES,
): { line: string; area: string } {
  if (values.length === 0 || size < 2) return { line: '', area: '' };
  const samples = values.slice(-size).map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  if (samples.length === 1) samples.unshift(samples[0]);
  const top = Math.max(max, ...samples);
  const step = width / (size - 1);
  const start = width - step * (samples.length - 1);
  const points = samples.map((value, i) => {
    const x = round(start + step * i);
    const y = round(top > 0 ? 1 + (1 - value / top) * (height - 2) : height - 1);
    return `${x} ${y}`;
  });
  const line = `M${points.join('L')}`;
  return { line, area: `${line}L${round(width)} ${height}L${round(start)} ${height}Z` };
}

/** How many columns the bar sparkline draws: each the highest of its share of the samples (three seconds). */
export const BARS = 20;

/**
 * A sparkline as thin columns, SVG path data in a `width` by `height` box: the samples grouped from the newest back
 * (`size / bars` to a column), each column the highest of its group, as wide as half its slot and centred in it, so
 * a short history fills in from the right as sparkPath's does. Same scale as sparkPath; a column of nothing keeps a
 * one unit stub, so an idle server still shows its row. None, as an empty path.
 */
export function sparkBars(
  values: readonly number[],
  width: number,
  height: number,
  max = 0,
  size = SAMPLES,
  bars = BARS,
): string {
  if (values.length === 0 || bars < 1) return '';
  const samples = values.slice(-size).map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  const group = Math.max(1, Math.floor(size / bars));
  const columns: number[] = [];
  for (let end = samples.length; end > 0 && columns.length < bars; end -= group) {
    columns.unshift(Math.max(...samples.slice(Math.max(0, end - group), end)));
  }
  const top = Math.max(max, ...columns);
  const slot = width / bars;
  return columns
    .map((value, i) => {
      const x = round(width - slot * (columns.length - i) + slot / 4);
      const y = round(top > 0 ? Math.min(height - 1, 1 + (1 - value / top) * (height - 2)) : height - 1);
      return `M${x} ${y}H${round(x + slot / 2)}V${height}H${x}Z`;
    })
    .join('');
}
