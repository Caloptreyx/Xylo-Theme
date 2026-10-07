import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  type HomeServer,
  type HomeUsage,
  phaseOf,
  statusCounts,
  visibleServers,
} from '../frontend/src/elements/home/home.ts';

const server = (uuid: string, extra: Partial<HomeServer> = {}): HomeServer => ({
  uuid,
  name: uuid,
  status: null,
  isSuspended: false,
  isTransferring: false,
  allocation: { ip: '10.0.0.1', ipAlias: null, port: 25565 },
  egg: { name: 'Paper' },
  ...extra,
});
const live = (state: HomeUsage['state']): HomeUsage => ({ state });

describe('servers page', () => {
  test("what blocks a server outranks its power state, and no usage reads as offline", () => {
    assert.equal(phaseOf(server('a', { isSuspended: true, status: 'installing' }), live('running')), 'suspended');
    assert.equal(phaseOf(server('a', { status: 'install_failed' }), live('running')), 'failed');
    assert.equal(phaseOf(server('a', { status: 'installing' }), live('offline')), 'installing');
    assert.equal(phaseOf(server('a', { isTransferring: true }), live('running')), 'transferring');
    assert.equal(phaseOf(server('a'), live('starting')), 'starting');
    assert.equal(phaseOf(server('a'), undefined), 'offline');
  });

  test('search, status and sort narrow and order the grid; counts follow the search', () => {
    const servers = [
      server('zeta', { egg: { name: 'Rust' } }),
      server('alpha'),
      server('beta', { allocation: { ip: '10.0.0.9', ipAlias: 'play.example.com', port: 30000 } }),
      server('gamma', { isSuspended: true }),
    ];
    const usage = { zeta: live('running'), alpha: live('offline'), beta: live('starting') };
    const names = (list: HomeServer[]) => list.map((s) => s.name);

    assert.deepEqual(names(visibleServers(servers, usage, { query: 'rust', status: 'all', sort: 'default' })), ['zeta']);
    assert.deepEqual(
      names(visibleServers(servers, usage, { query: 'play.example', status: 'all', sort: 'default' })),
      ['beta'],
    );
    assert.deepEqual(names(visibleServers(servers, usage, { query: '', status: 'online', sort: 'name' })), [
      'beta',
      'zeta',
    ]);
    assert.deepEqual(names(visibleServers(servers, usage, { query: '', status: 'attention', sort: 'default' })), [
      'gamma',
    ]);
    // status sort: live first, suspended before stopped, ties keep the user's order
    assert.deepEqual(names(visibleServers(servers, usage, { query: '', status: 'all', sort: 'status' })), [
      'zeta',
      'beta',
      'gamma',
      'alpha',
    ]);
    assert.deepEqual(statusCounts(servers, usage, ''), { all: 4, online: 2, offline: 1, attention: 1 });
    assert.deepEqual(statusCounts(servers, usage, 'a'), { all: 4, online: 2, offline: 1, attention: 1 });
    assert.deepEqual(statusCounts(servers, usage, 'zz'), { all: 0, online: 0, offline: 0, attention: 0 });
  });

  test("the user's own names match the search and order the name sort, the real ones still match", () => {
    const servers = [server('zeta'), server('alpha'), server('beta')];
    const custom = { zeta: { name: 'Aardvark' }, beta: {} };
    const real = (list: HomeServer[]) => list.map((s) => s.name);
    const opts = { status: 'all', sort: 'name' } as const;
    assert.deepEqual(real(visibleServers(servers, {}, { ...opts, query: 'aard' }, custom)), ['zeta']);
    assert.deepEqual(real(visibleServers(servers, {}, { ...opts, query: 'zeta' }, custom)), ['zeta']);
    // sorted by the shown names: Aardvark (zeta), alpha, beta
    assert.deepEqual(real(visibleServers(servers, {}, { ...opts, query: '' }, custom)), ['zeta', 'alpha', 'beta']);
    assert.equal(statusCounts(servers, {}, 'aard', custom).all, 1);
  });
});
