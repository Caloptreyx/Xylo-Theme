import {
  faAnglesLeft,
  faAnglesRight,
  faBars,
  faFolderOpen,
  faHouse,
  faMagnifyingGlass,
  faShieldHalved,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Drawer, useComputedColorScheme } from '@mantine/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { type CSSProperties, type ReactElement, type ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { hsl } from '../../lib/color.ts';
import {
  ActionIcon,
  Avatar,
  getServerGroupServers,
  getServerGroups,
  getServers,
  isAdmin,
  queryKeys,
  Tooltip,
  useAuth,
  useGlobalStore,
  useQuickActionsStore,
  useUserStore,
} from '../../lib/core.ts';
import { useXyloTheme } from '../../lib/store.ts';
import { useExtTranslations } from '../../translations.ts';
import {
  FOLDER_PREVIEW,
  FOLDERS_KEY,
  hueOf,
  initialsOf,
  looseServers,
  orderGroupServers,
  parseOpenFolders,
  type RailGroup,
  type RailServer,
} from './folders.ts';
import { type Area, areaOf, type PanelNodes, panelNodes, type SidebarProps } from './nav.ts';

/** The fields of core's server list entries the rail reads. */
type Server = RailServer & { uuidShort: string; isSuspended: boolean };

/** The panel's collapsed state, per browser. */
const PANEL_KEY = 'xylo:panel';
/** How many loose servers (in no group) the rail lists; the rest are a search or the servers page away. */
const RAIL_SERVERS = 8;
/** Core's cap on a server group's size (MAX_SERVERS_PER_GROUP), so one page holds a whole folder. */
const GROUP_SERVERS = 100;

/**
 * `sidebar: 'rail'` replaces core's sidebar on the dashboard, server and admin pages: an icon rail of areas and
 * servers, a collapsible context panel with core's own links, and below lg a top bar whose menu opens both in a
 * drawer. The setup wizard (its sidebar lists its steps) and the other layouts keep core's element.
 */
export default function Shell({ element, ...props }: SidebarProps & { element: ReactElement }) {
  const theme = useXyloTheme();
  const { pathname } = useLocation();
  if (theme.sidebar !== 'rail' || pathname.startsWith('/oobe')) return element;
  return <RailShell {...props} />;
}

function RailShell({ header, footer, children }: SidebarProps) {
  const { t } = useExtTranslations();
  const { pathname } = useLocation();
  const app = useGlobalStore((state) => state.settings.app);
  const quickActionsOpen = useQuickActionsStore((state) => state.open);
  const setQuickActionsOpen = useQuickActionsStore((state) => state.setOpen);
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(PANEL_KEY) === 'collapsed';
    } catch {
      return false;
    }
  });

  // as core's drawer: closed by a navigation and by the quick actions palette opening over it
  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    if (quickActionsOpen) setDrawer(false);
  }, [quickActionsOpen]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      if (next) localStorage.setItem(PANEL_KEY, 'collapsed');
      else localStorage.removeItem(PANEL_KEY);
    } catch {
      // storage blocked: the state lasts until the next load
    }
  };

  const area = areaOf(pathname);
  const nodes = panelNodes(header, children);

  return (
    <>
      <div className='xylo-shell sticky top-0 z-40 hidden h-screen shrink-0 lg:flex'>
        <Rail area={area} collapsed={collapsed} onToggle={toggle} />
        <Panel area={area} nodes={nodes} footer={footer} collapsed={collapsed} />
      </div>

      <div className='xylo-topbar sticky top-0 z-50 flex h-14 items-center gap-2 px-3 lg:hidden'>
        <ActionIcon
          variant='subtle'
          color='gray'
          size='lg'
          aria-label={t('shell.menu', {})}
          onClick={() => setDrawer(true)}
        >
          <FontAwesomeIcon icon={faBars} />
        </ActionIcon>
        <Link to='/' className='flex min-w-0 items-center gap-2'>
          <AppMark />
          <span className='truncate text-sm font-semibold'>{app.name}</span>
        </Link>
        <div className='flex-1' />
        <ActionIcon
          variant='subtle'
          color='gray'
          size='lg'
          aria-label={t('shell.search', {})}
          onClick={() => setQuickActionsOpen(true)}
        >
          <FontAwesomeIcon icon={faMagnifyingGlass} />
        </ActionIcon>
      </div>

      <Drawer
        opened={drawer}
        onClose={() => setDrawer(false)}
        withCloseButton={false}
        // leaves a strip of the page to tap out on, however narrow the phone
        size='min(340px, calc(100vw - 3rem))'
        padding={0}
        classNames={{ content: 'xylo-drawer' }}
        styles={{ body: { height: '100%' } }}
      >
        <div className='flex h-full'>
          <Rail area={area} />
          <Panel area={area} nodes={nodes} footer={footer} collapsed={false} />
        </div>
      </Drawer>
    </>
  );
}

