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

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  businessLogin: (identifier: { email?: string; phone?: string }) => Promise<void>;
  signupTalent: (data: TalentSignupData, options?: { skipRedirect?: boolean }) => Promise<void>;
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

  const storeAuth = useCallback((authToken: string, authUser: User) => {
    localStorage.setItem('squadhire_token', authToken);
    setToken(authToken);
    setUser(authUser);
  }, []);

  const clearAuth = useCallback(() => {
    localStorage.removeItem('squadhire_token');
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
    }
  }, [user, pathname, router]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.post('/auth/login', { email, password });
      storeAuth(data.access_token || data.token, data.user);
      router.push('/dashboard');
    },
    [storeAuth, router]
  );

  const businessLogin = useCallback(
    async (identifier: { email?: string; phone?: string }) => {
      const { data } = await api.post('/auth/business-login', identifier);
      storeAuth(data.access_token || data.token, data.user);
      router.push('/business/dashboard');
    },
    [storeAuth, router]
  );

  const signupTalent = useCallback(
    async (signupData: TalentSignupData, options?: { skipRedirect?: boolean }) => {
      const { data } = await api.post('/auth/signup/talent', signupData);
      storeAuth(data.access_token || data.token, data.user);
      if (!options?.skipRedirect) {
        router.push('/talent/basic-profile');
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
      value={{ user, token, isLoading, login, businessLogin, signupTalent, logout, refetchUser }}
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
