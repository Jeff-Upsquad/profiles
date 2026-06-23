// Single source of truth for which app is running. The admin source tree is
// shared with the separate `staff` app (which sets NEXT_PUBLIC_APP_MODE=staff
// in its next.config). Everything that must differ between the two apps —
// token storage key, login URL, auth endpoints — branches on APP_MODE.

export type AppMode = 'admin' | 'staff';

export const APP_MODE: AppMode =
  process.env.NEXT_PUBLIC_APP_MODE === 'staff' ? 'staff' : 'admin';

export const IS_STAFF = APP_MODE === 'staff';

// nginx/Next basePath per app.
export const BASE_PATH = IS_STAFF ? '/staff' : '/admin';

// Distinct localStorage keys so the two apps never collide on a shared origin.
export const ACCESS_KEY = IS_STAFF ? 'squadhire_staff_token' : 'squadhire_admin_token';
export const REFRESH_KEY = IS_STAFF ? 'squadhire_staff_refresh' : 'squadhire_admin_refresh';

// Where to send an unauthenticated user. Admin keeps its historical '/login'
// target unchanged; staff gets its basePath-correct login URL.
export const LOGIN_PATH = IS_STAFF ? '/staff/login' : '/login';
