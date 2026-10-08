import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  dropGrid,
  eventLabel,
  levelOf,
  newest,
  nudgeItem,
  percentOf,
  snapCell,
  snapSize,
  timeAgo,
  visibleGrid,
} from '../frontend/src/elements/server/overview.ts';
import type { OverviewItem } from '../frontend/src/lib/theme.ts';

/** The default grid: usage across, activity two rows tall beside the connect and glance cards. */
const GRID: OverviewItem[] = [
  { block: 'usage', x: 0, y: 0, w: 12, h: 1 },
  { block: 'activity', x: 0, y: 1, w: 7, h: 2 },
  { block: 'connect', x: 7, y: 1, w: 5, h: 1 },
  { block: 'glance', x: 7, y: 2, w: 5, h: 1 },
];
const ALL = { usage: true, activity: true, connect: true, glance: true };

describe('server overview', () => {
  test('activity events read as short labels', () => {
    assert.equal(eventLabel('server:power.start'), 'Power start');
    assert.equal(eventLabel('server:file.write'), 'File write');
    assert.equal(eventLabel('server:backup.restore_started'), 'Backup restore started');
    assert.equal(eventLabel('plain'), 'Plain');
    assert.equal(eventLabel('server:'), 'server:');
  });

  test('times read in their largest whole unit, either way', () => {
    const now = new Date('2026-10-07T12:00:00Z');
    const at = (seconds: number) => new Date(now.getTime() + seconds * 1000);
    assert.equal(timeAgo(at(-20), now, 'en'), '20 seconds ago');
    assert.equal(timeAgo(at(-3 * 60 - 30), now, 'en'), '3 minutes ago');
    assert.equal(timeAgo(at(-86_400), now, 'en'), 'yesterday');
    assert.equal(timeAgo(at(-9 * 86_400), now, 'en'), 'last week');
    assert.equal(timeAgo(at(2 * 3_600), now, 'en'), 'in 2 hours');
  });

  test('usage needs a limit to be a share, and turns amber at 80% and red at 95%', () => {
    assert.equal(percentOf(50, 0), null);
    assert.equal(percentOf(50, null), null);
    assert.equal(percentOf(150, 100), 100);
    assert.equal(levelOf(percentOf(79, 100)), undefined);
    assert.equal(levelOf(percentOf(80, 100)), 'warn');
    assert.equal(levelOf(percentOf(95, 100)), 'danger');
    assert.equal(levelOf(null), undefined);
  });

  test('the newest item skips those without the date', () => {
    const items = [
      { name: 'a', at: new Date('2026-01-01') },
      { name: 'b', at: null },
      { name: 'c', at: new Date('2026-03-01') },
    ];
    assert.equal(newest(items, (item) => item.at)?.name, 'c');
    assert.equal(newest([{ at: null }], (item) => item.at), null);
  });

  test('a visitor sees the grid as is, or settled and widened over the blocks they may not see', () => {
    assert.deepEqual(visibleGrid(GRID, ALL), GRID);
    assert.deepEqual(visibleGrid(GRID, { ...ALL, activity: false }), [
      { block: 'usage', x: 0, y: 0, w: 12, h: 1 },
      { block: 'connect', x: 0, y: 1, w: 12, h: 1 },
      { block: 'glance', x: 0, y: 2, w: 12, h: 1 },
    ]);
    assert.deepEqual(visibleGrid(GRID, { ...ALL, glance: false }), GRID.slice(0, 3));
    assert.deepEqual(visibleGrid(GRID, { usage: false, activity: false, connect: false, glance: false }), []);
  });

  test('a dragged block snaps to the nearest cell, inside the columns and no lower than the bottom', () => {
    assert.deepEqual(snapCell(130, 50, 25, 44, 5, 3), { x: 5, y: 1 });
    assert.deepEqual(snapCell(-40, 400, 25, 44, 5, 3), { x: 0, y: 3 });
    assert.deepEqual(snapCell(1000, -10, 25, 44, 5, 3), { x: 7, y: 0 });
  });

  test('a dragged corner resizes in whole columns and rows, within the grid and the size limits', () => {
    assert.deepEqual(snapSize(GRID[1], 60, 50, 25, 44), { w: 9, h: 3 });
    assert.deepEqual(snapSize(GRID[1], -200, -200, 25, 44), { w: 3, h: 1 });
    assert.deepEqual(snapSize(GRID[2], 300, 300, 25, 44), { w: 5, h: 4 });
  });

  test('a drop moves a block, hides it, adds a hidden one at its size, or changes nothing', () => {
    assert.deepEqual(dropGrid(GRID, 'usage', null), GRID);
    assert.deepEqual(dropGrid(GRID, 'usage', 'hide'), [
      { block: 'activity', x: 0, y: 0, w: 7, h: 2 },
      { block: 'connect', x: 7, y: 0, w: 5, h: 1 },
      { block: 'glance', x: 7, y: 1, w: 5, h: 1 },
    ]);
    assert.deepEqual(dropGrid(GRID, 'usage', { x: 0, y: 3 }), [
      { block: 'activity', x: 0, y: 0, w: 7, h: 2 },
      { block: 'connect', x: 7, y: 0, w: 5, h: 1 },
      { block: 'glance', x: 7, y: 1, w: 5, h: 1 },
      { block: 'usage', x: 0, y: 2, w: 12, h: 1 },
    ]);
    // from the hidden blocks: 5 columns wide, so a drop at column 9 lands at column 7
    assert.deepEqual(dropGrid(GRID.slice(0, 3), 'glance', { x: 9, y: 2 }), GRID);
    assert.deepEqual(dropGrid(GRID.slice(0, 3), 'glance', { x: 0, y: 3 }), [
      ...GRID.slice(0, 3),
      { block: 'glance', x: 0, y: 3, w: 5, h: 1 },
    ]);
  });

  test('keyboard steps move or resize by one, and a step past an edge changes nothing', () => {
    assert.deepEqual(nudgeItem(GRID, 'usage', 0, 1, false), [
      { block: 'connect', x: 7, y: 0, w: 5, h: 1 },
      { block: 'usage', x: 0, y: 1, w: 12, h: 1 },
      { block: 'activity', x: 0, y: 2, w: 7, h: 2 },
      { block: 'glance', x: 7, y: 2, w: 5, h: 1 },
    ]);
    assert.deepEqual(nudgeItem(GRID, 'activity', -1, 0, true), [
      GRID[0],
      { block: 'activity', x: 0, y: 1, w: 6, h: 2 },
      GRID[2],
      GRID[3],
    ]);
    assert.deepEqual(nudgeItem(GRID, 'connect', 1, 0, false), GRID);
    assert.deepEqual(nudgeItem(GRID, 'usage', 0, -1, true), GRID);
    assert.deepEqual(nudgeItem(GRID, 'connect', 1, 0, true), GRID);
  });
});
