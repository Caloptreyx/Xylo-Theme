import {
  faArrowDownWideShort,
  faCheck,
  faList,
  faMagnifyingGlass,
  faServer,
  faTableCells,
  faTableCellsLarge,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { type ComponentProps, cloneElement, type ReactElement, type ReactNode, useEffect, useState } from 'react';
import {
  AccountContentContainer,
  BulkActionBar,
  Button,
  Card,
  type CoreServer,
  getServers,
  Menu,
  Switch,
  TextInput,
  Tooltip,
  useAdminCan,
  useAuth,
  useBulkPowerActions,
  useServerListShowOthers,
  useUserStore,
} from '../../lib/core.ts';
import { useGroupServers, useLoadServerGroups } from '../../lib/groups.ts';
import { inPreviewFrame, useZoronTheme } from '../../lib/store.ts';
import { HOME_LAYOUTS, type HomeLayout } from '../../lib/theme.ts';
import { useExtTranslations } from '../../translations.ts';
import { folderColor } from '../shell/folders.ts';
import { useServerTiles } from '../tiles/useTiles.ts';
import {
  homeLayoutOf,
  type LayoutPick,
  parseLayoutPick,
  SORTS,
  type Sort,
  STATUS_FILTERS,
  type StatusFilter,
  sectionsOf,
  statusCounts,
  visibleServers,
} from './home.ts';
import ServerCard from './ServerCard.tsx';

type ContainerProps = ComponentProps<typeof AccountContentContainer>;

/**
 * Core's two server lists (all, grouped) render through AccountContentContainer with their own registries; the
 * interceptor in index.ts hands those here. With `homePage` on, the container stays (page title, padding, every
 * extension's slots, Zoron's greeting among them) and its content becomes Zoron's page, which covers both lists.
 */
export function HomeSwitch({ element }: ContainerProps & { element: ReactElement<ContainerProps> }) {
  const theme = useZoronTheme();
  if (!theme.homePage) return element;
  return cloneElement(element, { hideTitleComponent: true, children: <Home /> });
}

/** The chosen sort, per browser. */
const SORT_KEY = 'zoron:home-sort';
/** The visitor's own layout, per browser, while the site lets visitors pick (`homeLayoutChoice`). */
const LAYOUT_KEY = 'zoron:home-layout';
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
const LAYOUT_LABEL = {
  cards: 'home.layoutCards',
  compact: 'home.layoutCompact',
  list: 'home.layoutList',
} as const satisfies Record<HomeLayout, string>;
const LAYOUT_ICON = { cards: faTableCellsLarge, compact: faTableCells, list: faList } satisfies Record<
  HomeLayout,
  typeof faList
>;

/** Every server the user can list (or, for an admin who asks, other users' servers), up to MAX_PAGES pages. */
async function loadServers(others: boolean): Promise<{ servers: CoreServer[]; total: number }> {
  const first = await getServers(1, undefined, others);
  const pages = Math.min(MAX_PAGES, Math.ceil(first.total / Math.max(1, first.perPage)));
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, i) => getServers(i + 2, undefined, others)),
  );
  return { servers: [first, ...rest].flatMap((page) => page.data), total: first.total };
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
    <button type='button' className='zoron-chip' data-active={active || undefined} onClick={onClick}>
      {color && <span className='zoron-chip-dot' style={{ background: color }} />}
      {children}
      {count !== undefined && <span className='zoron-chip-count'>{count}</span>}
    </button>
  );
}

function Empty({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) {
  return (
    <Card className='zoron-home-empty'>
      <span className='zoron-home-empty-icon'>
        <FontAwesomeIcon icon={faServer} />
      </span>
      <span className='text-lg font-semibold'>{title}</span>
      <span className='text-sm text-(--mantine-color-dimmed)'>{hint}</span>
      {action}
    </Card>
  );
}

/** Placeholders shaped like the layout's servers while the list loads. */
function Skeleton({ layout }: { layout: HomeLayout }) {
  if (layout === 'list') {
    return (
      <Card className='zoron-home-list'>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className='zoron-home-row-skeleton'>
            <div className='zoron-skeleton size-[34px] rounded-[10px] bg-(--mantine-color-default)' />
            <div className='zoron-skeleton h-3 w-40 max-w-[50%] rounded bg-(--mantine-color-default)' />
          </div>
        ))}
      </Card>
    );
  }
  return (
    <div className='zoron-home-grid' data-layout={layout}>
      {[0, 1, 2].map((i) => (
        <Card key={i} className='zoron-home-card zoron-skeleton' data-layout={layout} data-skeleton />
      ))}
    </div>
  );
}

