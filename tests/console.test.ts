import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  bufferText,
  commandOf,
  logFileName,
  MAX_COMMAND,
  MAX_COMMANDS,
  parseCommands,
  withCommand,
} from '../frontend/src/elements/console/console.ts';

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
});
