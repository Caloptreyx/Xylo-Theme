import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { looseServers, orderGroupServers, parseOpenFolders } from '../frontend/src/elements/shell/folders.ts';

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
});
