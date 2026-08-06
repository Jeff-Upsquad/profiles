import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api from '@/services/api';
import type { User, TalentSignupData } from '@/types';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('squadhire_token');
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const storeAuth = useCallback(
    (authToken: string, authUser: User, refreshToken?: string | null) => {
      localStorage.setItem('squadhire_token', authToken);
      if (refreshToken) {
        localStorage.setItem('squadhire_refresh', refreshToken);
      } else {
        // Business users have no refresh token — clear any stale value from a
        // previous session of a different role on the same device.
        localStorage.removeItem('squadhire_refresh');
      }
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

  // On mount (or token change), always fetch the latest user from the server.
  // This ensures approval_status and other fields stay current.
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        setUser(data.user ?? data);
      } catch {
        clearAuth();
      } finally {
        setIsLoading(false);
      }
    };
    verifyToken();
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
      storeAuth(data.access_token || data.token, data.user, data.refresh_token);
      // replace (not push) so the login page doesn't linger in history — a
      // mobile swipe-back would otherwise land the user back on it.
      router.replace('/dashboard');
    },
    [storeAuth, router]
  );

  const businessLogin = useCallback(
    async (identifier: { email?: string; phone?: string; password?: string }) => {
      const { data } = await api.post('/auth/business-login', identifier);
      // Provisioned/invited account that hasn't set a password yet → the caller
      // routes the user to first-time signup instead of showing an error.
      if (data.status === 'needs_signup') {
        return { needsSignup: true };
      }
      storeAuth(data.access_token || data.token, data.user, null);
      router.replace(
        data.must_change_password ? BUSINESS_CHANGE_PASSWORD_PATH : '/business/hire',
      );
      return { needsSignup: false };
    },
    [storeAuth, router]
  );

  const businessSignup = useCallback(
    async (payload: BusinessSignupData) => {
      const { data } = await api.post('/auth/business/signup', payload);
      storeAuth(data.access_token || data.token, data.user, null);
      router.replace('/business/hire');
    },
    [storeAuth, router]
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
      storeAuth(data.access_token || data.token || '', data.user, data.refresh_token ?? null);
      router.replace(data.user?.role === 'business' ? '/business/hire' : '/talent/dashboard');
    },
    [storeAuth, router]
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
