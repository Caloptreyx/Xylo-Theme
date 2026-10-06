/**
 * Every core (`@/`) import Xylo uses, so a core module move is a one-file edit here. Each path exists since panel
 * 1.2.0, the floor in Metadata.toml (check with `git show release-1.2.0:<path>` in a panel checkout).
 */

import type { z } from 'zod';
import type { serverResourceUsageSchema, serverSchema } from '@/lib/schemas/server/server.ts';

/** A server as core's server lists return it. */
export type CoreServer = z.infer<typeof serverSchema>;
/** A server's live resource usage, as core's store keeps it (`serverResourceUsage`). */
export type CoreServerUsage = z.infer<typeof serverResourceUsageSchema>;

export { axiosInstance, httpErrorToHuman } from '@/api/axios.ts';
export { default as createServerGroup } from '@/api/me/servers/groups/createServerGroup.ts';
export { default as deleteServerGroup } from '@/api/me/servers/groups/deleteServerGroup.ts';
export { default as getServerGroupServers } from '@/api/me/servers/groups/getServerGroupServers.ts';
export { default as getServerGroups } from '@/api/me/servers/groups/getServerGroups.ts';
export { default as updateServerGroup } from '@/api/me/servers/groups/updateServerGroup.ts';
export { default as updateServerGroupsOrder } from '@/api/me/servers/groups/updateServerGroupsOrder.ts';
export { default as getServers } from '@/api/server/getServers.ts';
export { default as AppIcon } from '@/elements/AppIcon.tsx';
export { default as ActionIcon } from '@/elements/buttons/ActionIcon.tsx';
export { default as Button } from '@/elements/buttons/Button.tsx';
export { default as CopyOnClick } from '@/elements/CopyOnClick.tsx';
export { default as AccountContentContainer } from '@/elements/containers/AccountContentContainer.tsx';
export { default as Avatar } from '@/elements/data-display/Avatar.tsx';
export { default as Card } from '@/elements/data-display/Card.tsx';
export { default as Switch } from '@/elements/input/Switch.tsx';
export { default as TextInput } from '@/elements/input/TextInput.tsx';
export { default as SegmentedControl } from '@/elements/layout/SegmentedControl.tsx';
export { default as ConfirmationModal } from '@/elements/modals/ConfirmationModal.tsx';
export { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
export { default as Sidebar } from '@/elements/navigation/Sidebar.tsx';
export { default as Menu } from '@/elements/overlays/Menu.tsx';
export { default as Tooltip } from '@/elements/overlays/Tooltip.tsx';
export { default as QuickActionsTrigger } from '@/elements/quickActions/QuickActionsTrigger.tsx';
export { isAdmin } from '@/lib/auth/permissions.ts';
export { bytesToString, mbToBytes } from '@/lib/format/size.ts';
export { formatMilliseconds } from '@/lib/format/time.ts';
export { queryKeys } from '@/lib/queryKeys.ts';
export { default as BulkActionBar } from '@/pages/dashboard/home/BulkActionBar.tsx';
export { default as ServerAddGroupModal } from '@/pages/dashboard/home/modals/ServerAddGroupModal.tsx';
export { useKeyboardShortcuts } from '@/plugins/quick-actions/useKeyboardShortcuts.ts';
export { useBulkPowerActions } from '@/plugins/server/useBulkPowerActions.ts';
export { useServerListShowOthers } from '@/plugins/server/useServerListShowOthers.ts';
export { useBlocker } from '@/plugins/useBlocker.ts';
export { useAdminCan } from '@/plugins/usePermissions.ts';
export { useAuth } from '@/providers/AuthProvider.tsx';
export { useToast } from '@/providers/ToastProvider.tsx';
export { useGlobalStore } from '@/stores/global.ts';
export { useQuickActionsStore } from '@/stores/quickActions.ts';
export { useUserStore } from '@/stores/user.ts';
