/**
 * Every core (`@/`) import Xylo uses, so a core module move is a one-file edit here. Each path exists since panel
 * 1.2.0, the floor in Metadata.toml (check with `git show release-1.2.0:<path>` in a panel checkout).
 */

export { axiosInstance, httpErrorToHuman } from '@/api/axios.ts';
export { default as getServers } from '@/api/server/getServers.ts';
export { default as ActionIcon } from '@/elements/buttons/ActionIcon.tsx';
export { default as Button } from '@/elements/buttons/Button.tsx';
export { default as Switch } from '@/elements/input/Switch.tsx';
export { default as TextInput } from '@/elements/input/TextInput.tsx';
export { default as SegmentedControl } from '@/elements/layout/SegmentedControl.tsx';
export { default as ConfirmationModal } from '@/elements/modals/ConfirmationModal.tsx';
export { default as Menu } from '@/elements/overlays/Menu.tsx';
export { default as Tooltip } from '@/elements/overlays/Tooltip.tsx';
export { useKeyboardShortcuts } from '@/plugins/quick-actions/useKeyboardShortcuts.ts';
export { useBlocker } from '@/plugins/useBlocker.ts';
export { useAdminCan } from '@/plugins/usePermissions.ts';
export { useAuth } from '@/providers/AuthProvider.tsx';
export { useToast } from '@/providers/ToastProvider.tsx';
