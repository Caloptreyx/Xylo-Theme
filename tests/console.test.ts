import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  barLayout,
  bufferText,
  commandOf,
  logFileName,
  MAX_COMMAND,
  MAX_COMMANDS,
  parseCommands,
  placeBarItem,
  placed,
  shownBarItems,
  toggleBar,
  withCommand,
} from '../frontend/src/elements/console/console.ts';
import type { ConsoleBarItem } from '../frontend/src/lib/theme.ts';

describe('console page', () => {
  test('a command is one trimmed line within the limit', () => {
    assert.equal(commandOf('  say hi  '), 'say hi');
    assert.equal(commandOf('   '), null);
    assert.equal(commandOf('stop\nop me'), null);
    assert.equal(commandOf('x'.repeat(MAX_COMMAND)), 'x'.repeat(MAX_COMMAND));
    assert.equal(commandOf('x'.repeat(MAX_COMMAND + 1)), null);
    assert.equal(commandOf(42), null);
  });

  test('saved commands survive anything storage holds', () => {
    assert.deepEqual(parseCommands(null), []);
    assert.deepEqual(parseCommands('{not json'), []);
    assert.deepEqual(parseCommands('{"0":"list"}'), []);
    assert.deepEqual(parseCommands(JSON.stringify(['list', 3, ' list ', '', 'a\u0007b', 'save-all'])), [
      'list',
      'save-all',
    ]);
    const many = Array.from({ length: MAX_COMMANDS + 5 }, (_, i) => `cmd ${i}`);
    assert.equal(parseCommands(JSON.stringify(many)).length, MAX_COMMANDS);
  });

  test('adding refuses repeats and a full list', () => {
    assert.deepEqual(withCommand(['list'], ' save-all '), ['list', 'save-all']);
    assert.equal(withCommand(['list'], 'list'), null);
    assert.equal(withCommand(['list'], ''), null);
    const full = Array.from({ length: MAX_COMMANDS }, (_, i) => `cmd ${i}`);
    assert.equal(withCommand(full, 'one more'), null);
  });

  test('the log is named after the server, safe for any file system', () => {
    const at = new Date(2026, 9, 7, 9, 5);
    assert.equal(logFileName('My Server', at), 'My-Server-2026-10-07-0905.log');
    assert.equal(logFileName('a/b:c*?', at), 'a-b-c-2026-10-07-0905.log');
    assert.equal(logFileName('..hidden', at), 'hidden-2026-10-07-0905.log');
    assert.equal(logFileName(' <> ', at), 'console-2026-10-07-0905.log');
  });

  test('wrapped rows rejoin their line and trailing blanks go', () => {
    const lines = [
      { text: 'first', wrapped: false },
      { text: 'long line ', wrapped: false },
      { text: 'continued', wrapped: true },
      { text: '', wrapped: false },
      { text: '   ', wrapped: false },
    ];
    assert.equal(bufferText(lines), 'first\nlong line continued\n');
    assert.equal(bufferText([{ text: ' ', wrapped: false }]), '');
    assert.equal(bufferText([{ text: 'orphan', wrapped: true }]), 'orphan\n');
  });

  test('the default bar is the grid the page always had', () => {
    assert.deepEqual(barLayout(['identity', 'metrics', 'power'], true), {
      wide: {
        areas: '"id meters power toggle"',
        columns: 'minmax(0, auto) minmax(0, 1fr) auto auto',
      },
      narrow: { areas: '"id power toggle" "meters meters meters"', columns: 'minmax(0, 1fr) auto auto' },
      phone: { areas: '"id toggle" "power power" "meters meters"', columns: 'minmax(0, 1fr) auto' },
    });
  });

  test('a reordered bar keeps its order, the figures under the rest when narrow', () => {
    const layout = barLayout(['power', 'metrics', 'identity'], true);
    assert.equal(layout.wide.areas, '"power meters id toggle"');
    assert.equal(layout.wide.columns, 'auto minmax(0, 1fr) minmax(0, auto) auto');
    assert.equal(layout.narrow.areas, '"power id toggle" "meters meters meters"');
    assert.equal(layout.narrow.columns, 'auto minmax(0, 1fr) auto');
    assert.equal(layout.phone.areas, '"power power" "id toggle" "meters meters"');
  });

  test('without figures identity takes the room, without either an empty column does', () => {
    const plain = barLayout(['identity', 'power'], true);
    assert.deepEqual(plain.wide, { areas: '"id power toggle"', columns: 'minmax(0, 1fr) auto auto' });
    assert.deepEqual(plain.narrow, plain.wide);
    assert.equal(plain.phone.areas, '"id toggle" "power power"');
    const powerOnly = barLayout(['power'], true);
    assert.deepEqual(powerOnly.wide, { areas: '". power toggle"', columns: 'minmax(0, 1fr) auto auto' });
    assert.deepEqual(barLayout([], true).wide, { areas: '". toggle"', columns: 'minmax(0, 1fr) auto' });
  });

  test('without the toggle power ends the row and phones need one column', () => {
    const layout = barLayout(['identity', 'metrics', 'power'], false);
    assert.deepEqual(layout.wide, { areas: '"id meters power"', columns: 'minmax(0, auto) minmax(0, 1fr) auto' });
    assert.deepEqual(layout.narrow, { areas: '"id power" "meters meters"', columns: 'minmax(0, 1fr) auto' });
    assert.deepEqual(layout.phone, { areas: '"id" "power" "meters"', columns: 'minmax(0, 1fr)' });
  });

  test('with identity elsewhere the toggle gets a row of its own on phones', () => {
    const layout = barLayout(['metrics', 'power'], true);
    assert.equal(layout.wide.areas, '"meters power toggle"');
    assert.equal(layout.wide.columns, 'minmax(0, 1fr) auto auto');
    assert.equal(layout.narrow.areas, '". power toggle" "meters meters meters"');
    assert.equal(layout.phone.areas, '"power power" ". toggle" "meters meters"');
  });

  test('a footer of figures alone is one row at every size', () => {
    const layout = barLayout(['metrics'], false);
    assert.deepEqual(layout.wide, { areas: '"meters"', columns: 'minmax(0, 1fr)' });
    assert.deepEqual(layout.narrow, layout.wide);
    assert.deepEqual(layout.phone, layout.wide);
    assert.deepEqual(barLayout([], false).wide, { areas: 'none', columns: 'none' });
  });

  test("the window frame's dots lead the first row, the other rows stretch under them", () => {
    const layout = barLayout(['identity', 'metrics', 'power'], true, true);
    assert.deepEqual(layout.wide, {
      areas: '"dots id meters power toggle"',
      columns: 'auto minmax(0, auto) minmax(0, 1fr) auto auto',
    });
    assert.equal(layout.narrow.areas, '"dots id power toggle" "meters meters meters meters"');
    assert.equal(layout.phone.areas, '"dots id toggle" "power power power" "meters meters meters"');
    assert.equal(layout.phone.columns, 'auto minmax(0, 1fr) auto');
  });

  test('a piece moves between the bars and is only ever in one', () => {
    const start = { consoleBar: ['identity', 'metrics', 'power'] as ConsoleBarItem[], consoleFooter: [] };
    assert.deepEqual(placeBarItem(start, 'metrics', 'footer', 0), {
      consoleBar: ['identity', 'power'],
      consoleFooter: ['metrics'],
    });
    assert.deepEqual(placeBarItem(start, 'identity', 'bar', 2), {
      consoleBar: ['metrics', 'power', 'identity'],
      consoleFooter: [],
    });
    assert.deepEqual(placeBarItem(start, 'power', null), { consoleBar: ['identity', 'metrics'], consoleFooter: [] });
    assert.deepEqual(placed(['a', 'b', 'c'], 'a', 9), ['b', 'c', 'a']);
    assert.deepEqual(placed(['a', 'b'], 'c', -1), ['c', 'a', 'b']);
  });

  test('the toggle ends the top bar unless only the bottom one has pieces', () => {
    assert.equal(toggleBar(['identity'], ['power'], true), 'top');
    assert.equal(toggleBar([], ['power'], true), 'bottom');
    assert.equal(toggleBar([], [], true), 'top');
    assert.equal(toggleBar(['identity'], [], false), null);
    assert.deepEqual(shownBarItems(['identity', 'metrics', 'power'], []), ['identity', 'power']);
    assert.deepEqual(shownBarItems(['metrics'], ['cpu']), ['metrics']);
  });
});
