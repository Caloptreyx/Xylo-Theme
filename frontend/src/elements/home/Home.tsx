import { faArrowDownWideShort, faCheck, faMagnifyingGlass, faServer } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { type ComponentProps, cloneElement, type ReactElement, type ReactNode, useEffect, useState } from 'react';
import {
  AccountContentContainer,
  BulkActionBar,
  Button,
  bytesToString,
  Card,
  type CoreServer,
  getServers,
  Menu,
  Switch,
  TextInput,
  useAdminCan,
  useAuth,
  useBulkPowerActions,
  useServerListShowOthers,
  useUserStore,
} from '../../lib/core.ts';
import { useGroupServers, useLoadServerGroups } from '../../lib/groups.ts';
import { useXyloTheme } from '../../lib/store.ts';
import { useExtTranslations } from '../../translations.ts';
import { folderColor } from '../shell/folders.ts';
import {
  percentOf,
  SORTS,
  type Sort,
  STATUS_FILTERS,
  type StatusFilter,
  statusCounts,
  summarize,
  type Total,
  visibleServers,
} from './home.ts';
import ServerCard from './ServerCard.tsx';

type ContainerProps = ComponentProps<typeof AccountContentContainer>;

/**
 * Core's two server lists (all, grouped) render through AccountContentContainer with their own registries; the
 * interceptor in index.ts hands those here. With `homePage` on, the container stays (page title, padding, every
 * extension's slots, Xylo's greeting among them) and its content becomes Xylo's page, which covers both lists.
 */
export function HomeSwitch({ element }: ContainerProps & { element: ReactElement<ContainerProps> }) {
  const theme = useXyloTheme();
  if (!theme.homePage) return element;
  return cloneElement(element, { hideTitleComponent: true, children: <Home /> });
}

/** The chosen sort, per browser. */
const SORT_KEY = 'xylo:home-sort';
/** Pages of core's server list (26 servers each) loaded at most; past that, the page says how many it shows. */
const MAX_PAGES = 10;

const FILTER_LABEL = {
  all: 'home.all',
  online: 'home.filterOnline',
  offline: 'home.filterOffline',
  attention: 'home.filterAttention',
} as const satisfies Record<StatusFilter, string>;
const SORT_LABEL = {
  default: 'home.sortDefault',
  name: 'home.sortName',
  status: 'home.sortStatus',
} as const satisfies Record<Sort, string>;

/** Every server the user can list (or, for an admin who asks, other users' servers), up to MAX_PAGES pages. */
async function loadServers(others: boolean): Promise<{ servers: CoreServer[]; total: number }> {
  const first = await getServers(1, undefined, others);
  const pages = Math.min(MAX_PAGES, Math.ceil(first.total / Math.max(1, first.perPage)));
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, i) => getServers(i + 2, undefined, others)),
  );
  return { servers: [first, ...rest].flatMap((page) => page.data), total: first.total };
}

