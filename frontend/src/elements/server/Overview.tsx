import { faChevronRight, faClock, faGamepad, faServer, faTerminal } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQuery } from '@tanstack/react-query';
import { type FC, Fragment, type ReactNode, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Avatar,
  Button,
  Card,
  formatMilliseconds,
  getAllocations,
  getBackups,
  getSchedules,
  getServerActivity,
  queryKeys,
  ServerContentContainer,
  ServerPowerControls,
  useServerCan,
  useServerStore,
} from '../../lib/core.ts';
import { useXyloTheme } from '../../lib/store.ts';
import type { OverviewSection } from '../../lib/theme.ts';
import { useExtTranslations } from '../../translations.ts';
import { addressOf, phaseOf } from '../home/home.ts';
import { TileButton } from '../tiles/TileEditor.tsx';
import { useServerTile } from '../tiles/useTiles.ts';
import { eventLabel, newest, overviewRows, timeAgo } from './overview.ts';
import { ConnectDetails, Section, StatusChip, UsageStrip } from './parts.tsx';

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
 * (address, SFTP, the ID); and backups, schedules and addresses at a glance. The theme picks the blocks, their order
 * and layout, the usage style, how much activity, the head and the description. Each block needs the permission its
 * page needs and is left out without it.
 */
function Overview() {
  const { t, language } = useExtTranslations();
  const theme = useXyloTheme();
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

  // the blocks the theme lists and the visitor may see, in the theme's order
  const allowed: Record<OverviewSection, boolean> = {
    usage: true,
    activity: canActivity,
    connect: true,
    glance: canBackups || canSchedules || canAllocations,
  };
  const blocks = theme.overviewSections.filter((block) => allowed[block]);
  const glance = blocks.includes('glance');

  // under core's keys, so what core's own pages change (a new backup, a deleted schedule) refreshes these too
  const activity = useQuery({
    queryKey: [...keys.activity.all(null), 'xylo-overview'],
    queryFn: () => getServerActivity(server.uuid, null, 1),
    enabled: blocks.includes('activity'),
  });
  const backups = useQuery({
    queryKey: [...keys.backups.all(), 'xylo-overview'],
    queryFn: () => getBackups(server.uuid, 1),
    enabled: glance && canBackups,
  });
  const schedules = useQuery({
    queryKey: [...keys.schedules.all(), 'xylo-overview'],
    queryFn: () => getSchedules(server.uuid, 1, undefined, 100),
    enabled: glance && canSchedules,
  });
  const allocations = useQuery({
    queryKey: [...keys.network.all(), 'xylo-overview'],
    queryFn: () => getAllocations(server.uuid, 1),
    enabled: glance && canAllocations,
  });

  const phase = phaseOf(server, { state });
  const live = phase === 'running' || phase === 'starting';
  const ago = (date: Date) => timeAgo(date, now, language);
  const address = addressOf(server);
  const banner = theme.overviewHeader === 'banner';
  const tile = useServerTile(server);

  const lastBackup = newest(backups.data?.data ?? [], (backup) => backup.completed ?? backup.created);
  const lastRun = newest(schedules.data?.data ?? [], (schedule) => schedule.lastRun);
  const activeSchedules = (schedules.data?.data ?? []).filter((schedule) => schedule.enabled).length;
  const countOf = (count: number, limit: number) =>
    limit > 0 ? t('overview.countOf', { count: `${count}`, limit: `${limit}` }) : `${count}`;

  const header = (
    <header className='xylo-ov-head flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
      <div className='flex min-w-0 items-start gap-4'>
        <TileButton server={server} size={banner ? 56 : 40} />
        <div className='min-w-0'>
          <div className='flex flex-wrap items-center gap-3'>
            <h1 className='truncate text-2xl font-semibold tracking-tight sm:text-3xl'>{tile.label}</h1>
            <StatusChip phase={phase} />
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
              <span className='inline-flex items-center gap-1.5 tabular-nums'>
                <FontAwesomeIcon icon={faClock} className='opacity-60' />
                {t('overview.uptime', { time: formatMilliseconds(stats.uptime, true, false) })}
              </span>
            )}
          </p>
          {theme.overviewDescription && server.description && (
            <p className='mt-3 max-w-[65ch] text-sm text-pretty'>{server.description}</p>
          )}
        </div>
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
  );

  const content: Record<OverviewSection, ReactNode> = {
    // keyed by the server, so another server's graphs start their own minute
    usage: <UsageStrip key={server.uuid} usage={theme.overviewUsage} />,
    activity: (
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
            {activity.data?.data.slice(0, theme.overviewActivityCount).map((entry) => (
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
                    {entry.user?.username ?? (entry.isSchedule ? t('overview.schedule', {}) : t('overview.system', {}))}
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
    ),
    connect: (
      <Section title={t('overview.connect', {})}>
        <ConnectDetails />
      </Section>
    ),
    glance: (
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
    ),
  };

  return (
    <ServerContentContainer title={t('overview.title', {})} hideTitleComponent>
      <div className='xylo-ov flex flex-col gap-5' data-layout={theme.overviewLayout}>
        {banner ? <Card className='xylo-ov-banner'>{header}</Card> : header}

        {overviewRows(blocks, theme.overviewLayout).map((row) => (
          <div key={row.columns.flat().join()} className='xylo-ov-grid' data-kind={row.kind}>
            {row.columns.map((column) => (
              <div key={column.join()} className='flex min-w-0 flex-col gap-4'>
                {column.map((block) => (
                  <Fragment key={block}>{content[block]}</Fragment>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </ServerContentContainer>
  );
}
