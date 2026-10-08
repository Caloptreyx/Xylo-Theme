import { HOME_LAYOUTS, type HomeLayout } from '../../lib/theme.ts';

/**
 * The servers page's rules: a server's phase, the filters, the sorts, the layout a visitor sees and the sections by
 * group. Pure, so the tests can run it without the panel.
 */

/** The fields of core's servers these rules read. */
export type HomeServer = {
  uuid: string;
  name: string;
  status: string | null;
  isSuspended: boolean;
  isTransferring: boolean;
  allocation: { ip: string; ipAlias: string | null; port: number } | null;
  egg: { name: string };
};
/** The field of core's live resource usage these rules read. */
export type HomeUsage = { state: 'offline' | 'starting' | 'stopping' | 'running' };

/** What a server is doing: its power state, or what keeps it from having one. */
export type Phase =
  | 'running'
  | 'starting'
  | 'stopping'
  | 'offline'
  | 'installing'
  | 'restoring'
  | 'transferring'
  | 'failed'
  | 'suspended';

export function phaseOf(server: HomeServer, usage: HomeUsage | undefined): Phase {
  if (server.isSuspended) return 'suspended';
  if (server.status === 'install_failed' || server.status === 'backup_restore_failed') return 'failed';
  if (server.status === 'installing') return 'installing';
  if (server.status === 'restoring_backup') return 'restoring';
  if (server.isTransferring) return 'transferring';
  // no usage yet (the node hasn't answered) reads as offline until it does
  return usage?.state ?? 'offline';
}

export const STATUS_FILTERS = ['all', 'online', 'offline', 'attention'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];
const FILTER_PHASES: Record<Exclude<StatusFilter, 'all'>, readonly Phase[]> = {
  online: ['running', 'starting'],
  offline: ['offline', 'stopping'],
  attention: ['installing', 'restoring', 'transferring', 'failed', 'suspended'],
};

export const SORTS = ['default', 'name', 'status'] as const;
export type Sort = (typeof SORTS)[number];
/** The status sort: live servers first, then the ones busy or in trouble, then the stopped ones. */
const PHASE_RANK: Record<Phase, number> = {
  running: 0,
  starting: 1,
  stopping: 2,
  installing: 3,
  restoring: 3,
  transferring: 3,
  failed: 4,
  suspended: 5,
  offline: 6,
};

/** The server's address as people type it. */
export function addressOf(server: HomeServer): string | null {
  const { allocation } = server;
  return allocation ? `${allocation.ipAlias || allocation.ip}:${allocation.port}` : null;
}

/** The user's own names for servers (lib/tiles.ts), by uuid; the search matches them and the name sort uses them. */
export type CustomNames = Readonly<Record<string, { name?: string } | undefined>>;

function matchesQuery(server: HomeServer, query: string, names: CustomNames): boolean {
  if (!query) return true;
  const haystack = [
    server.name,
    names[server.uuid]?.name ?? '',
    server.egg.name,
    addressOf(server) ?? '',
    server.allocation?.ip ?? '',
  ];
  return haystack.some((field) => field.toLowerCase().includes(query));
}

function matchesStatus(phase: Phase, status: StatusFilter): boolean {
  return status === 'all' || FILTER_PHASES[status].includes(phase);
}

/** The servers the grid shows: matching the search and the status filter, in the chosen order. */
export function visibleServers<S extends HomeServer>(
  servers: readonly S[],
  usage: Readonly<Record<string, HomeUsage | undefined>>,
  { query, status, sort }: { query: string; status: StatusFilter; sort: Sort },
  names: CustomNames = {},
): S[] {
  const needle = query.trim().toLowerCase();
  const shown = servers.filter(
    (server) => matchesQuery(server, needle, names) && matchesStatus(phaseOf(server, usage[server.uuid]), status),
  );
  if (sort === 'name') {
    const shownName = (server: S) => names[server.uuid]?.name ?? server.name;
    return shown.sort((a, b) => shownName(a).localeCompare(shownName(b), undefined, { numeric: true }));
  }
  if (sort === 'status') {
    return shown.sort((a, b) => PHASE_RANK[phaseOf(a, usage[a.uuid])] - PHASE_RANK[phaseOf(b, usage[b.uuid])]);
  }
  return shown;
}

/** How many servers each status chip would show, for the search as typed. */
export function statusCounts(
  servers: readonly HomeServer[],
  usage: Readonly<Record<string, HomeUsage | undefined>>,
  query: string,
  names: CustomNames = {},
): Record<StatusFilter, number> {
  const needle = query.trim().toLowerCase();
  const counts: Record<StatusFilter, number> = { all: 0, online: 0, offline: 0, attention: 0 };
  for (const server of servers) {
    if (!matchesQuery(server, needle, names)) continue;
    const phase = phaseOf(server, usage[server.uuid]);
    counts.all++;
    for (const status of STATUS_FILTERS) if (status !== 'all' && matchesStatus(phase, status)) counts[status]++;
  }
  return counts;
}

/**
 * A visitor's own layout pick. `over` is the site layout it was made over in Studio's preview frame, where a pick is
 * never stored and gives way as soon as the draft's layout changes; a stored pick has none.
 */
export type LayoutPick = { layout: HomeLayout; over: HomeLayout | null };

/** A stored layout pick (`zoron:home-layout`); anything else reads as none. */
export function parseLayoutPick(raw: string | null): LayoutPick | null {
  const layout = HOME_LAYOUTS.find((option) => option === raw);
  return layout ? { layout, over: null } : null;
}

/** The layout the page shows: the visitor's pick while the site allows one (`homeLayoutChoice`), else the site's. */
export function homeLayoutOf(
  theme: { homeLayout: HomeLayout; homeLayoutChoice: boolean },
  pick: LayoutPick | null,
): HomeLayout {
  if (!theme.homeLayoutChoice || !pick) return theme.homeLayout;
  return pick.over === null || pick.over === theme.homeLayout ? pick.layout : theme.homeLayout;
}

/** The fields of core's server groups the sections read. */
export type HomeGroup = { uuid: string; name: string; order: number; serverOrder: readonly string[] };
/** A section of the page: a group's servers, or (`group` null) the servers in no group. */
export type HomeSection<S, G> = { group: G | null; servers: S[] };

/**
 * The shown servers split by group (`homeGroups`): one section per group in the groups' order, then the servers in
 * no group. A server in several groups shows in each. With the default sort a group keeps its own order
 * (`serverOrder`, as the rail's folder does); any other sort keeps the order `shown` already has. Sections left
 * empty by the search or the filter are dropped.
 */
export function sectionsOf<S extends { uuid: string }, G extends HomeGroup>(
  shown: readonly S[],
  groups: readonly G[],
  sort: Sort,
): HomeSection<S, G>[] {
  const byUuid = new Map(shown.map((server) => [server.uuid, server]));
  const grouped = new Set(groups.flatMap((group) => group.serverOrder));
  const sections: HomeSection<S, G>[] = [...groups]
    .sort((a, b) => a.order - b.order)
    .map((group) => {
      const members = new Set(group.serverOrder);
      const servers =
        sort === 'default'
          ? [...members].flatMap((uuid) => byUuid.get(uuid) ?? [])
          : shown.filter((server) => members.has(server.uuid));
      return { group, servers };
    });
  sections.push({ group: null, servers: shown.filter((server) => !grouped.has(server.uuid)) });
  return sections.filter((section) => section.servers.length > 0);
}
