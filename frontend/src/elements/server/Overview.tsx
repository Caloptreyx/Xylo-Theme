import {
  faArrowUpRightFromSquare,
  faChevronRight,
  faClock,
  faCopy,
  faGamepad,
  faServer,
  faTerminal,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQuery } from '@tanstack/react-query';
import { type FC, type ReactNode, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Avatar,
  Button,
  bytesToString,
  Card,
  CopyOnClick,
  formatMilliseconds,
  getAllocations,
  getBackups,
  getSchedules,
  getServerActivity,
  mbToBytes,
  queryKeys,
  ServerContentContainer,
  ServerPowerControls,
  useAuth,
  useServerCan,
  useServerStore,
} from '../../lib/core.ts';
import { useXyloTheme } from '../../lib/store.ts';
import { useExtTranslations } from '../../translations.ts';
import { phaseOf } from '../home/home.ts';
import { eventLabel, levelOf, newest, percentOf, timeAgo } from './overview.ts';

/** How many activity entries the overview lists; the activity page has the rest. */
const ACTIVITY_ROWS = 8;

/**
 * The page a server opens on (route `/`). With `serverOverview` on it is Xylo's overview, else core's console, which
 * the interceptor in index.ts hands in; reading the theme here (not in the route) lets Studio switch it live.
 */
export function ServerHome({ Console }: { Console: FC }) {
  const theme = useXyloTheme();
  return theme.serverOverview ? <Overview /> : <Console />;
}

/** The clock relative times are measured against, ticking each minute so "3 minutes ago" moves on. */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/** One figure of the stat strip, with a bar when it has a limit. */
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
      <span className='whitespace-nowrap text-xl font-semibold tabular-nums tracking-tight sm:text-2xl'>{value}</span>
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

/** A card with a heading and an optional link on the right of it. */
function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
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

/** A row of the "at a glance" card: what, how many, a line about it, and a link to its page when allowed. */
function GlanceRow({ to, label, value, detail }: { to: string | null; label: string; value: string; detail: string }) {
  const body = (
    <>
      <div className='min-w-0 flex-1'>
        <span className='block text-sm font-medium'>{label}</span>
        <span className='block truncate text-xs text-(--mantine-color-dimmed)'>{detail}</span>
      </div>
      <span className='text-sm tabular-nums'>{value}</span>
      {to && <FontAwesomeIcon icon={faChevronRight} className='text-xs opacity-40' />}
    </>
  );
  return to ? (
    <Link to={to} className='xylo-ov-glance'>
      {body}
    </Link>
  ) : (
    <div className='xylo-ov-glance'>{body}</div>
  );
}

/**
 * Xylo's server overview: the server's name, status, game, node and uptime with core's own power controls and a way
 * to the console; live CPU, memory, disk and network from the server's websocket; recent activity; how to connect
 * (address, SFTP, the ID); and backups, schedules and addresses at a glance. Each part needs the permission its page
 * needs and is left out without it.
 */
