import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  type HomeServer,
  type HomeUsage,
  phaseOf,
  statusCounts,
  summarize,
  visibleServers,
} from '../frontend/src/elements/home/home.ts';

const MIB = 1024 * 1024;
const server = (uuid: string, extra: Partial<HomeServer> = {}): HomeServer => ({
  uuid,
  name: uuid,
  status: null,
  isSuspended: false,
  isTransferring: false,
  limits: { cpu: 100, memory: 1024, disk: 2048 },
  allocation: { ip: '10.0.0.1', ipAlias: null, port: 25565 },
  egg: { name: 'Paper' },
  ...extra,
});
const live = (state: HomeUsage['state'], cpu = 0, memory = 0, disk = 0): HomeUsage => ({
  state,
  cpuAbsolute: cpu,
  memoryBytes: memory,
  diskBytes: disk,
});

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

  test('totals sum the running servers for CPU and memory and every server for disk; no limit stays unlimited', () => {
    const servers = [
      server('a', { limits: { cpu: 100, memory: 1024, disk: 2048 } }),
      server('b', { limits: { cpu: 50, memory: 512, disk: 1024 } }),
      server('c', { limits: { cpu: 200, memory: 2048, disk: 0 } }),
    ];
    const usage = {
      a: live('running', 40, 300 * MIB, 100 * MIB),
      b: live('offline', 0, 0, 50 * MIB),
      c: live('stopping', 5, 10 * MIB, 10 * MIB),
    };
    const totals = summarize(servers, usage);
    assert.equal(totals.online, 1);
    assert.equal(totals.total, 3);
    assert.deepEqual(totals.cpu, { used: 40, limit: 100 });
    assert.deepEqual(totals.memory, { used: 300 * MIB, limit: 1024 * MIB });
    // c has no disk limit, so the sum has none
    assert.deepEqual(totals.disk, { used: 160 * MIB, limit: null });
    // a running server with no CPU limit makes the CPU total unlimited
    const unlimited = summarize([server('d', { limits: { cpu: 0, memory: 0, disk: 10 } })], { d: live('running', 7) });
    assert.equal(unlimited.cpu.limit, null);
    assert.equal(unlimited.memory.limit, null);
  });
});
