import { useAdminCan } from './core.ts';

/** Zoron's admin permission (`backend/src/permissions.rs`): saving the site theme without every other panel setting. */
export const THEME_UPDATE_PERMISSION = 'zoron-theme.update';

/** The backend's check for the theme PUT: admins, and roles holding `settings.update` or `zoron-theme.update`. */
export const useCanSaveTheme = () => useAdminCan(['settings.update', THEME_UPDATE_PERMISSION]);
