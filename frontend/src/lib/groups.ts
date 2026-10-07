import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { GROUP_MAX, orderGroupServers, type RailGroup } from '../elements/shell/folders.ts';
import { getServerGroupServers, getServerGroups, queryKeys, useAuth, useUserStore } from './core.ts';

/**
 * Loads the user's server groups into core's store, which the dashboard's grouped tab edits in place, so a new,
 * renamed, reordered or deleted group shows wherever Zoron reads the store (the rail, the servers page) at once.
 * Every caller shares the one query. Returns whether the groups have loaded (or failed to).
 */
export function useLoadServerGroups(): boolean {
  const { user } = useAuth();
  const setServerGroups = useUserStore((state) => state.setServerGroups);
  const query = useQuery({
    queryKey: ['zoron', 'rail-groups', user?.uuid],
    queryFn: async () => {
      const result = await getServerGroups();
      setServerGroups(result);
      return result;
    },
    enabled: !!user && !user.suspended,
    staleTime: 60_000,
  });
  return query.status !== 'pending';
}

/**
 * A group's servers in the group's order. Under core's key for the group, so the dashboard's moves (which invalidate
 * it) refresh it too; the members in the key fetch it again when a server is added or removed. `loaded` stays false
 * until the first answer.
 */
export function useGroupServers(group: RailGroup | null) {
  const members = group?.serverOrder ?? [];
  const query = useQuery({
    queryKey: [...queryKeys.user.servers.all(), group?.uuid, 'zoron-rail', [...members].sort().join(',')],
    queryFn: () => getServerGroupServers(group?.uuid ?? '', 1, undefined, GROUP_MAX),
    enabled: !!group && members.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  return { servers: orderGroupServers(query.data?.data ?? [], members), loaded: query.data !== undefined };
}
