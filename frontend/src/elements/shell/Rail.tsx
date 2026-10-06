import {
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  DragOverlay,
  type DragStartEvent,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  type UniqueIdentifier,
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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type CSSProperties, createContext, type ReactNode, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router';
import {
  Avatar,
  Button,
  ConfirmationModal,
  createServerGroup,
  deleteServerGroup,
  getServers,
  httpErrorToHuman,
  isAdmin,
  Menu,
  Modal,
  ModalFooter,
  TextInput,
  Tooltip,
  updateServerGroup,
  updateServerGroupsOrder,
  useAuth,
  useGlobalStore,
  useQuickActionsStore,
  useToast,
  useUserStore,
} from '../../lib/core.ts';
import { useGroupServers, useLoadServerGroups } from '../../lib/groups.ts';
import { useExtTranslations } from '../../translations.ts';
import {
  type DropPart,
  dropAction,
  dropPart,
  FOLDER_PREVIEW,
  FOLDERS_KEY,
  folderColor,
  looseServers,
  parseOpenFolders,
  type RailDrag,
  type RailDropAction,
  type RailDropTarget,
  type RailGroup,
  type RailServer,
  serverTile,
} from './folders.ts';
import type { Area } from './nav.ts';

/** The fields of core's server list entries the rail reads. */
type Server = RailServer & { uuidShort: string; isSuspended: boolean };
/** What a dragged tile carries: the drag, and the name its floating copy is drawn from. */
type DragData = { drag: RailDrag; name: string };

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

/** The target under the pointer and the part of it, while a drop there would do something. */
type Hover = { id: UniqueIdentifier; part: DropPart } | null;
const HoverContext = createContext<Hover>(null);

/** A drop target; `part` says where a drop would land while one is over it. */
function useRailDrop(id: string, target: RailDropTarget) {
  const hover = useContext(HoverContext);
  const { setNodeRef } = useDroppable({ id, data: target });
  return { ref: setNodeRef, part: hover?.id === id ? hover.part : undefined };
}

/** A server's tile, draggable. Loose, it is a target that makes a folder of the two; in a folder, a place in it. */
function ServerButton({ server, current, from }: { server: Server; current: string | null; from: string | null }) {
  const tile = serverTile(server.name);
  const data: DragData = { drag: { kind: 'server', serverUuid: server.uuid, from }, name: server.name };
  const drag = useDraggable({ id: `${from ?? 'loose'}:${server.uuid}`, data });
  const drop = useRailDrop(
    from ? `member:${from}:${server.uuid}` : `server:${server.uuid}`,
    from ? { kind: 'member', groupUuid: from, serverUuid: server.uuid } : { kind: 'server', serverUuid: server.uuid },
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
      data-drop={drop.part}
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
  apply: (action: RailDropAction) => Promise<void>;
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
  const setGroupOrder = (order: string[]) => {
    const { serverGroups, setServerGroups } = useUserStore.getState();
    setServerGroups(serverGroups.map((group) => ({ ...group, order: order.indexOf(group.uuid) })));
    return updateServerGroupsOrder(order);
  };
  const remove = (group: RailGroup) => {
    const { serverGroups, setServerGroups } = useUserStore.getState();
    setServerGroups(serverGroups.filter((other) => other.uuid !== group.uuid));
    return deleteServerGroup(group.uuid);
  };

  return {
    /** A drop. A folder emptied by one goes, as on Discord. */
    apply: (action: RailDropAction) =>
      run(async () => {
        if (action.kind === 'groups') return setGroupOrder(action.order);
        if (action.kind === 'create') {
          const before = [...useUserStore.getState().serverGroups].sort((a, b) => a.order - b.order);
          const group = await createServerGroup({ name: t('shell.newGroup', {}), serverOrder: action.serverOrder });
          useUserStore.getState().addServerGroup(group);
          // core starts a new group at order 0; it belongs after the others, next to the loose servers it came from
          if (before.length > 0) await setGroupOrder([...before.map((other) => other.uuid), group.uuid]);
        } else if (action.to) {
          await setOrder(action.to, action.serverOrder);
        }
        // a reorder within one folder has nothing to take out
        if (!action.from || (action.kind === 'move' && action.from === action.to)) return;
        const source = useUserStore.getState().serverGroups.find((group) => group.uuid === action.from);
        if (!source) return;
        const rest = source.serverOrder.filter((uuid) => uuid !== action.serverUuid);
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
 * page shows one of them; open, its servers on a tinted pill under the folder's head. Either is a drop target and
 * draggable (by the head when open) to reorder the folders. A right click, or a finger held on it and let go, opens
 * its menu (rename, ungroup). Empty groups are left out.
 */
function RailFolder({
  group,
  open,
  current,
  menu,
  onMenu,
  onToggle,
  edits,
}: {
  group: RailGroup;
  open: boolean;
  current: string | null;
  menu: boolean;
  onMenu: (open: boolean) => void;
  onToggle: () => void;
  edits: GroupEdits;
}) {
  const { t } = useExtTranslations();
  const [dialog, setDialog] = useState<'rename' | 'ungroup' | null>(null);
  const drop = useRailDrop(`folder:${group.uuid}`, { kind: 'folder', groupUuid: group.uuid });
  const data: DragData = { drag: { kind: 'folder', groupUuid: group.uuid }, name: group.name };
  const drag = useDraggable({ id: `folder:${group.uuid}`, data });
  const { servers, loaded } = useGroupServers(group);
  if (group.serverOrder.length === 0 || (loaded && servers.length === 0)) return null;

  const color = folderColor(group.name);
  const folder = open ? (
    <div ref={drop.ref} className='xylo-rail-folder-open' data-drop={drop.part}>
      <div
        ref={drag.setNodeRef}
        {...drag.listeners}
        className='xylo-rail-drag'
        data-dragging={drag.isDragging || undefined}
      >
        <RailButton label={group.name} onClick={onToggle} expanded quiet={menu} className='xylo-rail-folder-head'>
          <FontAwesomeIcon icon={faFolderOpen} style={{ color }} />
        </RailButton>
      </div>
      {servers.map((server) => (
        <ServerButton key={server.uuid} server={server} current={current} from={group.uuid} />
      ))}
    </div>
  ) : (
    <div
      ref={(node) => {
        drag.setNodeRef(node);
        drop.ref(node);
      }}
      {...drag.listeners}
      className='xylo-rail-drag'
      data-dragging={drag.isDragging || undefined}
      data-drop={drop.part}
    >
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
      {/* opened only by a right click or a held finger; the target's own click toggles the folder */}
      <Menu
        opened={menu}
        onChange={(opened) => {
          if (!opened) onMenu(false);
        }}
        position='right-start'
        withinPortal
      >
        <Menu.Target>
          <div
            className='flex shrink-0 justify-center'
            onContextMenu={(event) => {
              event.preventDefault();
              onMenu(true);
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

/** Which targets win when the pointer is over several: a server before the folder around it, before free space. */
const RANK: Record<RailDropTarget['kind'], number> = { server: 0, member: 0, folder: 1, loose: 2 };

/** The best ranked targets under the pointer; a folder being dragged only looks at other folders. */
const collision: CollisionDetection = (args) => {
  // set by useDraggable in this file
  const data = args.active.data.current as DragData | undefined;
  const ranked = pointerWithin(args).flatMap((hit) => {
    // set by useDroppable in this file
    const target = args.droppableContainers.find((container) => container.id === hit.id)?.data.current as
      | RailDropTarget
      | undefined;
    if (!target || (data?.drag.kind === 'folder' && target.kind !== 'folder')) return [];
    return [{ hit, rank: RANK[target.kind] }];
  });
  const best = Math.min(...ranked.map((entry) => entry.rank));
  return ranked.filter((entry) => entry.rank === best).map((entry) => entry.hit);
};

/** The finger that started a drag, or null when a mouse did. */
function touchOf(event: Event): Touch | null {
  return typeof TouchEvent !== 'undefined' && event instanceof TouchEvent ? (event.touches[0] ?? null) : null;
}

/** Where a drop lands: the target, the part of it under the pointer, and what it does there. */
function resolveDrop({ active, over, delta, activatorEvent }: DragMoveEvent) {
  // set by useDraggable and useDroppable in this file
  const data = active.data.current as DragData | undefined;
  const target = over?.data.current as RailDropTarget | undefined;
  if (!data || !over || !target) return null;
  const startY =
    touchOf(activatorEvent)?.clientY ?? (activatorEvent instanceof MouseEvent ? activatorEvent.clientY : 0);
  const part = dropPart(data.drag, target, (startY + delta.y - over.rect.top) / over.rect.height);
  const action = dropAction(data.drag, target, part, useUserStore.getState().serverGroups);
  return action && { id: over.id, part, action };
}

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
 * folder moves it in, between the servers of an open folder takes that place, onto free space takes it out of its
 * folder; a folder dragged between folders reorders them. A mouse drags after 6px; a finger after a 250ms press, so
 * a swipe still scrolls.
 */
function RailServers({ current, signedIn }: { current: string | null; signedIn: boolean }) {
  const { user } = useAuth();
  const groups = useUserStore((state) => state.serverGroups);
  const groupsLoaded = useLoadServerGroups();
  const edits = useGroupEdits();
  const [dragging, setDragging] = useState<DragData | null>(null);
  const [hover, setHover] = useState<Hover>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
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

  const onDragStart = ({ active }: DragStartEvent) => {
    // set by useDraggable in this file
    const data = active.data.current as DragData | undefined;
    setDragging(data ?? null);
    setMenuFor(null);
  };
  const onDragMove = (event: DragMoveEvent) => {
    const drop = resolveDrop(event);
    if (drop?.id !== hover?.id || drop?.part !== hover?.part) setHover(drop && { id: drop.id, part: drop.part });
  };
  const onDragEnd = (event: DragEndEvent) => {
    const drop = resolveDrop(event);
    setDragging(null);
    setHover(null);
    swallowNextClick();
    // set by useDraggable in this file
    const data = event.active.data.current as DragData | undefined;
    // a finger held on a folder and let go where it was opens the folder's menu, the touch right click
    if (data?.drag.kind === 'folder' && touchOf(event.activatorEvent) && Math.hypot(event.delta.x, event.delta.y) < 8) {
      setMenuFor(data.drag.groupUuid);
      return;
    }
    if (drop) void edits.apply(drop.action);
  };
  const onDragCancel = () => {
    setDragging(null);
    setHover(null);
  };

  const ghostTile = dragging?.drag.kind === 'server' ? serverTile(dragging.name) : null;
  const ghostColor = dragging?.drag.kind === 'folder' ? folderColor(dragging.name) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      // `over` changes after the move that caused it; this catches the pointer resting on a new target
      onDragOver={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <HoverContext.Provider value={hover}>
        <LooseZone dragging={dragging !== null}>
          {[...groups]
            .sort((a, b) => a.order - b.order)
            .map((group) => (
              <RailFolder
                key={group.uuid}
                group={group}
                open={openFolders.includes(group.uuid)}
                current={current}
                menu={menuFor === group.uuid}
                onMenu={(open) => setMenuFor(open ? group.uuid : null)}
                onToggle={() => toggleFolder(group.uuid)}
                edits={edits}
              />
            ))}
          {/* until the groups load, a grouped server can't be told from a loose one */}
          {groupsLoaded &&
            looseServers(servers.data?.data ?? [], groups, RAIL_SERVERS).map((server) => (
              <ServerButton key={server.uuid} server={server} current={current} from={null} />
            ))}
        </LooseZone>
      </HoverContext.Provider>
      {/* on body, so the drawer's transform can't offset it */}
      {createPortal(
        <DragOverlay dropAnimation={null}>
          {ghostTile && (
            <div
              className='xylo-rail-btn xylo-rail-server xylo-rail-ghost'
              style={{ background: ghostTile.background }}
            >
              <span className='text-sm font-semibold text-white'>{ghostTile.initials}</span>
            </div>
          )}
          {ghostColor && (
            <div
              className='xylo-rail-btn xylo-rail-folder xylo-rail-ghost'
              style={{ background: `color-mix(in srgb, ${ghostColor} 28%, transparent)` }}
            >
              <FontAwesomeIcon icon={faFolderOpen} style={{ color: ghostColor }} />
            </div>
          )}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}

/** The scrolling list, which is also the free space a server leaves its folder through. */
function LooseZone({ dragging, children }: { dragging: boolean; children: ReactNode }) {
  const drop = useRailDrop(LOOSE_ID, { kind: 'loose' });
  return (
    <div
      ref={drop.ref}
      className='xylo-rail-servers flex min-h-0 w-full flex-1 flex-col items-center gap-2 overflow-y-auto py-1'
      data-dragging={dragging || undefined}
      data-drop={drop.part}
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
