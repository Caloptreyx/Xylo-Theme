import {
  faCheck,
  faCopy,
  faEllipsis,
  faFolderPlus,
  faPalette,
  faPlay,
  faRotateRight,
  faSkull,
  faStop,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { Link } from 'react-router';
import {
  ActionIcon,
  Card,
  ConfirmationModal,
  CopyOnClick,
  type CoreServer,
  type CoreServerUsage,
  formatMilliseconds,
  Menu,
  ServerAddGroupModal,
  Tooltip,
  useAuth,
  useBulkPowerActions,
} from '../../lib/core.ts';
import { useExtTranslations } from '../../translations.ts';
import { TileEditor } from '../tiles/TileEditor.tsx';
import { TileGlyph } from '../tiles/TileFace.tsx';
import { useServerTile } from '../tiles/useTiles.ts';
import { addressOf, type Phase, phaseOf } from './home.ts';

type PowerAction = 'start' | 'stop' | 'restart' | 'kill';
/**
 * A server on the servers page: its tile (the user's own look, lib/tiles.ts), name, game and status, its address
 * (click to copy), uptime, and power controls for what the user may do. A name of the user's own is the title, the
 * real one quiet beside the game. The name is the link, stretched over the card, so the controls on top stay real
 * buttons. A right click opens the menu.
 */
export default function ServerCard({
  server,
  usage,
  selected,
  selecting,
  onSelect,
}: {
  server: CoreServer;
  usage: CoreServerUsage | undefined;
  selected: boolean;
  /** Some server is selected, so every tile shows its check. */
  selecting: boolean;
  onSelect: (selected: boolean) => void;
}) {
  const { t } = useExtTranslations();
  const { user } = useAuth();
  const { handleBulkPowerAction, bulkActionLoading } = useBulkPowerActions();
  const [menu, setMenu] = useState(false);
  const [dialog, setDialog] = useState<'group' | 'kill' | 'tile' | null>(null);

  const phase: Phase = phaseOf(server, usage);
  const tile = useServerTile(server);
  const address = addressOf(server);
  const permissions = new Set([...server.permissions, ...(user?.role?.serverPermissions ?? [])]);
  const may = (permission: string) => permissions.has('*') || permissions.has(permission);
  // as core: no power while installing, restoring, transferring, suspended, or the node is in maintenance
  const blocked =
    !!server.status ||
    server.isSuspended ||
    server.isTransferring ||
    server.nodeMaintenanceEnabled ||
    !!bulkActionLoading;
  const state = usage?.state;
  const can: Record<PowerAction, boolean> = {
    start: may('control.start') && !blocked && state === 'offline',
    restart: may('control.restart') && !blocked && !!state && state !== 'offline',
    stop: may('control.stop') && !blocked && (state === 'running' || state === 'starting'),
    kill: may('control.stop') && !blocked && state === 'stopping',
  };
  const power = (action: PowerAction) => {
    if (action === 'kill') setDialog('kill');
    else void handleBulkPowerAction([server.uuid], action);
  };

  const powerButton = (action: PowerAction, icon: typeof faPlay, label: string, color?: string) => (
    <Tooltip label={label} key={action}>
      <ActionIcon
        variant='light'
        color={color}
        size='lg'
        aria-label={label}
        className='zoron-home-raise'
        loading={bulkActionLoading === action}
        onClick={() => power(action)}
      >
        <FontAwesomeIcon icon={icon} />
      </ActionIcon>
    </Tooltip>
  );

  return (
    <>
      <Card
        className='zoron-home-card cursor-pointer'
        data-phase={phase}
        data-selected={selected || undefined}
        onContextMenu={(event) => {
          event.preventDefault();
          setMenu(true);
        }}
      >
        <div className='flex items-start gap-3'>
          <button
            type='button'
            className='zoron-home-tile zoron-home-raise'
            data-selecting={selecting || undefined}
            aria-pressed={selected}
            aria-label={t('home.select', { name: tile.label })}
            style={{ background: tile.background }}
            onClick={() => onSelect(!selected)}
          >
            <span className='zoron-home-tile-initials'>
              <TileGlyph tile={tile} />
            </span>
            <span className='zoron-home-tile-check'>
              <FontAwesomeIcon icon={faCheck} />
            </span>
          </button>
          <div className='min-w-0 flex-1'>
            <Link to={`/server/${server.uuidShort}`} className='zoron-home-card-link'>
              {tile.label}
            </Link>
            <p className='flex items-center gap-1.5 truncate text-xs text-(--mantine-color-dimmed)'>
              {!server.isOwner && (
                <Tooltip label={t('home.shared', {})}>
                  <FontAwesomeIcon icon={faUsers} className='zoron-home-raise text-(--mantine-color-yellow-filled)' />
                </Tooltip>
              )}
              {tile.custom && <span className='truncate'>{server.name}</span>}
              {tile.custom && <span aria-hidden>·</span>}
              <span className='truncate'>{server.egg.name}</span>
            </p>
          </div>
          <span className='zoron-status' data-phase={phase}>
            <span className='zoron-status-dot' />
            {t(`home.${phase}`, {})}
          </span>
        </div>

        {address ? (
          <CopyOnClick content={address} className='zoron-home-address zoron-home-raise'>
            <FontAwesomeIcon icon={faCopy} className='opacity-60' />
            <span className='truncate'>{address}</span>
          </CopyOnClick>
        ) : (
          <span className='zoron-home-address' data-empty>
            {t('home.noAddress', {})}
          </span>
        )}

        <div className='mt-auto flex items-center gap-2 pt-1'>
          <span className='min-w-0 flex-1 truncate text-xs text-(--mantine-color-dimmed)'>
            {phase === 'running' && usage && usage.uptime > 0
              ? t('home.uptime', { time: formatMilliseconds(usage.uptime, true, false) })
              : null}
          </span>
          {can.start && powerButton('start', faPlay, t('home.start', {}), 'green')}
          {can.restart && powerButton('restart', faRotateRight, t('home.restart', {}))}
          {can.stop && powerButton('stop', faStop, t('home.stop', {}), 'red')}
          {can.kill && powerButton('kill', faSkull, t('home.kill', {}), 'red')}
          <Menu opened={menu} onChange={setMenu} position='bottom-end' withinPortal>
            <Menu.Target>
              <ActionIcon
                variant='subtle'
                color='gray'
                size='lg'
                aria-label={t('home.more', {})}
                className='zoron-home-raise'
              >
                <FontAwesomeIcon icon={faEllipsis} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>{tile.label}</Menu.Label>
              {can.start && (
                <Menu.Item leftSection={<FontAwesomeIcon icon={faPlay} />} onClick={() => power('start')}>
                  {t('home.start', {})}
                </Menu.Item>
              )}
              {can.restart && (
                <Menu.Item leftSection={<FontAwesomeIcon icon={faRotateRight} />} onClick={() => power('restart')}>
                  {t('home.restart', {})}
                </Menu.Item>
              )}
              {can.stop && (
                <Menu.Item color='red' leftSection={<FontAwesomeIcon icon={faStop} />} onClick={() => power('stop')}>
                  {t('home.stop', {})}
                </Menu.Item>
              )}
              {can.kill && (
                <Menu.Item color='red' leftSection={<FontAwesomeIcon icon={faSkull} />} onClick={() => power('kill')}>
                  {t('home.kill', {})}
                </Menu.Item>
              )}
              <Menu.Item leftSection={<FontAwesomeIcon icon={faFolderPlus} />} onClick={() => setDialog('group')}>
                {t('home.addToGroup', {})}
              </Menu.Item>
              <Menu.Item leftSection={<FontAwesomeIcon icon={faPalette} />} onClick={() => setDialog('tile')}>
                {t('tiles.customize', {})}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      </Card>

      <ServerAddGroupModal server={server} opened={dialog === 'group'} onClose={() => setDialog(null)} />
      {dialog === 'tile' && <TileEditor server={server} onClose={() => setDialog(null)} />}
      <ConfirmationModal
        opened={dialog === 'kill'}
        onClose={() => setDialog(null)}
        title={t('home.killTitle', { name: tile.label })}
        confirm={t('home.kill', {})}
        onConfirmed={async () => {
          setDialog(null);
          await handleBulkPowerAction([server.uuid], 'kill');
        }}
      >
        {t('home.killBody', {})}
      </ConfirmationModal>
    </>
  );
}
