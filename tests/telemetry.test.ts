import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  EMPTY_TELEMETRY,
  pushSample,
  ratesOf,
  SAMPLES,
  type StatsReading,
  sparkBars,
  sparkPath,
  withReading,
} from '../frontend/src/elements/console/telemetry.ts';

const reading = (over: Partial<StatsReading> = {}): StatsReading => ({
  state: 'running',
  cpuAbsolute: 12.5,
  memoryBytes: 1024,
  diskBytes: 4096,
  uptime: 10_000,
  network: { rxBytes: 1000, txBytes: 500 },
  ...over,
});

describe('console telemetry', () => {
  test('the history keeps the newest samples, never more than its size', () => {
    assert.deepEqual(pushSample([], 3), [3]);
    assert.deepEqual(pushSample([1, 2, 3], 4, 3), [2, 3, 4]);
    // a list already over the size (a smaller size than it was kept at) is cut down too
    assert.deepEqual(pushSample([1, 2, 3, 4, 5], 6, 3), [4, 5, 6]);
    const full = Array.from({ length: SAMPLES }, (_, i) => i);
    const next = pushSample(full, 99);
    assert.equal(next.length, SAMPLES);
    assert.equal(next.at(-1), 99);
    assert.equal(next[0], 1);
    // the list it was given is left alone
    assert.equal(full.length, SAMPLES);
    assert.equal(full.at(-1), SAMPLES - 1);
  });

  test('a sample that is not a positive number counts as nothing', () => {
    assert.deepEqual(pushSample([], Number.NaN), [0]);
    assert.deepEqual(pushSample([], -4), [0]);
    assert.deepEqual(pushSample([], Number.POSITIVE_INFINITY), [0]);
  });

  test('network rates need an earlier reading and totals that only grow', () => {
    const before = { rx: 1000, tx: 500, uptime: 10_000, at: 0 };
    assert.equal(ratesOf(null, before), null);
    assert.deepEqual(ratesOf(before, { rx: 3000, tx: 1500, uptime: 12_000, at: 2000 }), { rx: 1000, tx: 500 });
    assert.equal(ratesOf(before, { ...before }), null, 'no time passed');
    assert.equal(ratesOf(before, { rx: 10, tx: 10, uptime: 500, at: 1000 }), null, 'restarted');
    assert.equal(ratesOf(before, { rx: 900, tx: 600, uptime: 11_000, at: 1000 }), null, 'a total went back');
  });

  test('readings fill every curve; going offline starts them over but keeps the disk', () => {
    let history = withReading(EMPTY_TELEMETRY, reading(), 0);
    assert.deepEqual(history.cpu, [12.5]);
    assert.deepEqual(history.rx, [0], 'no rate from the first reading');
    history = withReading(history, reading({ uptime: 11_000, network: { rxBytes: 3000, txBytes: 1500 } }), 1000);
    assert.deepEqual(history.rx, [0, 2000]);
    assert.deepEqual(history.tx, [0, 1000]);
    assert.equal(withReading(history, null, 2000), history);
    const offline = withReading(history, reading({ state: 'offline', diskBytes: 8192 }), 2000);
    assert.deepEqual(offline.cpu, []);
    assert.deepEqual(offline.rx, []);
    assert.equal(offline.counters, null);
    assert.deepEqual(offline.disk, [4096, 4096, 8192]);
  });

  test('a sparkline puts the newest sample at the right edge and scales to the larger of max and the samples', () => {
    assert.deepEqual(sparkPath([], 60, 20), { line: '', area: '' });
    // 3 slots across 10 wide: 5 apart; max 10 maps 0 to the bottom pixel row and 10 to the top one
    assert.deepEqual(sparkPath([0, 5, 10], 10, 12, 10, 3), {
      line: 'M0 11L5 6L10 1',
      area: 'M0 11L5 6L10 1L10 12L0 12Z',
    });
    // a short history starts part way across
    assert.equal(sparkPath([10, 10], 10, 12, 0, 3).line, 'M5 1L10 1');
    // a sample over max raises the scale instead of clipping
    assert.equal(sparkPath([20, 10], 10, 12, 10, 3).line, 'M5 1L10 6');
  });

  test('a sparkline of one sample, of nothing but zeros, or of bad values stays drawable', () => {
    assert.equal(sparkPath([4], 10, 12, 0, 3).line, 'M5 1L10 1');
    assert.equal(sparkPath([0, 0, 0], 10, 12, 0, 3).line, 'M0 11L5 11L10 11');
    assert.equal(sparkPath([Number.NaN, -1, 2], 10, 12, 0, 3).line, 'M0 11L5 11L10 1');
    // more samples than slots: only the newest are drawn
    assert.equal(sparkPath([9, 9, 0, 0, 0], 10, 12, 0, 3).line, 'M0 11L5 11L10 11');
  });

  test('bars: half slot wide columns from the right, each the highest of its group, a stub for nothing', () => {
    assert.equal(sparkBars([], 60, 20), '');
    // 3 slots across 12 wide: columns 2 wide in the middle of each 4 wide slot; same scale as the line
    assert.equal(sparkBars([0, 5, 10], 12, 12, 10, 3, 3), 'M1 11H3V12H1ZM5 6H7V12H5ZM9 1H11V12H9Z');
    // a short history fills in from the right
    assert.equal(sparkBars([10], 12, 12, 0, 3, 3), 'M9 1H11V12H9Z');
    // six samples in three columns: pairs from the newest back, each column its pair's highest
    assert.equal(sparkBars([1, 4, 2, 2, 0, 8], 12, 12, 8, 6, 3), 'M1 6H3V12H1ZM5 8.5H7V12H5ZM9 1H11V12H9Z');
    // nothing at all still draws a row of stubs, and bad values count as nothing
    assert.equal(sparkBars([0, Number.NaN, -1], 12, 12, 0, 3, 3), 'M1 11H3V12H1ZM5 11H7V12H5ZM9 11H11V12H9Z');
  });
});
