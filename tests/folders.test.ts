import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  dropAction,
  dropPart,
  looseServers,
  orderGroupServers,
  parseOpenFolders,
} from '../frontend/src/elements/shell/folders.ts';

const server = (uuid: string) => ({ uuid, name: uuid });
const group = (uuid: string, serverOrder: string[]) => ({ uuid, name: uuid, order: 0, serverOrder });

describe('rail folders', () => {
  test('a folder lists its servers in the group order and drops servers the group no longer has', () => {
    const fetched = [server('a'), server('b'), server('c')];
    assert.deepEqual(
      orderGroupServers(fetched, ['c', 'a']).map((s) => s.uuid),
      ['c', 'a'],
    );
  });

  test('loose servers leave out every grouped one, then cap', () => {
    const servers = ['a', 'b', 'c', 'd', 'e'].map(server);
    const groups = [group('g1', ['a']), group('g2', ['c', 'x'])];
    assert.deepEqual(
      looseServers(servers, groups, 2).map((s) => s.uuid),
      ['b', 'd'],
    );
    assert.deepEqual(
      looseServers(servers, [], 10).map((s) => s.uuid),
      ['a', 'b', 'c', 'd', 'e'],
    );
  });

  test('a malformed open state reads as no folder open', () => {
    assert.deepEqual(parseOpenFolders('["a",2,"b"]'), ['a', 'b']);
    for (const raw of [null, '', '{', '{"a":1}', '"a"']) assert.deepEqual(parseOpenFolders(raw), []);
  });

  test('drops act as on Discord and refuse what core would', () => {
    const groups = [group('g1', ['a']), group('full', Array.from({ length: 100 }, (_, i) => `s${i}`))];
    const loose = { kind: 'server', serverUuid: 'b', from: null } as const;
    const inG1 = { kind: 'server', serverUuid: 'a', from: 'g1' } as const;
    // onto a loose server: a new folder of the two, the target first; out of a folder, the old one loses it
    assert.deepEqual(dropAction(loose, { kind: 'server', serverUuid: 'c' }, 'onto', groups), {
      kind: 'create',
      serverOrder: ['c', 'b'],
      serverUuid: 'b',
      from: null,
    });
    assert.equal(dropAction(loose, { kind: 'server', serverUuid: 'b' }, 'onto', groups), null);
    assert.equal(dropAction(inG1, { kind: 'server', serverUuid: 'c' }, 'onto', groups)?.kind, 'create');
    // onto a folder: to its end, unless it is already there, the folder is full or gone
    assert.deepEqual(dropAction(loose, { kind: 'folder', groupUuid: 'g1' }, 'onto', groups), {
      kind: 'move',
      serverUuid: 'b',
      from: null,
      to: 'g1',
      serverOrder: ['a', 'b'],
    });
    assert.equal(dropAction(inG1, { kind: 'folder', groupUuid: 'g1' }, 'onto', groups), null);
    const aLoose = { kind: 'server', serverUuid: 'a', from: null } as const;
    assert.equal(dropAction(aLoose, { kind: 'folder', groupUuid: 'g1' }, 'onto', groups), null);
    assert.equal(dropAction(loose, { kind: 'folder', groupUuid: 'full' }, 'onto', groups), null);
    assert.equal(dropAction(loose, { kind: 'folder', groupUuid: 'gone' }, 'onto', groups), null);
    // onto free space: out of its folder; a loose server stays put
    assert.equal(dropAction(inG1, { kind: 'loose' }, 'onto', groups)?.kind, 'move');
    assert.equal(dropAction(loose, { kind: 'loose' }, 'onto', groups), null);
  });

  test('servers in a folder and the folders themselves take a place by the half dropped on', () => {
    const groups = [group('g1', ['a', 'b', 'c']), group('g2', ['x']), group('g3', [])];
    const c = { kind: 'server', serverUuid: 'c', from: 'g1' } as const;
    const member = (serverUuid: string) => ({ kind: 'member', groupUuid: 'g1', serverUuid }) as const;
    assert.equal(dropPart(c, member('a'), 0.2), 'before');
    assert.equal(dropPart(c, member('a'), 0.8), 'after');
    assert.equal(dropPart(c, { kind: 'folder', groupUuid: 'g2' }, 0.2), 'onto');
    // reorder within the folder; a drop that leaves it where it is does nothing
    assert.deepEqual(dropAction(c, member('a'), 'before', groups), {
      kind: 'move',
      serverUuid: 'c',
      from: 'g1',
      to: 'g1',
      serverOrder: ['c', 'a', 'b'],
    });
    assert.equal(dropAction(c, member('b'), 'after', groups), null);
    // from another folder, it lands at that place
    const x = { kind: 'server', serverUuid: 'x', from: 'g2' } as const;
    assert.deepEqual(dropAction(x, member('b'), 'after', groups), {
      kind: 'move',
      serverUuid: 'x',
      from: 'g2',
      to: 'g1',
      serverOrder: ['a', 'b', 'x', 'c'],
    });
    // folders reorder among themselves only, by halves
    const g3 = { kind: 'folder', groupUuid: 'g3' } as const;
    assert.equal(dropPart(g3, { kind: 'folder', groupUuid: 'g1' }, 0.3), 'before');
    assert.deepEqual(dropAction(g3, { kind: 'folder', groupUuid: 'g1' }, 'before', groups), {
      kind: 'groups',
      order: ['g3', 'g1', 'g2'],
    });
    assert.equal(dropAction(g3, { kind: 'folder', groupUuid: 'g2' }, 'after', groups), null);
    assert.equal(dropAction(g3, member('a'), 'before', groups), null);
  });
});
