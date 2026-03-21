import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import type { User, TalentSignupData, BusinessSignupData } from '@/types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signupTalent: (data: TalentSignupData) => Promise<void>;
  signupBusiness: (data: BusinessSignupData) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('squadhire_token')
  );
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

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

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.post('/auth/login', { email, password });
      storeAuth(data.token, data.user);
      navigate(data.user.role === 'business' ? '/business/dashboard' : '/talent/dashboard');
    },
    [storeAuth, navigate]
  );

  const signupTalent = useCallback(
    async (signupData: TalentSignupData) => {
      const { data } = await api.post('/auth/signup/talent', signupData);
      storeAuth(data.token, data.user);
      navigate('/talent/dashboard');
    },
    [storeAuth, navigate]
  );

  const signupBusiness = useCallback(
    async (signupData: BusinessSignupData) => {
      const { data } = await api.post('/auth/signup/business', signupData);
      storeAuth(data.token, data.user);
      navigate('/business/dashboard');
    },
    [storeAuth, navigate]
  );

  const logout = useCallback(() => {
    clearAuth();
    navigate('/');
  }, [clearAuth, navigate]);

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, signupTalent, signupBusiness, logout }}
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
