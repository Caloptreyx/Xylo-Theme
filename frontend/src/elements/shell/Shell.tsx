import { faBars, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Drawer } from '@mantine/core';
import { type ReactElement, type ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { ActionIcon, useGlobalStore, useQuickActionsStore } from '../../lib/core.ts';
import { useZoronTheme } from '../../lib/store.ts';
import { useExtTranslations } from '../../translations.ts';
import { type Area, areaOf, type PanelNodes, panelNodes, type SidebarProps } from './nav.ts';
import { AppMark, Rail } from './Rail.tsx';

/** The panel's collapsed state, per browser. */
const PANEL_KEY = 'zoron:panel';

/**
 * `sidebar: 'rail'` replaces core's sidebar on the dashboard, server and admin pages: an icon rail of areas and
 * servers, a collapsible context panel with core's own links, and below lg a top bar whose menu opens both in a
 * drawer. The setup wizard (its sidebar lists its steps) and the other layouts keep core's element.
 */
export default function Shell({ element, ...props }: SidebarProps & { element: ReactElement }) {
  const theme = useZoronTheme();
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
      <div className='zoron-shell sticky top-0 z-40 hidden h-screen shrink-0 lg:flex'>
        <Rail area={area} collapsed={collapsed} onToggle={toggle} />
        <Panel area={area} nodes={nodes} footer={footer} collapsed={collapsed} />
      </div>

      <div className='zoron-topbar sticky top-0 z-50 flex h-14 items-center gap-2 px-3 lg:hidden'>
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
        classNames={{ content: 'zoron-drawer' }}
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
      className='zoron-panel h-full shrink-0 overflow-hidden'
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
        <div className='zoron-panel-scroll flex min-h-0 flex-1 flex-col overflow-y-auto'>{nodes.menu}</div>
        {footer && <div className='shrink-0 pt-2'>{footer}</div>}
      </div>
    </aside>
  );
}
