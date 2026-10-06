import {
  faCheck,
  faCopy,
  faEllipsis,
  faFolderPlus,
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
  bytesToString,
  Card,
  ConfirmationModal,
  CopyOnClick,
  type CoreServer,
  type CoreServerUsage,
  formatMilliseconds,
  Menu,
  mbToBytes,
  ServerAddGroupModal,
  Tooltip,
  useAuth,
  useBulkPowerActions,
} from '../../lib/core.ts';
import { useExtTranslations } from '../../translations.ts';
import { serverTile } from '../shell/folders.ts';
import { addressOf, type Phase, percentOf, phaseOf } from './home.ts';

type PowerAction = 'start' | 'stop' | 'restart' | 'kill';

/** A usage bar's level: calm below 80%, warning to 95%, then danger, as core colours usage. */
function levelOf(percent: number | null) {
  if (percent === null || percent < 80) return undefined;
  return percent < 95 ? 'warn' : 'danger';
}

/** One usage bar: what is used, against the limit when there is one. */
function Meter({ label, used, limit, text }: { label: string; used: number; limit: number | null; text: string }) {
  const percent = percentOf(used, limit);
  return (
    <div className='xylo-meter' data-level={levelOf(percent)}>
      <div className='flex items-baseline justify-between gap-2 text-xs'>
        <span className='text-(--mantine-color-dimmed)'>{label}</span>
        <span className='truncate tabular-nums'>{text}</span>
      </div>
      <div className='xylo-meter-track'>
        <div className='xylo-meter-fill' style={{ width: `${percent ?? (used > 0 ? 100 : 0)}%` }} />
      </div>
    </div>
  );
}

/**
 * A server on the servers page: its tile, name, game and status, its address (click to copy), live CPU, memory and
 * disk against its limits, and power controls for what the user may do. The name is the link, stretched over the
 * card, so the controls on top stay real buttons. A right click opens the menu.
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
  const [dialog, setDialog] = useState<'group' | 'kill' | null>(null);

  const phase: Phase = phaseOf(server, usage);
  const tile = serverTile(server.name);
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

  const live = phase === 'running' || phase === 'starting';
  const cpuLimit = server.limits.cpu > 0 ? server.limits.cpu : null;
  const memoryLimit = server.limits.memory > 0 ? mbToBytes(server.limits.memory) : null;
  const diskLimit = server.limits.disk > 0 ? mbToBytes(server.limits.disk) : null;
  const cpu = live ? (usage?.cpuAbsolute ?? 0) : 0;
  const memory = live ? (usage?.memoryBytes ?? 0) : 0;
  const disk = usage?.diskBytes ?? 0;
  const ofLimit = (used: string, limit: string | null) => `${used} / ${limit ?? t('home.unlimited', {})}`;

  const powerButton = (action: PowerAction, icon: typeof faPlay, label: string, color?: string) => (
    <Tooltip label={label} key={action}>
      <ActionIcon
        variant='light'
        color={color}
        size='lg'
        aria-label={label}
        className='xylo-home-raise'
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
        className='xylo-home-card cursor-pointer'
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
            className='xylo-home-tile xylo-home-raise'
            data-selecting={selecting || undefined}
            aria-pressed={selected}
            aria-label={t('home.select', { name: server.name })}
            style={{ background: tile.background }}
            onClick={() => onSelect(!selected)}
          >
            <span className='xylo-home-tile-initials'>{tile.initials}</span>
            <span className='xylo-home-tile-check'>
              <FontAwesomeIcon icon={faCheck} />
            </span>
          </button>
          <div className='min-w-0 flex-1'>
            <Link to={`/server/${server.uuidShort}`} className='xylo-home-card-link'>
              {server.name}
            </Link>
            <p className='flex items-center gap-1.5 truncate text-xs text-(--mantine-color-dimmed)'>
              {!server.isOwner && (
                <Tooltip label={t('home.shared', {})}>
                  <FontAwesomeIcon icon={faUsers} className='xylo-home-raise text-(--mantine-color-yellow-filled)' />
                </Tooltip>
              )}
              <span className='truncate'>{server.egg.name}</span>
            </p>
          </div>
          <span className='xylo-status' data-phase={phase}>
            <span className='xylo-status-dot' />
            {t(`home.${phase}`, {})}
          </span>
        </div>

        {address ? (
          <CopyOnClick content={address} className='xylo-home-address xylo-home-raise'>
            <FontAwesomeIcon icon={faCopy} className='opacity-60' />
            <span className='truncate'>{address}</span>
          </CopyOnClick>
        ) : (
          <span className='xylo-home-address' data-empty>
            {t('home.noAddress', {})}
          </span>
        )}

        <div className='xylo-home-meters'>
          <Meter
            label={t('home.cpu', {})}
            used={cpu}
            limit={cpuLimit}
            text={ofLimit(`${cpu.toFixed(1)}%`, cpuLimit === null ? null : `${cpuLimit}%`)}
          />
          <Meter
            label={t('home.memory', {})}
            used={memory}
            limit={memoryLimit}
            text={ofLimit(bytesToString(memory, 1), memoryLimit === null ? null : bytesToString(memoryLimit, 0))}
          />
          <Meter
            label={t('home.disk', {})}
            used={disk}
            limit={diskLimit}
            text={ofLimit(bytesToString(disk, 1), diskLimit === null ? null : bytesToString(diskLimit, 0))}
          />
        </div>

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
                className='xylo-home-raise'
              >
                <FontAwesomeIcon icon={faEllipsis} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>{server.name}</Menu.Label>
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
            </Menu.Dropdown>
          </Menu>
        </div>
      </Card>

      <ServerAddGroupModal server={server} opened={dialog === 'group'} onClose={() => setDialog(null)} />
      <ConfirmationModal
        opened={dialog === 'kill'}
        onClose={() => setDialog(null)}
        title={t('home.killTitle', { name: server.name })}
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
