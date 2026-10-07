import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  cleanTileName,
  initialsOf,
  MAX_TILE_SERVERS,
  normalizeTiles,
  serverTile,
  TILE_ICONS,
  TILE_NAME_MAX,
  TILE_SWATCHES,
  withTile,
} from '../frontend/src/lib/tiles.ts';

const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const A = uuid(1);
const B = uuid(2);

describe('server tiles', () => {
  test('anything that is not a map reads as no customization', () => {
    for (const raw of [undefined, null, 'x', 42, true, [], [{ name: 'a' }]]) {
      assert.deepEqual(normalizeTiles(raw), {});
    }
  });

  test('keys must be server uuids, lowercased, the first spelling winning', () => {
    const mixed = 'abcdef00-0000-4000-8000-00000000000a';
    assert.deepEqual(
      normalizeTiles({
        'not-a-uuid': { name: 'x' },
        __proto__: { name: 'x' },
        constructor: { name: 'x' },
        [mixed.toUpperCase()]: { name: 'Upper' },
        [mixed]: { name: 'Lower' },
      }),
      { [mixed]: { name: 'Upper' } },
    );
  });

  test('names are one line, trimmed, free of control characters, 1 to 32 characters', () => {
    assert.equal(cleanTileName('  Survival \n\t world  '), 'Survival world');
    assert.equal(cleanTileName('a\u0000b\u0007c\u202eevil\u2066'), 'abcevil');
    assert.equal(cleanTileName('x'.repeat(40)), 'x'.repeat(TILE_NAME_MAX));
    // counted by code point: an emoji is one character, never cut in half
    assert.equal([...cleanTileName('🐉'.repeat(40))].length, TILE_NAME_MAX);
    assert.equal(cleanTileName(`${'a'.repeat(31)} b`), 'a'.repeat(31));
    assert.deepEqual(normalizeTiles({ [A]: { name: '   ' } }), {});
    assert.deepEqual(normalizeTiles({ [A]: { name: '\u0000\u0001' } }), {});
    assert.deepEqual(normalizeTiles({ [A]: { name: 7, color: '#AABBCC' } }), { [A]: { color: '#aabbcc' } });
  });

  test('colours must be #rrggbb, icons from the list; unknown fields go', () => {
    assert.deepEqual(
      normalizeTiles({
        [A]: { color: 'red', icon: 'dragon', extra: 1, style: 'x' },
        [B]: { color: '#abc', icon: 'not-an-icon' },
        [uuid(3)]: { color: 'url(x)#aabbcc' },
        [uuid(4)]: { icon: 'initials', name: 'Hub' },
      }),
      { [A]: { icon: 'dragon' }, [uuid(4)]: { name: 'Hub' } },
    );
  });

  test('at most MAX_TILE_SERVERS servers are kept', () => {
    const raw = Object.fromEntries(Array.from({ length: 320 }, (_, i) => [uuid(i), { icon: 'cube' }]));
    const tiles = normalizeTiles(raw);
    assert.equal(Object.keys(tiles).length, MAX_TILE_SERVERS);
    assert.ok(uuid(0) in tiles);
    assert.ok(!(uuid(MAX_TILE_SERVERS) in tiles));
  });

  test('withTile replaces, removes, and drops the oldest edit when full', () => {
    const one = withTile({}, A, { name: ' Lobby ', icon: 'crown' });
    assert.deepEqual(one, { [A]: { name: 'Lobby', icon: 'crown' } });
    assert.deepEqual(withTile(one, A, { name: '', color: 'nope' }), {});
    assert.deepEqual(withTile(one, A, null), {});
    assert.deepEqual(withTile(one, 'bad', { name: 'x' }), one);
    // the edited server moves last
    assert.deepEqual(Object.keys(withTile({ [A]: { icon: 'cube' }, [B]: { icon: 'gem' } }, A, { icon: 'fire' })), [B, A]);
    const full = Object.fromEntries(Array.from({ length: MAX_TILE_SERVERS }, (_, i) => [uuid(i), { icon: 'cube' }]));
    const next = withTile(full, uuid(999), { icon: 'gem' });
    assert.equal(Object.keys(next).length, MAX_TILE_SERVERS);
    assert.ok(!(uuid(0) in next));
    assert.deepEqual(next[uuid(999)], { icon: 'gem' });
  });

  test("a tile shows the user's name, icon and colour, the default from the real name otherwise", () => {
    const plain = serverTile('Survival World');
    assert.equal(plain.label, 'Survival World');
    assert.equal(plain.custom, false);
    assert.equal(plain.initials, 'SW');
    assert.equal(plain.icon, null);
    const custom = serverTile('Survival World', { name: 'Creative hub', icon: 'cube', color: '#336699' });
    assert.equal(custom.label, 'Creative hub');
    assert.equal(custom.custom, true);
    assert.equal(custom.initials, 'CH');
    assert.equal(custom.icon, 'cube');
    assert.match(custom.background, /^linear-gradient\(135deg,#336699,#[0-9a-f]{6}\)$/);
    // a new name alone keeps the colour, which comes from the real name
    assert.equal(serverTile('Survival World', { name: 'Other' }).background, plain.background);
  });

  test('initials keep a leading emoji whole; the lists are sane', () => {
    assert.equal(initialsOf('🐉 dragons'), '🐉D');
    assert.equal(initialsOf(''), '?');
    assert.equal(new Set(TILE_ICONS).size, TILE_ICONS.length);
    assert.ok(TILE_SWATCHES.every((swatch) => /^#[0-9a-f]{6}$/.test(swatch)));
  });
});
