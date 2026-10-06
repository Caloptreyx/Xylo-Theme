import { useAdminCan } from './core.ts';

/** Xylo's admin permission (`backend/src/permissions.rs`): saving the site theme without every other panel setting. */
export const THEME_UPDATE_PERMISSION = 'xylo-theme.update';

/** The backend's check for the theme PUT: admins, and roles holding `settings.update` or `xylo-theme.update`. */
export const useCanSaveTheme = () => useAdminCan(['settings.update', THEME_UPDATE_PERMISSION]);
