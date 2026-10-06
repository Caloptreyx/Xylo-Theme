import {
  faAnglesLeft,
  faAnglesRight,
  faBars,
  faHouse,
  faMagnifyingGlass,
  faShieldHalved,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Drawer, useComputedColorScheme } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { type CSSProperties, type ReactElement, type ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { hsl } from '../../lib/color.ts';
import {
  ActionIcon,
  Avatar,
  getServers,
  isAdmin,
  Tooltip,
  useAuth,
  useGlobalStore,
  useQuickActionsStore,
} from '../../lib/core.ts';
import { useXyloTheme } from '../../lib/store.ts';
import { useExtTranslations } from '../../translations.ts';
import { type Area, areaOf, panelNodes, type SidebarProps } from './nav.ts';

/** The panel's collapsed state, per browser. */
const PANEL_KEY = 'xylo:panel';
/** How many of the user's servers the rail lists; the rest are a search or the servers page away. */
const RAIL_SERVERS = 8;

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
        <SearchButton />
      </div>

      <Drawer
        opened={drawer}
        onClose={() => setDrawer(false)}
        withCloseButton={false}
        size={336}
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

function SearchButton() {
  const { t } = useExtTranslations();
  const setOpen = useQuickActionsStore((state) => state.setOpen);
  return (
    <RailButton label={t('shell.search', {})} onClick={() => setOpen(true)}>
      <FontAwesomeIcon icon={faMagnifyingGlass} />
    </RailButton>
  );
}

/** One rail entry: a square that rounds less when hovered or current, with core's tooltip naming it. */
function RailButton({
  label,
  to,
  active = false,
  onClick,
  className = '',
  style,
  children,
}: {
  label: string;
  to?: string;
  active?: boolean;
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
        <button type='button' onClick={onClick} {...shared}>
          {children}
        </button>
      )}
    </Tooltip>
  );
}

/** A server's tile: its initials on a gradient whose hue comes from its name, so each one is recognisable. */
function serverTile(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const hue = Math.abs(hash) % 360;
  const initials = name
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
  return {
    initials: initials || '?',
    background: `linear-gradient(135deg,${hsl(hue, 70, 55)},${hsl(hue + 45, 75, 42)})`,
  };
}

const AREAS: { area: Area; to: string; icon: IconDefinition; label: 'shell.home' | 'shell.admin'; admin: boolean }[] = [
  { area: 'home', to: '/', icon: faHouse, label: 'shell.home', admin: false },
  { area: 'admin', to: '/admin', icon: faShieldHalved, label: 'shell.admin', admin: true },
];

function Rail({ area, collapsed, onToggle }: { area: Area; collapsed?: boolean; onToggle?: () => void }) {
  const { t } = useExtTranslations();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const servers = useQuery({
    queryKey: ['xylo', 'rail-servers', user?.uuid],
    queryFn: () => getServers(1),
    enabled: !!user && !user.suspended,
    staleTime: 60_000,
  });

  return (
    <nav
      className='xylo-rail flex h-full w-[72px] shrink-0 flex-col items-center gap-2 py-3'
      aria-label={t('shell.menu', {})}
    >
      <Link to='/' className='mb-1 grid size-11 place-items-center' aria-label={t('shell.home', {})}>
        <AppMark />
      </Link>
      <SearchButton />
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

      <div className='xylo-rail-servers flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto py-1'>
        {servers.data?.data.slice(0, RAIL_SERVERS).map((server) => {
          const tile = serverTile(server.name);
          const path = `/server/${server.uuidShort}`;
          return (
            <RailButton
              key={server.uuid}
              label={server.name}
              to={path}
              active={pathname === path || pathname.startsWith(`${path}/`)}
              className={`xylo-rail-server${server.isSuspended ? ' opacity-50' : ''}`}
              style={{ background: tile.background }}
            >
              <span className='text-sm font-semibold text-white'>{tile.initials}</span>
            </RailButton>
          );
        })}
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
  nodes: ReactNode[];
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
        <div className='flex min-h-0 flex-1 flex-col overflow-y-auto'>{nodes}</div>
        {footer && <div className='shrink-0 pt-2'>{footer}</div>}
      </div>
    </aside>
  );
}