function Overview() {
  const { t, language } = useExtTranslations();
  const { user } = useAuth();
  const server = useServerStore((state) => state.server);
  const state = useServerStore((state) => state.state);
  const stats = useServerStore((state) => state.stats);
  const now = useNow();
  const navigate = useNavigate();
  const canActivity = useServerCan('activity.read');
  const canBackups = useServerCan('backups.read');
  const canSchedules = useServerCan('schedules.read');
  const canAllocations = useServerCan('allocations.read');
  const keys = queryKeys.server(server.uuid);
  const base = `/server/${server.uuidShort}`;

  // under core's keys, so what core's own pages change (a new backup, a deleted schedule) refreshes these too
  const activity = useQuery({
    queryKey: [...keys.activity.all(null), 'xylo-overview'],
    queryFn: () => getServerActivity(server.uuid, null, 1),
    enabled: canActivity,
  });
  const backups = useQuery({
    queryKey: [...keys.backups.all(), 'xylo-overview'],
    queryFn: () => getBackups(server.uuid, 1),
    enabled: canBackups,
  });
  const schedules = useQuery({
    queryKey: [...keys.schedules.all(), 'xylo-overview'],
    queryFn: () => getSchedules(server.uuid, 1, undefined, 100),
    enabled: canSchedules,
  });
  const allocations = useQuery({
    queryKey: [...keys.network.all(), 'xylo-overview'],
    queryFn: () => getAllocations(server.uuid, 1),
    enabled: canAllocations,
  });

  const phase = phaseOf(server, { state });
  const live = phase === 'running' || phase === 'starting';
  const ago = (date: Date) => timeAgo(date, now, language);
  const ofLimit = (limit: number | null, format: (value: number) => string) =>
    limit === null ? t('overview.noLimit', {}) : t('overview.of', { total: format(limit) });

  const cpu = live ? (stats?.cpuAbsolute ?? 0) : 0;
  const memory = live ? (stats?.memoryBytes ?? 0) : 0;
  const disk = stats?.diskBytes ?? 0;
  const cpuLimit = server.limits.cpu > 0 ? server.limits.cpu : null;
  const memoryLimit = server.limits.memory > 0 ? mbToBytes(server.limits.memory) : null;
  const diskLimit = server.limits.disk > 0 ? mbToBytes(server.limits.disk) : null;
  const address = server.allocation
    ? `${server.allocation.ipAlias || server.allocation.ip}:${server.allocation.port}`
    : null;
  const sftpUser = user ? `${user.username}.${server.uuidShort}` : null;

  const lastBackup = newest(backups.data?.data ?? [], (backup) => backup.completed ?? backup.created);
  const lastRun = newest(schedules.data?.data ?? [], (schedule) => schedule.lastRun);
  const activeSchedules = (schedules.data?.data ?? []).filter((schedule) => schedule.enabled).length;
  const countOf = (count: number, limit: number) =>
    limit > 0 ? t('overview.countOf', { count: `${count}`, limit: `${limit}` }) : `${count}`;

  return (
    <ServerContentContainer title={t('overview.title', {})} hideTitleComponent>
      <div className='xylo-ov flex flex-col gap-5'>
        <header className='flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
          <div className='min-w-0'>
            <div className='flex flex-wrap items-center gap-3'>
              <h1 className='truncate text-2xl font-semibold tracking-tight sm:text-3xl'>{server.name}</h1>
              <span className='xylo-status' data-phase={phase}>
                <span className='xylo-status-dot' />
                {t(`home.${phase}`, {})}
              </span>
            </div>
            <p className='mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-(--mantine-color-dimmed)'>
              <span className='inline-flex items-center gap-1.5'>
                <FontAwesomeIcon icon={faGamepad} className='opacity-60' />
                {server.egg.name}
              </span>
              <span className='inline-flex items-center gap-1.5'>
                <FontAwesomeIcon icon={faServer} className='opacity-60' />
                {server.nodeName}
              </span>
              {live && stats && stats.uptime > 0 && (
                <span className='inline-flex items-center gap-1.5'>
                  <FontAwesomeIcon icon={faClock} className='opacity-60' />
                  {t('overview.uptime', { time: formatMilliseconds(stats.uptime, true, false) })}
                </span>
              )}
            </p>
            {server.description && <p className='mt-3 max-w-[65ch] text-sm text-pretty'>{server.description}</p>}
          </div>
          <div className='flex shrink-0 flex-wrap gap-2'>
            <Button
              variant='default'
              leftSection={<FontAwesomeIcon icon={faTerminal} />}
              onClick={() => navigate(`${base}/terminal`)}
            >
              {t('overview.console', {})}
            </Button>
            <ServerPowerControls />
          </div>
        </header>

        <Card className='xylo-stats'>
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

        <div className='xylo-ov-grid'>
          {canActivity && (
            <Section
              title={t('overview.activity', {})}
              action={
                <Link to={`${base}/activity`} className='xylo-ov-link'>
                  {t('overview.allActivity', {})}
                </Link>
              }
            >
              {activity.isLoading ? (
                <div className='flex flex-col gap-2'>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className='xylo-skeleton h-9 rounded-lg bg-(--mantine-color-default)' />
                  ))}
                </div>
              ) : (activity.data?.data.length ?? 0) === 0 ? (
                <p className='py-6 text-center text-sm text-(--mantine-color-dimmed)'>{t('overview.noActivity', {})}</p>
              ) : (
                <ul className='xylo-ov-activity'>
                  {activity.data?.data.slice(0, ACTIVITY_ROWS).map((entry) => (
                    <li key={`${entry.event}-${entry.created.getTime()}`}>
                      <Avatar
                        src={entry.user?.avatar ?? undefined}
                        name={entry.user?.username ?? undefined}
                        size={28}
                        radius='md'
                      />
                      <div className='min-w-0 flex-1'>
                        <span className='block truncate text-sm'>{eventLabel(entry.event)}</span>
                        <span className='block truncate text-xs text-(--mantine-color-dimmed)'>
                          {entry.user?.username ??
                            (entry.isSchedule ? t('overview.schedule', {}) : t('overview.system', {}))}
                        </span>
                      </div>
                      <time
                        dateTime={entry.created.toISOString()}
                        title={entry.created.toLocaleString(language || undefined)}
                        className='shrink-0 text-xs text-(--mantine-color-dimmed)'
                      >
                        {ago(entry.created)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          <div className='flex flex-col gap-4'>
            <Section title={t('overview.connect', {})}>
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
            </Section>

            {(canBackups || canSchedules || canAllocations) && (
              <Section title={t('overview.glance', {})}>
                <div className='flex flex-col'>
                  {canBackups && (
                    <GlanceRow
                      to={`${base}/backups`}
                      label={t('overview.backups', {})}
                      value={countOf(backups.data?.total ?? 0, server.featureLimits.backups)}
                      detail={
                        lastBackup
                          ? t('overview.lastBackup', { time: ago(lastBackup.completed ?? lastBackup.created) })
                          : t('overview.noBackups', {})
                      }
                    />
                  )}
                  {canSchedules && (
                    <GlanceRow
                      to={`${base}/schedules`}
                      label={t('overview.schedules', {})}
                      value={countOf(schedules.data?.total ?? 0, server.featureLimits.schedules)}
                      detail={
                        lastRun?.lastRun
                          ? t('overview.lastRun', { count: `${activeSchedules}`, time: ago(lastRun.lastRun) })
                          : t('overview.activeSchedules', { count: `${activeSchedules}` })
                      }
                    />
                  )}
                  {canAllocations && (
                    <GlanceRow
                      to={`${base}/network`}
                      label={t('overview.addresses', {})}
                      value={countOf(allocations.data?.total ?? 0, server.featureLimits.allocations)}
                      detail={address ?? t('overview.noAddress', {})}
                    />
                  )}
                </div>
              </Section>
            )}
          </div>
        </div>
      </div>
    </ServerContentContainer>
  );
}