function AppMark() {
  const app = useGlobalStore((state) => state.settings.app);
  const light = useComputedColorScheme('dark') === 'light';
  return <img src={(light && app.iconLight) || app.icon} alt={app.name} className='size-9 shrink-0 object-contain' />;
}

/** One rail entry: a square that rounds less when hovered or current, with core's tooltip naming it. */
function RailButton({
  label,
  to,
  active = false,
  expanded,
  onClick,
  className = '',
  style,
  children,
}: {
  label: string;
  to?: string;
  active?: boolean;
  expanded?: boolean;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const shared = {
    'aria-label': label,
    'data-active': active || undefined,
    className: `xylo-rail-btn ${className}`,
    style,
  };
  return (
    <Tooltip label={label} position='right' withArrow openDelay={150}>
      {to ? (
        <Link to={to} aria-current={active ? 'page' : undefined} {...shared}>
          {children}
        </Link>
      ) : (
        <button type='button' onClick={onClick} aria-expanded={expanded} {...shared}>
          {children}
        </button>
      )}
    </Tooltip>
  );
}

/** A server's tile: its initials on a gradient whose hue comes from its name, so each one is recognisable. */
function serverTile(name: string) {
  const hue = hueOf(name);
  return {
    initials: initialsOf(name),
    background: `linear-gradient(135deg,${hsl(hue, 70, 55)},${hsl(hue + 45, 75, 42)})`,
  };
}

function ServerButton({ server, current }: { server: Server; current: string | null }) {
  const tile = serverTile(server.name);
  return (
    <RailButton
      label={server.name}
      to={`/server/${server.uuidShort}`}
      // core's routes take a server's short or full uuid
      active={current === server.uuidShort || current === server.uuid}
      className={`xylo-rail-server${server.isSuspended ? ' opacity-50' : ''}`}
      style={{ background: tile.background }}
    >
      <span className='text-sm font-semibold text-white'>{tile.initials}</span>
    </RailButton>
  );
}

/**
 * One of core's server groups as a Discord style folder: closed, a tile previewing its first servers, lit while the
 * page shows one of them; open, its servers on a tinted pill under the folder's head. Empty groups are left out.
 */
function RailFolder({
  group,
  open,
  current,
  onToggle,
}: {
  group: RailGroup;
  open: boolean;
  current: string | null;
  onToggle: () => void;
}) {
  const query = useQuery({
    // under core's key for the group, so the dashboard's moves (which invalidate it) refresh the folder too; the
    // members in the key fetch it again when a server is added or removed
    queryKey: [...queryKeys.user.servers.all(), group.uuid, 'xylo-rail', [...group.serverOrder].sort().join(',')],
    queryFn: () => getServerGroupServers(group.uuid, 1, undefined, GROUP_SERVERS),
    enabled: group.serverOrder.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const servers = orderGroupServers(query.data?.data ?? [], group.serverOrder);
  if (group.serverOrder.length === 0 || (query.data && servers.length === 0)) return null;

  const color = hsl(hueOf(group.name), 65, 58);
  if (!open) {
    return (
      <RailButton
        label={group.name}
        onClick={onToggle}
        expanded={false}
        active={servers.some((server) => current === server.uuidShort || current === server.uuid)}
        className='xylo-rail-folder'
        style={{ background: `color-mix(in srgb, ${color} 28%, transparent)` }}
      >
        {servers.length > 0 ? (
          <span className='xylo-rail-folder-grid'>
            {servers.slice(0, FOLDER_PREVIEW).map((server) => {
              const tile = serverTile(server.name);
              return (
                <span key={server.uuid} style={{ background: tile.background }}>
                  {tile.initials[0]}
                </span>
              );
            })}
          </span>
        ) : (
          <FontAwesomeIcon icon={faFolderOpen} style={{ color }} />
        )}
      </RailButton>
    );
  }
  return (
    <div className='xylo-rail-folder-open'>
      <RailButton label={group.name} onClick={onToggle} expanded className='xylo-rail-folder-head'>
        <FontAwesomeIcon icon={faFolderOpen} style={{ color }} />
      </RailButton>
      {servers.map((server) => (
        <ServerButton key={server.uuid} server={server} current={current} />
      ))}
    </div>
  );
}

const AREAS: { area: Area; to: string; icon: IconDefinition; label: 'shell.home' | 'shell.admin'; admin: boolean }[] = [
  { area: 'home', to: '/', icon: faHouse, label: 'shell.home', admin: false },
  { area: 'admin', to: '/admin', icon: faShieldHalved, label: 'shell.admin', admin: true },
];

function Rail({ area, collapsed, onToggle }: { area: Area; collapsed?: boolean; onToggle?: () => void }) {
  const { t } = useExtTranslations();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const groups = useUserStore((state) => state.serverGroups);
  const setServerGroups = useUserStore((state) => state.setServerGroups);
  const setQuickActionsOpen = useQuickActionsStore((state) => state.setOpen);
  const signedIn = !!user && !user.suspended;
  const servers = useQuery({
    queryKey: ['xylo', 'rail-servers', user?.uuid],
    queryFn: () => getServers(1),
    enabled: signedIn,
    staleTime: 60_000,
  });
  const groupsQuery = useQuery({
    queryKey: ['xylo', 'rail-groups', user?.uuid],
    // into core's store, which the dashboard's grouped tab edits in place: a new, renamed, reordered or deleted
    // group shows in the rail at once
    queryFn: async () => {
      const result = await getServerGroups();
      setServerGroups(result);
      return result;
    },
    enabled: signedIn,
    staleTime: 60_000,
  });
  const [openFolders, setOpenFolders] = useState(() => {
    try {
      return parseOpenFolders(localStorage.getItem(FOLDERS_KEY));
    } catch {
      return [];
    }
  });

  const toggleFolder = (uuid: string) => {
    const next = openFolders.includes(uuid) ? openFolders.filter((open) => open !== uuid) : [...openFolders, uuid];
    setOpenFolders(next);
    try {
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(next));
    } catch {
      // storage blocked: the state lasts until the next load
    }
  };

  const current = area === 'server' ? (pathname.split('/')[2] ?? null) : null;

  return (
    <nav
      className='xylo-rail flex h-full w-[72px] shrink-0 flex-col items-center gap-2 py-3'
      aria-label={t('shell.menu', {})}
    >
      <Link to='/' className='mb-1 grid size-11 place-items-center' aria-label={t('shell.home', {})}>
        <AppMark />
      </Link>
      <RailButton label={t('shell.search', {})} onClick={() => setQuickActionsOpen(true)}>
        <FontAwesomeIcon icon={faMagnifyingGlass} />
      </RailButton>
      {AREAS.filter((entry) => !entry.admin || isAdmin(user)).map((entry) => (
        <RailButton
          key={entry.area}
          label={t(entry.label, {})}
          to={entry.to}
          // account pages belong to the dashboard, but the avatar at the bottom is the one lit for them
          active={area === entry.area && !pathname.startsWith('/account')}
        >
          <FontAwesomeIcon icon={entry.icon} />
        </RailButton>
      ))}

      <div className='xylo-rail-sep' />

      <div className='xylo-rail-servers flex min-h-0 w-full flex-1 flex-col items-center gap-2 overflow-y-auto py-1'>
        {[...groups]
          .sort((a, b) => a.order - b.order)
          .map((group) => (
            <RailFolder
              key={group.uuid}
              group={group}
              open={openFolders.includes(group.uuid)}
              current={current}
              onToggle={() => toggleFolder(group.uuid)}
            />
          ))}
        {/* until the groups load, a grouped server can't be told from a loose one */}
        {groupsQuery.status !== 'pending' &&
          looseServers(servers.data?.data ?? [], groups, RAIL_SERVERS).map((server) => (
            <ServerButton key={server.uuid} server={server} current={current} />
          ))}
      </div>

      {onToggle && (
        <RailButton label={collapsed ? t('shell.expand', {}) : t('shell.collapse', {})} onClick={onToggle}>
          <FontAwesomeIcon icon={collapsed ? faAnglesRight : faAnglesLeft} />
        </RailButton>
      )}
      {user && (
        <RailButton
          label={t('shell.account', {})}
          to='/account'
          active={pathname.startsWith('/account')}
          className='xylo-rail-avatar'
        >
          <Avatar src={user.avatar} name={user.username} size={40} radius='xl' />
        </RailButton>
      )}
    </nav>
  );
}

function Panel({
  area,
  nodes,
  footer,
  collapsed,
}: {
  area: Area;
  nodes: PanelNodes;
  footer: ReactNode;
  collapsed: boolean;
}) {
  const { t } = useExtTranslations();
  return (
    <aside
      id='sidebar-content'
      className='xylo-panel h-full shrink-0 overflow-hidden'
      data-collapsed={collapsed || undefined}
      inert={collapsed}
    >
      <div className='flex h-full w-[256px] flex-col py-3 pr-3 pl-1'>
        {/* a server page opens with core's server block, which names it */}
        {area !== 'server' && (
          <h2 className='px-2 pt-2 pb-3 text-lg font-semibold tracking-tight'>
            {t(area === 'admin' ? 'shell.adminTitle' : 'shell.homeTitle', {})}
          </h2>
        )}
        {nodes.head.length > 0 && <div className='shrink-0'>{nodes.head}</div>}
        <div className='xylo-panel-scroll flex min-h-0 flex-1 flex-col overflow-y-auto'>{nodes.menu}</div>
        {footer && <div className='shrink-0 pt-2'>{footer}</div>}
      </div>
    </aside>
  );
}
