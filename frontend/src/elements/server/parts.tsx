import { faArrowUpRightFromSquare, faCopy } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { ReactNode } from 'react';
import { bytesToString, Card, CopyOnClick, mbToBytes, useAuth, useServerStore } from '../../lib/core.ts';
import { useExtTranslations } from '../../translations.ts';
import { addressOf, type Phase, phaseOf } from '../home/home.ts';
import { levelOf, percentOf } from './overview.ts';

/** The pieces the server overview and the console page share. */

/** The server's state as a tinted chip with a dot in its colour. */
export function StatusChip({ phase }: { phase: Phase }) {
  const { t } = useExtTranslations();
  return (
    <span className='xylo-status' data-phase={phase}>
      <span className='xylo-status-dot' />
      {t(`home.${phase}`, {})}
    </span>
  );
}

/** A card with a heading and an optional link on the right of it. */
export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card className='xylo-ov-section'>
      <div className='flex items-center justify-between gap-3'>
        <h2 className='text-base font-semibold tracking-tight'>{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

/** A labelled value people copy (address, SFTP host, username, ID); a click copies it. */
function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className='xylo-ov-row'>
      <span className='text-xs text-(--mantine-color-dimmed)'>{label}</span>
      <CopyOnClick content={value} className='xylo-ov-copy'>
        <span className='truncate'>{value}</span>
        <FontAwesomeIcon icon={faCopy} className='shrink-0 opacity-50' />
      </CopyOnClick>
    </div>
  );
}

/** How to reach the server: its address, SFTP host and username, its ID, and an SFTP link. */
export function ConnectDetails() {
  const { t } = useExtTranslations();
  const { user } = useAuth();
  const server = useServerStore((state) => state.server);
  const address = addressOf(server);
  const sftpUser = user ? `${user.username}.${server.uuidShort}` : null;

  return (
    <div className='flex flex-col gap-3'>
      {address ? (
        <CopyRow label={t('overview.address', {})} value={address} />
      ) : (
        <div className='xylo-ov-row'>
          <span className='text-xs text-(--mantine-color-dimmed)'>{t('overview.address', {})}</span>
          <span className='text-sm text-(--mantine-color-dimmed)'>{t('overview.noAddress', {})}</span>
        </div>
      )}
      <CopyRow label={t('overview.sftp', {})} value={`${server.sftpHost}:${server.sftpPort}`} />
      {sftpUser && <CopyRow label={t('overview.username', {})} value={sftpUser} />}
      <CopyRow label={t('overview.serverId', {})} value={server.uuidShort} />
      {sftpUser && (
        <a
          href={`sftp://${sftpUser}@${server.sftpHost}:${server.sftpPort}`}
          className='xylo-ov-link inline-flex items-center gap-1.5'
        >
          {t('overview.openSftp', {})}
          <FontAwesomeIcon icon={faArrowUpRightFromSquare} className='text-[0.7em]' />
        </a>
      )}
    </div>
  );
}

/** One figure of the usage strip, with a bar when it has a limit. */
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
    <div className='xylo-stat'>
      <span className='text-sm text-(--mantine-color-dimmed)'>{label}</span>
      <span className='xylo-stat-value whitespace-nowrap font-semibold tabular-nums tracking-tight'>{value}</span>
      <span className='truncate text-xs text-(--mantine-color-dimmed)'>{detail}</span>
      {percent !== undefined && (
        <div className='xylo-meter' data-level={levelOf(percent)}>
          <div className='xylo-meter-track'>
            <div className='xylo-meter-fill' style={{ width: `${percent ?? 0}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Live CPU, memory, disk and network (received, sent) against the server's limits, from its websocket, in one card
 * split by hairlines. `compact` is the console page's lower strip.
 */
export function UsageStrip({ compact = false }: { compact?: boolean }) {
  const { t } = useExtTranslations();
  const server = useServerStore((state) => state.server);
  const state = useServerStore((state) => state.state);
  const stats = useServerStore((state) => state.stats);

  const phase = phaseOf(server, { state });
  const live = phase === 'running' || phase === 'starting';
  const ofLimit = (limit: number | null, format: (value: number) => string) =>
    limit === null ? t('overview.noLimit', {}) : t('overview.of', { total: format(limit) });

  const cpu = live ? (stats?.cpuAbsolute ?? 0) : 0;
  const memory = live ? (stats?.memoryBytes ?? 0) : 0;
  const disk = stats?.diskBytes ?? 0;
  const cpuLimit = server.limits.cpu > 0 ? server.limits.cpu : null;
  const memoryLimit = server.limits.memory > 0 ? mbToBytes(server.limits.memory) : null;
  const diskLimit = server.limits.disk > 0 ? mbToBytes(server.limits.disk) : null;

  return (
    <Card className='xylo-stats' data-compact={compact || undefined}>
      <Stat
        label={t('overview.cpu', {})}
        value={`${cpu.toFixed(1)}%`}
        detail={ofLimit(cpuLimit, (value) => `${value}%`)}
        percent={percentOf(cpu, cpuLimit)}
      />
      <Stat
        label={t('overview.memory', {})}
        value={bytesToString(memory, 1)}
        detail={ofLimit(memoryLimit, (value) => bytesToString(value, 0))}
        percent={percentOf(memory, memoryLimit)}
      />
      <Stat
        label={t('overview.disk', {})}
        value={bytesToString(disk, 1)}
        detail={ofLimit(diskLimit, (value) => bytesToString(value, 0))}
        percent={percentOf(disk, diskLimit)}
      />
      <Stat
        label={t('overview.network', {})}
        value={`↓ ${bytesToString(live ? (stats?.network.rxBytes ?? 0) : 0, 1)}`}
        detail={t('overview.sent', { amount: bytesToString(live ? (stats?.network.txBytes ?? 0) : 0, 1) })}
      />
    </Card>
  );
}
