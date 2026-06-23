'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import { IS_STAFF, ACCESS_KEY, REFRESH_KEY } from '@/lib/appMode';
import {
  meetsLevel,
  type ModuleGrants,
  type ModulePermission,
  type ModuleScopes,
} from '../../../shared/src/types/access';

interface User {
  id: string;
  email: string;
  role: string;
  name?: string;
  /** Staff only — live per-module grant map. Full admins have no grants (all access). */
  grants?: ModuleGrants;
  /** Staff only — intra-module scopes (e.g. candidates category/section restrictions). */
  scopes?: ModuleScopes;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  /** True for full admins (admin app). Staff are never full admins. */
  isFullAdmin: boolean;
  /** Does the current user have at least `level` on `moduleSlug`? Admins always do. */
  can: (moduleSlug: string, level?: ModulePermission) => boolean;
  /** The user's tier on a module, or null. Admins are treated as 'admin'. */
  permissionFor: (moduleSlug: string) => ModulePermission | null;
  /** null = all modules (full admin); otherwise the granted slugs. */
  permittedModuleSlugs: string[] | null;
  /** Candidates intra-module scope. null = all (full admin or unrestricted). */
  allowedCandidateCategories: () => string[] | null;
  allowedCandidateSections: () => string[] | null;
  canCandidateCategory: (value: string) => boolean;
  canCandidateSection: (value: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACCESS_KEY);
  });
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const logout = useCallback(() => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    setToken(null);
    setUser(null);
    router.push('/login');
  }, [router]);

  useEffect(() => {
    const verifyAuth = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        if (IS_STAFF) {
          const { data } = await api.get('/staff-auth/me');
          const u = data.user || data;
          setUser({ ...u, grants: data.grants || {}, scopes: data.scopes || {} });
        } else {
          const { data } = await api.get('/auth/me');
          const userData = data.user || data;
          if (userData.role !== 'admin') {
            logout();
            return;
          }
          setUser(userData);
        }
      } catch {
        logout();
      } finally {
        setIsLoading(false);
      }
    };

    verifyAuth();
  }, [token, logout]);

  const login = async (email: string, password: string) => {
    if (IS_STAFF) {
      const { data } = await api.post('/staff-auth/login', { email, password });
      const accessToken = data.access_token;
      localStorage.setItem(ACCESS_KEY, accessToken);
      setToken(accessToken);
      setUser({ ...(data.user || {}), grants: data.grants || {}, scopes: data.scopes || {} });
      router.push('/');
      return;
    }

    const { data } = await api.post('/auth/login', { email, password });
    const userData = data.user || data;
    const accessToken = data.access_token || data.token || data.accessToken;
    const refreshToken = data.refresh_token;

    if (userData.role !== 'admin') {
      throw new Error('Access denied. Admin privileges required.');
    }

    localStorage.setItem(ACCESS_KEY, accessToken);
    if (refreshToken) {
      localStorage.setItem(REFRESH_KEY, refreshToken);
    }
    setToken(accessToken);
    setUser(userData);
    router.push('/');
  };

  const isFullAdmin = user?.role === 'admin';

  const can = useCallback(
    (moduleSlug: string, level: ModulePermission = 'view') => {
      if (!user) return false;
      if (user.role === 'admin') return true;
      return meetsLevel(user.grants?.[moduleSlug], level);
    },
    [user],
  );

  const permissionFor = useCallback(
    (moduleSlug: string): ModulePermission | null => {
      if (!user) return null;
      if (user.role === 'admin') return 'admin';
      return user.grants?.[moduleSlug] ?? null;
    },
    [user],
  );

  const permittedModuleSlugs = useMemo<string[] | null>(() => {
    if (!user) return [];
    if (user.role === 'admin') return null; // all
    return Object.keys(user.grants ?? {});
  }, [user]);

  // Candidates intra-module scope. null = unrestricted (full admin, or no scope
  // set, or empty list = all). Otherwise the explicit allow-list.
  const allowedCandidateCategories = useCallback((): string[] | null => {
    if (!user || user.role === 'admin') return null;
    const cats = user.scopes?.candidates?.categories;
    return cats && cats.length > 0 ? cats : null;
  }, [user]);

  const allowedCandidateSections = useCallback((): string[] | null => {
    if (!user || user.role === 'admin') return null;
    const secs = user.scopes?.candidates?.sections;
    return secs && secs.length > 0 ? secs : null;
  }, [user]);

  const canCandidateCategory = useCallback(
    (value: string) => {
      const a = allowedCandidateCategories();
      return !a || a.includes(value);
    },
    [allowedCandidateCategories],
  );

  const canCandidateSection = useCallback(
    (value: string) => {
      const a = allowedCandidateSections();
      return !a || a.includes(value);
    },
    [allowedCandidateSections],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isLoading,
        isFullAdmin,
        can,
        permissionFor,
        permittedModuleSlugs,
        allowedCandidateCategories,
        allowedCandidateSections,
        canCandidateCategory,
        canCandidateSection,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