/**
 * Zoron's servers page (`homePage` on), in place of both of core's lists: a search, status chips with counts, a chip
 * per server group (the rail's folders), a sort, then the servers in the theme's layout (`homeLayout`): 'cards', a
 * grid of server cards with address, uptime and power buttons; 'compact', a denser grid of small cards (tile, name,
 * game, state; power stays in the menu); 'list', one surface with a row per server in shared columns. With
 * `homeLayoutChoice` a switch beside the sort lets each visitor pick their own (`zoron:home-layout`), except in
 * Studio's preview, which shows the draft's. With `homeGroups` and no group chip picked, the servers come in a
 * section per group, the ungrouped last. Selecting servers brings up core's bulk power bar. Live state comes from
 * core's store, polled per node while the page is open.
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
  const tiles = useServerTiles();
  useLoadServerGroups();
  const theme = useZoronTheme();

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
  // Studio's preview frame shares the editor's storage, so it neither reads nor keeps a pick: the draft decides
  const [pick, setPick] = useState<LayoutPick | null>(() => {
    if (inPreviewFrame) return null;
    try {
      return parseLayoutPick(localStorage.getItem(LAYOUT_KEY));
    } catch {
      return null;
    }
  });
  const layout = homeLayoutOf(theme, pick);

  const all = useQuery({
    queryKey: ['zoron', 'home-servers', user?.uuid, others],
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

  const shown = visibleServers(pool, usage, { query, status, sort }, tiles);
  const counts = statusCounts(pool, usage, query, tiles);
  const filtered = query.trim() !== '' || status !== 'all' || group !== null;
  const shownUuids = shown.map((server) => server.uuid);
  const allShownSelected = shownUuids.length > 0 && shownUuids.every((uuid) => selected.includes(uuid));
  // sections by group only over the user's own servers as a whole, and only once some shown server is in a group
  const sections = theme.homeGroups && !group && !others ? sectionsOf(shown, shownGroups, sort) : [];
  const sectioned = sections.some((section) => section.group !== null);

  const chooseSort = (next: Sort) => {
    setSort(next);
    try {
      localStorage.setItem(SORT_KEY, next);
    } catch {
      // storage blocked: the sort lasts until the next load
    }
  };
  const chooseLayout = (next: HomeLayout) => {
    setPick({ layout: next, over: inPreviewFrame ? theme.homeLayout : null });
    if (inPreviewFrame) return;
    try {
      localStorage.setItem(LAYOUT_KEY, next);
    } catch {
      // storage blocked: the layout lasts until the next load
    }
  };
  const toggle = (uuid: string, on: boolean) =>
    setSelected((current) => (on ? [...current, uuid] : current.filter((other) => other !== uuid)));
  const clearFilters = () => {
    setQuery('');
    setStatus('all');
    setGroupUuid(null);
  };
  const serverList = (list: typeof shown) => {
    const cards = list.map((server) => (
      <ServerCard
        key={server.uuid}
        server={server}
        usage={usage[server.uuid]}
        layout={layout}
        selected={selected.includes(server.uuid)}
        selecting={selected.length > 0}
        onSelect={(on) => toggle(server.uuid, on)}
      />
    ));
    // the list is one surface, its rows sharing the columns of one grid
    return layout === 'list' ? (
      <Card className='zoron-home-list'>
        <div className='zoron-home-rows'>{cards}</div>
      </Card>
    ) : (
      <div className='zoron-home-grid' data-layout={layout}>
        {cards}
      </div>
    );
  };

  return (
    <div className='zoron-home flex flex-col gap-5'>
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
          <div className='flex w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap'>
            <TextInput
              className='min-w-48 flex-1 sm:w-72 sm:flex-none'
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
            {theme.homeLayoutChoice && (
              <div className='zoron-home-views' role='group' aria-label={t('home.layout', {})}>
                {HOME_LAYOUTS.map((option) => (
                  <Tooltip key={option} label={t(LAYOUT_LABEL[option], {})}>
                    <button
                      type='button'
                      className='zoron-home-view'
                      aria-pressed={layout === option}
                      aria-label={t(LAYOUT_LABEL[option], {})}
                      onClick={() => chooseLayout(option)}
                    >
                      <FontAwesomeIcon icon={LAYOUT_ICON[option]} />
                    </button>
                  </Tooltip>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className='zoron-chips' role='toolbar'>
          {STATUS_FILTERS.filter((filter) => filter !== 'attention' || counts.attention > 0).map((filter) => (
            <Chip key={filter} active={status === filter} count={counts[filter]} onClick={() => setStatus(filter)}>
              {t(FILTER_LABEL[filter], {})}
            </Chip>
          ))}
          {shownGroups.length > 0 && !others && (
            <>
              <span className='zoron-chips-sep' />
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
              className='zoron-chip ml-auto'
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
        <Skeleton layout={layout} />
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
      ) : sectioned ? (
        sections.map((section) => (
          <section key={section.group?.uuid ?? 'other'} className='flex flex-col gap-3'>
            <h3 className='zoron-home-section'>
              {section.group && (
                <span className='zoron-chip-dot' style={{ background: folderColor(section.group.name) }} />
              )}
              <span className='truncate'>{section.group?.name ?? t('home.otherServers', {})}</span>
              <span className='zoron-home-section-count'>{section.servers.length}</span>
            </h3>
            {serverList(section.servers)}
          </section>
        ))
      ) : (
        serverList(shown)
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
