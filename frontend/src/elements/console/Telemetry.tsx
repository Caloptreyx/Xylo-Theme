import { type ReactNode, useEffect, useState } from 'react';
import { bytesToString, mbToBytes, useServerStore, useServerStoreApi } from '../../lib/core.ts';
import type { ConsoleGraph, ConsoleMetric } from '../../lib/theme.ts';
import { useExtTranslations } from '../../translations.ts';
import { EMPTY_TELEMETRY, SAMPLES, sparkBars, sparkPath, withReading } from './telemetry.ts';

/** The sparklines' drawing box; CSS sizes them, the stroke keeps its width (`non-scaling-stroke`). */
const SPARK_WIDTH = 60;
const SPARK_HEIGHT = 20;

/** Network rates below this many bytes a second draw near the floor, so an idle server's chatter stays flat. */
export const NETWORK_FLOOR = 1024;

/** The flat line and the row of stubs a stopped server's figures show. */
const IDLE = new Array<number>(SAMPLES).fill(0);
const FLAT = sparkPath(IDLE, SPARK_WIDTH, SPARK_HEIGHT).line;
const FLAT_BARS = sparkBars(IDLE, SPARK_WIDTH, SPARK_HEIGHT);

/**
 * The last minute of the server's stats (telemetry.ts), from core's server store: every update the websocket brings
 * adds a sample. Mount it keyed by the server, so another server starts its own.
 */
export function useTelemetry() {
  const store = useServerStoreApi();
  const [history, setHistory] = useState(() => withReading(EMPTY_TELEMETRY, store.getState().stats, performance.now()));
  useEffect(
    () =>
      store.subscribe((state, previous) => {
        if (state.stats === previous.stats) return;
        setHistory((current) => withReading(current, state.stats, performance.now()));
      }),
    [store],
  );
  return history;
}

/**
 * One figure: a dimmed label over its value, and its sparkline in the theme's style ('none' leaves it out); the
 * title holds the limit or the total.
 */
function Meter({
  label,
  value,
  title,
  samples,
  max,
  live,
  graph,
}: {
  label: string;
  value: string;
  title: string;
  samples: number[];
  max: number;
  live: boolean;
  graph: ConsoleGraph;
}) {
  let spark: ReactNode = null;
  if (graph === 'bars') {
    spark = (
      <path className='xylo-con-spark-bars' d={live ? sparkBars(samples, SPARK_WIDTH, SPARK_HEIGHT, max) : FLAT_BARS} />
    );
  } else if (graph !== 'none') {
    const path = live ? sparkPath(samples, SPARK_WIDTH, SPARK_HEIGHT, max) : { line: FLAT, area: '' };
    spark = (
      <>
        {graph === 'area' && path.area && <path className='xylo-con-spark-area' d={path.area} />}
        <path className='xylo-con-spark-line' d={path.line} vectorEffect='non-scaling-stroke' />
      </>
    );
  }
  return (
    <div className='xylo-con-meter' title={title} data-live={live || undefined}>
      <span className='xylo-con-meter-label'>{label}</span>
      <span className='xylo-con-meter-value'>{value}</span>
      {spark && (
        <svg
          className='xylo-con-spark'
          viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
          preserveAspectRatio='none'
          aria-hidden='true'
        >
          {spark}
        </svg>
      )}
    </div>
  );
}

/**
 * The command bar's live figures, those of `metrics` (the theme's, in CONSOLE_METRICS order): CPU, memory, disk,
 * and the network's traffic each way as a rate, each with a sparkline of its last minute in the `graph` style
 * against the server's limit where it has one. A stopped server's figures read zero (the disk excepted) over a flat,
 * muted line.
 */
export function Telemetry({
  live,
  metrics,
  graph,
}: {
  live: boolean;
  metrics: readonly ConsoleMetric[];
  graph: ConsoleGraph;
}) {
  const { t } = useExtTranslations();
  const server = useServerStore((state) => state.server);
  const stats = useServerStore((state) => state.stats);
  const history = useTelemetry();

  const bytes = (value: number) => bytesToString(value, 1, true);
  const titled = (label: string, value: string, limit: string | null) =>
    limit === null ? t('console.noLimit', { label, value }) : t('console.ofLimit', { label, value, limit });

  const cpuLimit = server.limits.cpu > 0 ? server.limits.cpu : null;
  const memoryLimit = server.limits.memory > 0 ? mbToBytes(server.limits.memory) : null;
  const diskLimit = server.limits.disk > 0 ? mbToBytes(server.limits.disk) : null;
  const cpu = `${(live ? (stats?.cpuAbsolute ?? 0) : 0).toFixed(1)}%`;
  const memory = bytes(live ? (stats?.memoryBytes ?? 0) : 0);
  const disk = bytes(stats?.diskBytes ?? 0);
  const rx = t('console.rate', { amount: bytes(live ? (history.rx.at(-1) ?? 0) : 0) });
  const tx = t('console.rate', { amount: bytes(live ? (history.tx.at(-1) ?? 0) : 0) });

  const meters: Record<ConsoleMetric, { label: string; value: string; title: string; samples: number[]; max: number }> =
    {
      cpu: {
        label: t('overview.cpu', {}),
        value: cpu,
        title: titled(t('overview.cpu', {}), cpu, cpuLimit === null ? null : `${cpuLimit}%`),
        samples: history.cpu,
        max: cpuLimit ?? 100,
      },
      memory: {
        label: t('overview.memory', {}),
        value: memory,
        title: titled(t('overview.memory', {}), memory, memoryLimit === null ? null : bytes(memoryLimit)),
        samples: history.memory,
        max: memoryLimit ?? 0,
      },
      disk: {
        label: t('overview.disk', {}),
        value: disk,
        title: titled(t('overview.disk', {}), disk, diskLimit === null ? null : bytes(diskLimit)),
        samples: history.disk,
        max: diskLimit ?? 0,
      },
      netIn: {
        label: t('console.netIn', {}),
        value: rx,
        title: t('console.received', {
          label: t('console.netIn', {}),
          value: rx,
          total: bytes(stats?.network.rxBytes ?? 0),
        }),
        samples: history.rx,
        max: NETWORK_FLOOR,
      },
      netOut: {
        label: t('console.netOut', {}),
        value: tx,
        title: t('console.sent', {
          label: t('console.netOut', {}),
          value: tx,
          total: bytes(stats?.network.txBytes ?? 0),
        }),
        samples: history.tx,
        max: NETWORK_FLOOR,
      },
    };

  return (
    <div className='xylo-con-meters' data-graph={graph}>
      {metrics.map((metric) => (
        <Meter key={metric} {...meters[metric]} live={live} graph={graph} />
      ))}
    </div>
  );
}
