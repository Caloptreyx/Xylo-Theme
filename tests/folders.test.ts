import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { dropAction, looseServers, orderGroupServers, parseOpenFolders } from '../frontend/src/elements/shell/folders.ts';

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
    const loose = { serverUuid: 'b', from: null };
    const inG1 = { serverUuid: 'a', from: 'g1' };
    // onto a loose server: a new folder of the two, the target first
    assert.deepEqual(dropAction(loose, { kind: 'server', serverUuid: 'c' }, groups), {
      kind: 'create',
      serverOrder: ['c', 'b'],
      from: null,
    });
    assert.equal(dropAction(loose, { kind: 'server', serverUuid: 'b' }, groups), null);
    // out of a folder onto a loose server: the new folder takes it from the old one
    assert.deepEqual(dropAction(inG1, { kind: 'server', serverUuid: 'c' }, groups), {
      kind: 'create',
      serverOrder: ['c', 'a'],
      from: 'g1',
    });
    // onto a folder: moved in, unless it is already there, the folder is full or gone
    assert.deepEqual(dropAction(loose, { kind: 'folder', groupUuid: 'g1' }, groups), {
      kind: 'move',
      from: null,
      to: 'g1',
    });
    assert.equal(dropAction(inG1, { kind: 'folder', groupUuid: 'g1' }, groups), null);
    assert.equal(dropAction({ serverUuid: 'a', from: null }, { kind: 'folder', groupUuid: 'g1' }, groups), null);
    assert.equal(dropAction(loose, { kind: 'folder', groupUuid: 'full' }, groups), null);
    assert.equal(dropAction(loose, { kind: 'folder', groupUuid: 'gone' }, groups), null);
    // onto free space: out of its folder; a loose server stays put
    assert.deepEqual(dropAction(inG1, { kind: 'loose' }, groups), { kind: 'move', from: 'g1', to: null });
    assert.equal(dropAction(loose, { kind: 'loose' }, groups), null);
  });
});