/** A stat strip tile: a label, a big value, what it is out of, and a bar when there is a limit. */
function Stat({
  label,
  value,
  detail,
  percent,
}: {
  label: string;
  value: string;
  detail: string;
  percent?: number | null;
}) {
  return (
    <div className='xylo-home-stat'>
      <span className='text-sm text-(--mantine-color-dimmed)'>{label}</span>
      <span className='text-2xl font-semibold tabular-nums tracking-tight'>{value}</span>
      <span className='truncate text-xs text-(--mantine-color-dimmed)'>{detail}</span>
      {percent !== undefined && (
        <div className='xylo-meter-track'>
          <div className='xylo-meter-fill' style={{ width: `${percent ?? 0}%` }} />
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  count,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count?: number;
  color?: string;
  children: ReactNode;
}) {
  return (
    <button type='button' className='xylo-chip' data-active={active || undefined} onClick={onClick}>
      {color && <span className='xylo-chip-dot' style={{ background: color }} />}
      {children}
      {count !== undefined && <span className='xylo-chip-count'>{count}</span>}
    </button>
  );
}

function Empty({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) {
  return (
    <Card className='xylo-home-empty'>
      <span className='xylo-home-empty-icon'>
        <FontAwesomeIcon icon={faServer} />
      </span>
      <span className='text-lg font-semibold'>{title}</span>
      <span className='text-sm text-(--mantine-color-dimmed)'>{hint}</span>
      {action}
    </Card>
  );
}

/**
 * Xylo's servers page (`homePage` on), in place of both of core's lists: a stat strip summing the shown servers'
 * live usage, a search, status chips with counts, a chip per server group (the rail's folders), a sort, and a grid
 * of server cards. Selecting cards brings up core's bulk power bar. Live usage comes from core's store, polled per
 * node while the page is open.
 */
export default function Home() {
  const { t } = useExtTranslations();
  const { user } = useAuth();
  const isAdmin = useAdminCan('servers.read');
  const [showOthers, setShowOthers] = useServerListShowOthers();
  const others = isAdmin && showOthers;
  const groups = useUserStore((state) => state.serverGroups);
  const usage = useUserStore((state) => state.serverResourceUsage);
  const subscribeToNode = useUserStore((state) => state.subscribeToNode);
  const { handleBulkPowerAction, bulkActionLoading } = useBulkPowerActions();
  useLoadServerGroups();

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [groupUuid, setGroupUuid] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>(() => {
    try {
      const saved = localStorage.getItem(SORT_KEY);
      return SORTS.find((option) => option === saved) ?? 'default';
    } catch {
      return 'default';
    }
  });

  const all = useQuery({
    queryKey: ['xylo', 'home-servers', user?.uuid, others],
    queryFn: () => loadServers(others),
    enabled: !!user && !user.suspended,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const shownGroups = [...groups].filter((group) => group.serverOrder.length > 0).sort((a, b) => a.order - b.order);
  const group = shownGroups.find((candidate) => candidate.uuid === groupUuid) ?? null;
  const grouped = useGroupServers(group);
  const pool = group ? grouped.servers : (all.data?.servers ?? []);
  const loading = group ? !grouped.loaded : !all.data;

  // poll every node the listed servers live on while the page is open, as core's cards do one by one
  const nodes = [...new Set(pool.map((server) => server.nodeUuid))].sort().join(',');
  useEffect(() => {
    const unsubscribe = nodes ? nodes.split(',').map((node) => subscribeToNode(node)) : [];
    return () => {
      for (const stop of unsubscribe) stop();
    };
  }, [nodes, subscribeToNode]);

  const shown = visibleServers(pool, usage, { query, status, sort });
  const counts = statusCounts(pool, usage, query);
  const totals = summarize(pool, usage);
  const filtered = query.trim() !== '' || status !== 'all' || group !== null;
  const shownUuids = shown.map((server) => server.uuid);
  const allShownSelected = shownUuids.length > 0 && shownUuids.every((uuid) => selected.includes(uuid));

  const chooseSort = (next: Sort) => {
    setSort(next);
    try {
      localStorage.setItem(SORT_KEY, next);
    } catch {
      // storage blocked: the sort lasts until the next load
    }
  };
  const toggle = (uuid: string, on: boolean) =>
    setSelected((current) => (on ? [...current, uuid] : current.filter((other) => other !== uuid)));
  const clearFilters = () => {
    setQuery('');
    setStatus('all');
    setGroupUuid(null);
  };
  // "of" the limit, or "no limit" when a server in the sum has none
  const ofLimit = (total: Total, format: (value: number) => string) =>
    total.limit === null ? t('home.unlimited', {}) : t('home.of', { total: format(total.limit) });

  return (
    <div className='xylo-home flex flex-col gap-5'>
      <Card className='xylo-home-stats'>
        <Stat
          label={t('home.online', {})}
          value={`${totals.online}`}
          detail={t('home.of', { total: `${totals.total}` })}
          percent={percentOf(totals.online, totals.total)}
        />
        <Stat
          label={t('home.cpuLive', {})}
          value={`${totals.cpu.used.toFixed(1)}%`}
          detail={ofLimit(totals.cpu, (value) => `${value}%`)}
          percent={percentOf(totals.cpu.used, totals.cpu.limit)}
        />
        <Stat
          label={t('home.memoryLive', {})}
          value={bytesToString(totals.memory.used, 1)}
          detail={ofLimit(totals.memory, (value) => bytesToString(value, 1))}
          percent={percentOf(totals.memory.used, totals.memory.limit)}
        />
        <Stat
          label={t('home.disk', {})}
          value={bytesToString(totals.disk.used, 1)}
          detail={ofLimit(totals.disk, (value) => bytesToString(value, 1))}
          percent={percentOf(totals.disk.used, totals.disk.limit)}
        />
      </Card>

      <div className='flex flex-col gap-3'>
        <div className='flex flex-wrap items-center gap-3'>
          <h2 className='mr-auto text-xl font-semibold tracking-tight'>
            {t('home.title', {})}
            <span className='ml-2 text-base font-normal text-(--mantine-color-dimmed)'>{pool.length}</span>
          </h2>
          {isAdmin && (
            <Switch
              label={t('home.showOthers', {})}
              checked={showOthers}
              onChange={(event) => {
                setGroupUuid(null);
                setSelected([]);
                setShowOthers(event.currentTarget.checked);
              }}
            />
          )}
          <div className='flex w-full gap-2 sm:w-auto'>
            <TextInput
              className='min-w-0 flex-1 sm:w-72 sm:flex-none'
              placeholder={t('home.search', {})}
              leftSection={<FontAwesomeIcon icon={faMagnifyingGlass} />}
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
            <Menu position='bottom-end' withinPortal>
              <Menu.Target>
                <Button variant='default' leftSection={<FontAwesomeIcon icon={faArrowDownWideShort} />}>
                  {t(SORT_LABEL[sort], {})}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{t('home.sort', {})}</Menu.Label>
                {SORTS.map((option) => (
                  <Menu.Item
                    key={option}
                    onClick={() => chooseSort(option)}
                    rightSection={option === sort ? <FontAwesomeIcon icon={faCheck} /> : null}
                  >
                    {t(SORT_LABEL[option], {})}
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
          </div>
        </div>

        <div className='xylo-chips' role='toolbar'>
          {STATUS_FILTERS.filter((filter) => filter !== 'attention' || counts.attention > 0).map((filter) => (
            <Chip key={filter} active={status === filter} count={counts[filter]} onClick={() => setStatus(filter)}>
              {t(FILTER_LABEL[filter], {})}
            </Chip>
          ))}
          {shownGroups.length > 0 && !others && (
            <>
              <span className='xylo-chips-sep' />
              <Chip active={group === null} onClick={() => setGroupUuid(null)}>
                {t('home.allServers', {})}
              </Chip>
              {shownGroups.map((candidate) => (
                <Chip
                  key={candidate.uuid}
                  active={group?.uuid === candidate.uuid}
                  count={candidate.serverOrder.length}
                  color={folderColor(candidate.name)}
                  onClick={() => setGroupUuid(group?.uuid === candidate.uuid ? null : candidate.uuid)}
                >
                  {candidate.name}
                </Chip>
              ))}
            </>
          )}
          {shown.length > 0 && (
            <button
              type='button'
              className='xylo-chip ml-auto'
              data-active={allShownSelected || undefined}
              onClick={() =>
                setSelected(
                  allShownSelected
                    ? selected.filter((uuid) => !shownUuids.includes(uuid))
                    : [...new Set([...selected, ...shownUuids])],
                )
              }
            >
              <FontAwesomeIcon icon={faCheck} />
              {t('home.selectAll', {})}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className='xylo-home-grid'>
          {[0, 1, 2].map((i) => (
            <Card key={i} className='xylo-home-card xylo-skeleton' />
          ))}
        </div>
      ) : pool.length === 0 ? (
        <Empty title={t('home.noServers', {})} hint={t('home.noServersHint', {})} />
      ) : shown.length === 0 ? (
        <Empty
          title={t('home.noMatch', {})}
          hint={t('home.noMatchHint', {})}
          action={
            filtered && (
              <Button variant='light' onClick={clearFilters}>
                {t('home.clearFilters', {})}
              </Button>
            )
          }
        />
      ) : (
        <div className='xylo-home-grid'>
          {shown.map((server) => (
            <ServerCard
              key={server.uuid}
              server={server}
              usage={usage[server.uuid]}
              selected={selected.includes(server.uuid)}
              selecting={selected.length > 0}
              onSelect={(on) => toggle(server.uuid, on)}
            />
          ))}
        </div>
      )}

      {!group && all.data && all.data.total > all.data.servers.length && (
        <p className='text-center text-sm text-(--mantine-color-dimmed)'>
          {t('home.capped', { count: `${all.data.servers.length}`, total: `${all.data.total}` })}
        </p>
      )}

      <BulkActionBar
        selectedCount={selected.length}
        onClear={() => setSelected([])}
        onAction={async (action) => {
          await handleBulkPowerAction(selected, action);
          setSelected([]);
        }}
        loading={bulkActionLoading}
      />
    </div>
  );
}
