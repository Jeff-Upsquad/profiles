import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import axios from 'axios';
import api from '@/services/api';
import type { User, TalentSignupData, AgencySignupData } from '@/types';

const CHANGE_PASSWORD_PATH = '/change-password';
const BUSINESS_CHANGE_PASSWORD_PATH = '/change-password/business';

interface BusinessSignupData {
  email: string;
  phone: string;
  name: string;
  company_name: string;
  password: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  businessLogin: (identifier: {
    email?: string;
    phone?: string;
    password?: string;
  }) => Promise<{ needsSignup: boolean }>;
  businessSignup: (data: BusinessSignupData) => Promise<void>;
  signupTalent: (data: TalentSignupData, options?: { skipRedirect?: boolean }) => Promise<void>;
  signupAgency: (data: AgencySignupData) => Promise<void>;
  agencyLogin: (email: string, password: string) => Promise<void>;
  applyResetSession: (data: {
    access_token?: string;
    token?: string;
    refresh_token?: string | null;
    user: User;
  }) => void;
  logout: (redirectTo?: string) => void;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Post-auth redirect that crosses from an auth page (the min-h-screen AuthShell
// login/signup views) into the app shell (the h-screen DashboardLayout). A soft
// `router.replace` can, on mobile, leave the outgoing auth segment mounted ABOVE
// the freshly-mounted app segment — both full-height siblings in one scroll — so
// the user sees the login form by scrolling up past the app. A full document
// replace tears the old tree down for good, and using `replace` (not `assign`)
// keeps the login page out of history so a swipe-back can't return to it.
function enterApp(path: string) {
  if (typeof window !== 'undefined') {
    window.location.replace(path);
  }
}

function persistAuthTokens(authToken: string, refreshToken?: string | null) {
  localStorage.setItem('squadhire_token', authToken);
  if (refreshToken) {
    localStorage.setItem('squadhire_refresh', refreshToken);
  } else {
    // Business users have no refresh token — clear any stale value from a
    // previous session of a different role on the same device.
    localStorage.removeItem('squadhire_refresh');
  }
}

// Write tokens to storage and hard-navigate WITHOUT updating React state.
// setToken on the page we're leaving would fire /auth/me, which the browser
// then aborts; the old catch-all treated that abort as a bad session and
// wiped the token before the next page could read it.
function persistAndEnterApp(
  authToken: string,
  refreshToken: string | null | undefined,
  path: string,
) {
  persistAuthTokens(authToken, refreshToken);
  enterApp(path);
}

function destinationForRole(role: string | undefined): string {
  if (role === 'talent') return '/talent/dashboard';
  if (role === 'agency') return '/agency/dashboard';
  if (role === 'business') return '/business/hire';
  return '/dashboard';
}

function isAbortedAuthRequest(err: unknown): boolean {
  if (axios.isCancel(err)) return true;
  if (typeof err === 'object' && err !== null) {
    const e = err as { code?: string; name?: string };
    if (e.code === 'ERR_CANCELED' || e.name === 'CanceledError' || e.name === 'AbortError') {
      return true;
    }
  }
  return false;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      // In-app WebView bridge: the talent app appends `?app_token=` (+ optional
      // `app_refresh`) so the web page can silently inherit the app's session
      // without requiring the user to log in again inside the WebView.
      try {
        const params = new URLSearchParams(window.location.search);
        const appToken = params.get('app_token');
        const appRefresh = params.get('app_refresh');
        if (appToken) {
          localStorage.setItem('squadhire_token', appToken);
          if (appRefresh) localStorage.setItem('squadhire_refresh', appRefresh);
          else localStorage.removeItem('squadhire_refresh');
          params.delete('app_token');
          params.delete('app_refresh');
          params.delete('in_app');
          const clean =
            params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
          window.history.replaceState({}, '', clean);
          return appToken;
        }
      } catch {
        // ignore — storage may be unavailable in some embed contexts
      }
      return localStorage.getItem('squadhire_token');
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const storeAuth = useCallback(
    (authToken: string, authUser: User, refreshToken?: string | null) => {
      persistAuthTokens(authToken, refreshToken);
      setToken(authToken);
      setUser(authUser);
    },
    []
  );

  const clearAuth = useCallback(() => {
    localStorage.removeItem('squadhire_token');
    localStorage.removeItem('squadhire_refresh');
    setToken(null);
    setUser(null);
  }, []);

  // In-app WebView may navigate to a URL that carries `?app_token=` after the
  // provider has already mounted (soft navigation). Promote it to localStorage.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const appToken = params.get('app_token');
      if (appToken && appToken !== token) {
        const appRefresh = params.get('app_refresh');
        localStorage.setItem('squadhire_token', appToken);
        if (appRefresh) localStorage.setItem('squadhire_refresh', appRefresh);
        else localStorage.removeItem('squadhire_refresh');
        params.delete('app_token');
        params.delete('app_refresh');
        params.delete('in_app');
        const clean =
          params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
        window.history.replaceState({}, '', clean);
        setToken(appToken);
      }
    } catch {
      // ignore
    }
  }, [pathname, token]);

  // On mount (or token change), always fetch the latest user from the server.
  // This ensures approval_status and other fields stay current.
  //
  // A hard navigation (window.location.replace after login, mobile swipe-back
  // off this page) aborts the in-flight /auth/me. Axios surfaces that as a
  // CanceledError or a Network Error with no response. The previous catch-all
  // treated every failure as a bad session and cleared localStorage — so a
  // successful login on mobile bounced straight back to the login form.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const verifyToken = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me', { signal: controller.signal });
        if (cancelled) return;
        setUser(data.user ?? data);
      } catch (err) {
        if (cancelled || isAbortedAuthRequest(err)) return;
        const axiosErr = err as { response?: unknown };
        // Full-page unloads often report aborted XHRs as a generic Network
        // Error (no response) while the document is already hidden. Do not
        // wipe a token we just stored.
        if (
          !axiosErr.response &&
          typeof document !== 'undefined' &&
          document.visibilityState === 'hidden'
        ) {
          return;
        }
        clearAuth();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    verifyToken();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [token, clearAuth]);

  // Force users flagged for password reset to the change-password page.
  useEffect(() => {
    if (!user) return;
    if (user.must_reset_password && pathname !== CHANGE_PASSWORD_PATH) {
      router.replace(CHANGE_PASSWORD_PATH);
    } else if (
      user.role === 'business' &&
      user.must_change_password &&
      pathname !== BUSINESS_CHANGE_PASSWORD_PATH
    ) {
      // Business user whose password an admin just reset — force the change.
      router.replace(BUSINESS_CHANGE_PASSWORD_PATH);
    }
  }, [user, pathname, router]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.post('/auth/login', { email, password });
      // Persist to localStorage only — do not set React state on this page.
      // The next document reads the token on mount and verifies it there.
      persistAndEnterApp(
        data.access_token || data.token,
        data.refresh_token,
        destinationForRole(data.user?.role),
      );
    },
    []
  );

  const businessLogin = useCallback(
    async (identifier: { email?: string; phone?: string; password?: string }) => {
      const { data } = await api.post('/auth/business-login', identifier);
      // Provisioned/invited account that hasn't set a password yet → the caller
      // routes the user to first-time signup instead of showing an error.
      if (data.status === 'needs_signup') {
        return { needsSignup: true };
      }
      persistAndEnterApp(
        data.access_token || data.token,
        null,
        data.must_change_password ? BUSINESS_CHANGE_PASSWORD_PATH : '/business/hire',
      );
      return { needsSignup: false };
    },
    []
  );

  const businessSignup = useCallback(
    async (payload: BusinessSignupData) => {
      const { data } = await api.post('/auth/business/signup', payload);
      persistAndEnterApp(data.access_token || data.token, null, '/business/hire');
    },
    []
  );

  // Finalize the self-serve WhatsApp password-reset: the wizard has already
  // collected the temp password AND the new password (set via the authenticated
  // change-password endpoints), so by the time this runs the forced-change flag
  // is cleared. Store the session and drop the user straight into their portal —
  // no detour through a separate "set a new password" page.
  const applyResetSession = useCallback(
    (data: {
      access_token?: string;
      token?: string;
      refresh_token?: string | null;
      user: User;
    }) => {
      persistAndEnterApp(
        data.access_token || data.token || '',
        data.refresh_token ?? null,
        destinationForRole(data.user?.role),
      );
    },
    []
  );

  const signupTalent = useCallback(
    async (signupData: TalentSignupData, options?: { skipRedirect?: boolean }) => {
      const { data } = await api.post('/auth/signup/talent', signupData);
      storeAuth(data.access_token || data.token, data.user, data.refresh_token);
      if (!options?.skipRedirect) {
        router.replace('/talent/basic-profile');
      }
    },
    [storeAuth, router]
  );

  const signupAgency = useCallback(
    async (data: AgencySignupData) => {
      await api.post('/auth/signup/agency', data);
      // auto-login via standard login (agency uses same Supabase auth)
      const { data: loginData } = await api.post('/auth/login', { email: data.email, password: data.password });
      persistAndEnterApp(
        loginData.access_token || loginData.token,
        loginData.refresh_token,
        '/agency/dashboard',
      );
    },
    []
  );

  const agencyLogin = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.post('/auth/login', { email, password });
      if (data.user?.role && data.user.role !== 'agency') {
        throw new Error('This account is not an agency account');
      }
      persistAndEnterApp(
        data.access_token || data.token,
        data.refresh_token,
        '/agency/dashboard',
      );
    },
    []
  );

  const logout = useCallback(
    (redirectTo: string = '/') => {
      clearAuth();
      router.push(redirectTo);
    },
    [clearAuth, router]
  );

  const refetchUser = useCallback(async () => {
    if (!token) return;
    const { data } = await api.get('/auth/me');
    setUser(data.user ?? data);
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        businessLogin,
        businessSignup,
        signupTalent,
        signupAgency,
        agencyLogin,
        applyResetSession,
        logout,
        refetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
