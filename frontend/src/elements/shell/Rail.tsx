import {
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  faAnglesLeft,
  faAnglesRight,
  faFolderMinus,
  faFolderOpen,
  faHouse,
  faMagnifyingGlass,
  faPen,
  faShieldHalved,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useComputedColorScheme } from '@mantine/core';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { type CSSProperties, type ReactNode, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router';
import { hsl } from '../../lib/color.ts';
import {
  Avatar,
  Button,
  ConfirmationModal,
  createServerGroup,
  deleteServerGroup,
  getServerGroupServers,
  getServerGroups,
  getServers,
  httpErrorToHuman,
  isAdmin,
  Menu,
  Modal,
  ModalFooter,
  queryKeys,
  TextInput,
  Tooltip,
  updateServerGroup,
  useAuth,
  useGlobalStore,
  useQuickActionsStore,
  useToast,
  useUserStore,
} from '../../lib/core.ts';
import { useExtTranslations } from '../../translations.ts';
import {
  dropAction,
  FOLDER_PREVIEW,
  FOLDERS_KEY,
  GROUP_MAX,
  hueOf,
  initialsOf,
  looseServers,
  orderGroupServers,
  parseOpenFolders,
  type RailDrag,
  type RailDropAction,
  type RailDropTarget,
  type RailGroup,
  type RailServer,
} from './folders.ts';
import type { Area } from './nav.ts';

/** The fields of core's server list entries the rail reads. */
type Server = RailServer & { uuidShort: string; isSuspended: boolean };
/** What a dragged tile carries. */
type DragData = RailDrag & { server: Server };

/** How many loose servers (in no group) the rail lists; the rest are a search or the servers page away. */
const RAIL_SERVERS = 8;
/** The droppable for the rail's free space, where a server dropped leaves its folder. */
const LOOSE_ID = 'xylo-loose';

export function AppMark() {
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
  quiet = false,
  onClick,
  className = '',
  style,
  children,
}: {
  label: string;
  to?: string;
  active?: boolean;
  expanded?: boolean;
  /** no tooltip, while a menu opened from the entry names it instead */
  quiet?: boolean;
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
    <Tooltip label={label} position='right' withArrow openDelay={150} disabled={quiet}>
      {to ? (
        // not natively draggable: the rail's own drag and drop moves servers
        <Link to={to} draggable={false} aria-current={active ? 'page' : undefined} {...shared}>
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

/** A drop target, lit while a server that it would take is over it. */
function useRailDrop(id: string, target: RailDropTarget, disabled = false) {
  const groups = useUserStore((state) => state.serverGroups);
  const { setNodeRef, isOver, active } = useDroppable({ id, data: target, disabled });
  const drag = active?.data.current as DragData | undefined;
  return { ref: setNodeRef, lit: isOver && !!drag && dropAction(drag, target, groups) !== null };
}

/** A server's tile, draggable; a loose one is also a target, which makes a folder of the two. */
function ServerButton({ server, current, from }: { server: Server; current: string | null; from: string | null }) {
  const tile = serverTile(server.name);
  const data: DragData = { server, serverUuid: server.uuid, from };
  const drag = useDraggable({ id: `${from ?? 'loose'}:${server.uuid}`, data });
  // a server in a folder is part of the folder's target, not one of its own
  const drop = useRailDrop(
    `server:${from ?? 'loose'}:${server.uuid}`,
    { kind: 'server', serverUuid: server.uuid },
    from !== null,
  );
  return (
    <div
      ref={(node) => {
        drag.setNodeRef(node);
        drop.ref(node);
      }}
      {...drag.listeners}
      className='xylo-rail-drag'
      data-dragging={drag.isDragging || undefined}
      data-drop={drop.lit || undefined}
    >
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
    </div>
  );
}

/** The group changes the rail makes. */
type GroupEdits = {
  drop: (action: RailDropAction, serverUuid: string) => Promise<void>;
  rename: (group: RailGroup, name: string) => Promise<void>;
  ungroup: (group: RailGroup) => Promise<void>;
};

/**
 * The group changes the rail makes, each applied to core's store first (so the rail and the dashboard move at
 * once) and then saved; a failure says why and reloads the groups.
 */
function useGroupEdits(): GroupEdits {
  const { t } = useExtTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const run = async (edit: () => Promise<void>) => {
    try {
      await edit();
    } catch (err) {
      addToast(httpErrorToHuman(err), 'error');
      await queryClient.invalidateQueries({ queryKey: ['xylo', 'rail-groups'] });
    }
  };
  const setOrder = (uuid: string, serverOrder: string[]) => {
    useUserStore.getState().updateServerGroup(uuid, { serverOrder });
    return updateServerGroup(uuid, { serverOrder });
  };
  const remove = (group: RailGroup) => {
    const { serverGroups, setServerGroups } = useUserStore.getState();
    setServerGroups(serverGroups.filter((other) => other.uuid !== group.uuid));
    return deleteServerGroup(group.uuid);
  };

  return {
    /** A drop: into a new or another folder, or out to the free space. A folder emptied by it goes, as on Discord. */
    drop: (action: RailDropAction, serverUuid: string) =>
      run(async () => {
        const find = (uuid: string) => useUserStore.getState().serverGroups.find((group) => group.uuid === uuid);
        if (action.kind === 'create') {
          const group = await createServerGroup({ name: t('shell.newGroup', {}), serverOrder: action.serverOrder });
          useUserStore.getState().addServerGroup(group);
        } else if (action.to) {
          const target = find(action.to);
          if (target) await setOrder(target.uuid, [...target.serverOrder, serverUuid]);
        }
        const source = action.from ? find(action.from) : undefined;
        if (!source) return;
        const rest = source.serverOrder.filter((uuid) => uuid !== serverUuid);
        await (rest.length > 0 ? setOrder(source.uuid, rest) : remove(source));
      }),
    rename: (group: RailGroup, name: string) =>
      run(async () => {
        useUserStore.getState().updateServerGroup(group.uuid, { name });
        await updateServerGroup(group.uuid, { name });
      }),
    ungroup: (group: RailGroup) => run(() => remove(group)),
  };
}

/**
 * One of core's server groups as a Discord style folder: closed, a tile previewing its first servers, lit while the
 * page shows one of them; open, its servers on a tinted pill under the folder's head. Either is a drop target, and
 * a right click opens its menu (rename, ungroup). Empty groups are left out.
 */
function RailFolder({
  group,
  open,
  current,
  onToggle,
  edits,
}: {
  group: RailGroup;
  open: boolean;
  current: string | null;
  onToggle: () => void;
  edits: GroupEdits;
}) {
  const { t } = useExtTranslations();
  const [menu, setMenu] = useState(false);
  const [dialog, setDialog] = useState<'rename' | 'ungroup' | null>(null);
  const drop = useRailDrop(`folder:${group.uuid}`, { kind: 'folder', groupUuid: group.uuid });
  const query = useQuery({
    // under core's key for the group, so the dashboard's moves (which invalidate it) refresh the folder too; the
    // members in the key fetch it again when a server is added or removed
    queryKey: [...queryKeys.user.servers.all(), group.uuid, 'xylo-rail', [...group.serverOrder].sort().join(',')],
    queryFn: () => getServerGroupServers(group.uuid, 1, undefined, GROUP_MAX),
    enabled: group.serverOrder.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const servers = orderGroupServers(query.data?.data ?? [], group.serverOrder);
  if (group.serverOrder.length === 0 || (query.data && servers.length === 0)) return null;

  const color = hsl(hueOf(group.name), 65, 58);
  const folder = open ? (
    <div ref={drop.ref} className='xylo-rail-folder-open' data-drop={drop.lit || undefined}>
      <RailButton label={group.name} onClick={onToggle} expanded quiet={menu} className='xylo-rail-folder-head'>
        <FontAwesomeIcon icon={faFolderOpen} style={{ color }} />
      </RailButton>
      {servers.map((server) => (
        <ServerButton key={server.uuid} server={server} current={current} from={group.uuid} />
      ))}
    </div>
  ) : (
    <div ref={drop.ref} className='xylo-rail-drag' data-drop={drop.lit || undefined}>
      <RailButton
        label={group.name}
        onClick={onToggle}
        expanded={false}
        quiet={menu}
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
    </div>
  );

  return (
    <>
      {/* opened only by a right click; the target's own click toggles the folder */}
      <Menu
        opened={menu}
        onChange={(opened) => {
          if (!opened) setMenu(false);
        }}
        position='right-start'
        withinPortal
      >
        <Menu.Target>
          <div
            className='flex shrink-0 justify-center'
            onContextMenu={(event) => {
              event.preventDefault();
              setMenu(true);
            }}
          >
            {folder}
          </div>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>{group.name}</Menu.Label>
          <Menu.Item leftSection={<FontAwesomeIcon icon={faPen} />} onClick={() => setDialog('rename')}>
            {t('shell.renameGroup', {})}
          </Menu.Item>
          <Menu.Item
            color='red'
            leftSection={<FontAwesomeIcon icon={faFolderMinus} />}
            onClick={() => setDialog('ungroup')}
          >
            {t('shell.ungroup', {})}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      {dialog === 'rename' && (
        <RenameModal group={group} onClose={() => setDialog(null)} onRename={(name) => edits.rename(group, name)} />
      )}
      <ConfirmationModal
        opened={dialog === 'ungroup'}
        onClose={() => setDialog(null)}
        title={t('shell.ungroupTitle', { name: group.name })}
        confirm={t('shell.ungroup', {})}
        onConfirmed={async () => {
          setDialog(null);
          await edits.ungroup(group);
        }}
      >
        {t('shell.ungroupBody', {})}
      </ConfirmationModal>
    </>
  );
}

function RenameModal({
  group,
  onClose,
  onRename,
}: {
  group: RailGroup;
  onClose: () => void;
  onRename: (name: string) => Promise<void>;
}) {
  const { t } = useExtTranslations();
  const [name, setName] = useState(group.name);
  const trimmed = name.trim();
  // core's limits on a group name, in characters
  const valid = [...trimmed].length >= 2 && [...trimmed].length <= 31;

  const save = () => {
    if (!valid) return;
    onClose();
    if (trimmed !== group.name) void onRename(trimmed);
  };

  return (
    <Modal opened onClose={onClose} title={t('shell.renameTitle', { name: group.name })}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <TextInput
          label={t('shell.groupName', {})}
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          error={trimmed && !valid ? t('shell.groupNameLength', {}) : undefined}
          data-autofocus
        />
        <ModalFooter>
          <Button variant='default' onClick={onClose}>
            {t('shell.cancel', {})}
          </Button>
          <Button type='submit' disabled={!valid}>
            {t('shell.save', {})}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

/** Picks the deepest target under the pointer: a server or folder before the free space around it. */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const specific = hits.filter((hit) => hit.id !== LOOSE_ID);
  return specific.length > 0 ? specific : hits;
};

/** A drag ends with a mouseup over a tile, whose click would follow the link; this eats that one click. */
function swallowNextClick() {
  const stop = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
  window.addEventListener('click', stop, { capture: true, once: true });
  setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 0);
}

/**
 * The folders and loose servers, with Discord's drag and drop: a server onto a loose one makes a folder, onto a
 * folder moves it in, onto free space takes it out of its folder. A mouse drags after 6px; a finger after a 250ms
 * press, so a swipe still scrolls.
 */
function RailServers({ current, signedIn }: { current: string | null; signedIn: boolean }) {
  const { user } = useAuth();
  const groups = useUserStore((state) => state.serverGroups);
  const setServerGroups = useUserStore((state) => state.setServerGroups);
  const edits = useGroupEdits();
  const [dragging, setDragging] = useState<DragData | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
  );
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

  const onDragStart = ({ active }: DragStartEvent) => setDragging((active.data.current as DragData) ?? null);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    swallowNextClick();
    const drag = active.data.current as DragData | undefined;
    const target = over?.data.current as RailDropTarget | undefined;
    if (!drag || !target) return;
    const action = dropAction(drag, target, useUserStore.getState().serverGroups);
    if (action) void edits.drop(action, drag.serverUuid);
  };

  const ghost = dragging && serverTile(dragging.server.name);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <LooseZone dragging={dragging}>
        {[...groups]
          .sort((a, b) => a.order - b.order)
          .map((group) => (
            <RailFolder
              key={group.uuid}
              group={group}
              open={openFolders.includes(group.uuid)}
              current={current}
              onToggle={() => toggleFolder(group.uuid)}
              edits={edits}
            />
          ))}
        {/* until the groups load, a grouped server can't be told from a loose one */}
        {groupsQuery.status !== 'pending' &&
          looseServers(servers.data?.data ?? [], groups, RAIL_SERVERS).map((server) => (
            <ServerButton key={server.uuid} server={server} current={current} from={null} />
          ))}
      </LooseZone>
      {/* on body, so the drawer's transform can't offset it */}
      {createPortal(
        <DragOverlay dropAnimation={null}>
          {ghost && (
            <div className='xylo-rail-btn xylo-rail-server xylo-rail-ghost' style={{ background: ghost.background }}>
              <span className='text-sm font-semibold text-white'>{ghost.initials}</span>
            </div>
          )}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}

/** The scrolling list, which is also the free space a server leaves its folder through. */
function LooseZone({ dragging, children }: { dragging: DragData | null; children: ReactNode }) {
  const drop = useRailDrop(LOOSE_ID, { kind: 'loose' });
  return (
    <div
      ref={drop.ref}
      className='xylo-rail-servers flex min-h-0 w-full flex-1 flex-col items-center gap-2 overflow-y-auto py-1'
      data-dragging={dragging !== null || undefined}
      data-drop={drop.lit || undefined}
    >
      {children}
    </div>
  );
}

const AREAS: { area: Area; to: string; icon: IconDefinition; label: 'shell.home' | 'shell.admin'; admin: boolean }[] = [
  { area: 'home', to: '/', icon: faHouse, label: 'shell.home', admin: false },
  { area: 'admin', to: '/admin', icon: faShieldHalved, label: 'shell.admin', admin: true },
];

export function Rail({ area, collapsed, onToggle }: { area: Area; collapsed?: boolean; onToggle?: () => void }) {
  const { t } = useExtTranslations();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const setQuickActionsOpen = useQuickActionsStore((state) => state.setOpen);
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

      <RailServers current={current} signedIn={!!user && !user.suspended} />

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
