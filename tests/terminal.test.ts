import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  highlightChunk,
  highlightLine,
  lineLevel,
  parseTerminalPrefs,
  withTerminalPrefs,
} from '../frontend/src/lib/terminal.ts';
import { DEFAULT_THEME } from '../frontend/src/lib/theme.ts';

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const END = '\x1b[39m';

describe('lineLevel', () => {
  test('reads the usual log formats', () => {
    assert.equal(lineLevel('[12:00:00 ERROR]: Could not load plugin'), 'error');
    assert.equal(lineLevel('[12:00:00] [Server thread/WARN]: Can\'t keep up!'), 'warn');
    assert.equal(lineLevel('2026-10-07 WARNING low disk'), 'warn');
    assert.equal(lineLevel('java.lang.NullPointerException: null'), 'error');
    assert.equal(lineLevel('\tat net.minecraft.server.Main.main(Main.java:42)'), 'error');
    assert.equal(lineLevel('Traceback (most recent call last):'), 'error');
    assert.equal(lineLevel('[12:00:00 INFO]: Done (3.2s)!'), null);
  });

  test('lower case words in chat and names are not levels', () => {
    assert.equal(lineLevel('<Steve> no error here, just warnings'), null);
    assert.equal(lineLevel('Player ErrorHunter joined'), null);
    assert.equal(lineLevel('TerrorWARNs'), null);
  });

  test('escape sequences do not hide or fake a level', () => {
    assert.equal(lineLevel('\x1b[1mERROR\x1b[0m: failed'), 'error');
    assert.equal(lineLevel('\x1b[1;31mx'), null);
  });
});

describe('highlightLine', () => {
  test('tints plain errors red and warnings yellow, ending on the default colour', () => {
    assert.equal(highlightLine('[ERROR] boom'), `${RED}[ERROR] boom${END}`);
    assert.equal(highlightLine('[WARN] hm'), `${YELLOW}[WARN] hm${END}`);
  });

  test('leaves lines with colour of their own and lines without a level alone', () => {
    for (const line of ['\x1b[33m[WARN] x\x1b[0m', '\x1b[38;5;196mERROR', '\x1b[1;91mERROR', '\x1b[44mERROR', 'ok']) {
      assert.equal(highlightLine(line), line);
    }
  });

  test('the tint survives a reset inside the line; bold alone is not colour', () => {
    assert.equal(highlightLine('\x1b[1mERROR\x1b[0m: x'), `${RED}\x1b[1mERROR\x1b[0m${RED}: x${END}`);
    assert.equal(highlightLine('a\x1b[m ERROR'), `${RED}a\x1b[m${RED} ERROR${END}`);
  });

  test('a chunk is tinted line by line, newlines kept', () => {
    assert.equal(highlightChunk('\n[ERROR] a'), `\n${RED}[ERROR] a${END}`);
    assert.equal(highlightChunk('ok\n[WARN] b'), `ok\n${YELLOW}[WARN] b${END}`);
  });
});

describe('parseTerminalPrefs', () => {
  test('keeps allow listed choices', () => {
    assert.deepEqual(parseTerminalPrefs('{"scheme":"amber","skin":"crt"}'), { scheme: 'amber', skin: 'crt' });
    assert.deepEqual(parseTerminalPrefs('{"skin":"window"}'), { skin: 'window' });
  });

  test('drops unknown names, other types, broken JSON and nothing stored', () => {
    assert.deepEqual(parseTerminalPrefs('{"scheme":"matrix","skin":"<b>","extra":1}'), {});
    assert.deepEqual(parseTerminalPrefs('{"scheme":["nord"],"skin":3}'), {});
    for (const raw of ['["nord"]', '"nord"', 'null', '{oops', '', null]) {
      assert.deepEqual(parseTerminalPrefs(raw), {}, String(raw));
    }
  });
});

describe('withTerminalPrefs', () => {
  test('lays the choices over the site scheme and frame', () => {
    const shown = withTerminalPrefs(DEFAULT_THEME, { scheme: 'nord' });
    assert.equal(shown.terminalScheme, 'nord');
    assert.equal(shown.terminalSkin, DEFAULT_THEME.terminalSkin);
    assert.equal(withTerminalPrefs(DEFAULT_THEME, { skin: 'neon' }).terminalSkin, 'neon');
    assert.equal(shown.accent, DEFAULT_THEME.accent);
  });

  test('the site theme as it is with no choices, or when it does not let people choose', () => {
    assert.equal(withTerminalPrefs(DEFAULT_THEME, {}), DEFAULT_THEME);
    const locked = { ...DEFAULT_THEME, terminalUserChoice: false };
    assert.equal(withTerminalPrefs(locked, { scheme: 'amber', skin: 'crt' }), locked);
  });
});
