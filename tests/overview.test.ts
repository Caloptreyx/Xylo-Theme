import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  eventLabel,
  levelOf,
  newest,
  overviewRows,
  percentOf,
  timeAgo,
} from '../frontend/src/elements/server/overview.ts';

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

  test("the split layout is today's page: usage across, activity beside the connect and glance cards", () => {
    assert.deepEqual(overviewRows(['usage', 'activity', 'connect', 'glance'], 'split'), [
      { kind: 'single', columns: [['usage']] },
      { kind: 'mainSide', columns: [['activity'], ['connect', 'glance']] },
    ]);
  });

  test('the split layout follows the order: side first puts the stack on the left, usage splits the rows', () => {
    assert.deepEqual(overviewRows(['connect', 'activity', 'usage', 'glance'], 'split'), [
      { kind: 'sideMain', columns: [['connect'], ['activity']] },
      { kind: 'single', columns: [['usage']] },
      { kind: 'single', columns: [['glance']] },
    ]);
    assert.deepEqual(overviewRows(['connect', 'glance'], 'split'), [
      { kind: 'single', columns: [['connect', 'glance']] },
    ]);
    assert.deepEqual(overviewRows([], 'split'), []);
  });

  test('the stacked layout is one block a row', () => {
    assert.deepEqual(overviewRows(['glance', 'usage'], 'stacked'), [
      { kind: 'single', columns: [['glance']] },
      { kind: 'single', columns: [['usage']] },
    ]);
  });

  test('the wide layout gives usage and activity rows and pairs neighbouring side cards', () => {
    assert.deepEqual(overviewRows(['usage', 'activity', 'connect', 'glance'], 'wide'), [
      { kind: 'single', columns: [['usage']] },
      { kind: 'single', columns: [['activity']] },
      { kind: 'even', columns: [['connect'], ['glance']] },
    ]);
    assert.deepEqual(overviewRows(['connect', 'activity', 'glance'], 'wide'), [
      { kind: 'single', columns: [['connect']] },
      { kind: 'single', columns: [['activity']] },
      { kind: 'single', columns: [['glance']] },
    ]);
  });
});
