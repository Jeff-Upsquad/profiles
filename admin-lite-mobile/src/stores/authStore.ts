import { create } from 'zustand';
import api from '../services/api';
import { secureStorage, TOKEN_KEY } from '../services/secureStorage';
import type { AdminUser } from '../types';

interface AuthState {
  user: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  restoreSession: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  async restoreSession() {
    try {
      const token = await secureStorage.getItem(TOKEN_KEY);
      if (!token) {
        set({ isLoading: false });
        return;
      }
      const { data } = await api.get('/auth/me');
      const user: AdminUser = data.user ?? data;
      if (user?.role !== 'admin') {
        await secureStorage.deleteItem(TOKEN_KEY);
        set({ isLoading: false });
        return;
      }
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      await secureStorage.deleteItem(TOKEN_KEY);
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  async login(email, password) {
    set({ error: null });
    try {
      const { data } = await api.post('/auth/login', { email, password });
      const token = data.access_token ?? data.token ?? data.accessToken;
      const user: AdminUser = data.user ?? data;
      if (!token) throw new Error('No token returned from server');
      if (user?.role !== 'admin') {
        throw new Error('This account does not have admin access');
      }
      await secureStorage.setItem(TOKEN_KEY, token);
      set({ user, isAuthenticated: true, error: null });
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Login failed. Please try again.';
      set({ error: message });
      throw new Error(message);
    }
  },

  async logout() {
    await secureStorage.deleteItem(TOKEN_KEY);
    set({ user: null, isAuthenticated: false, error: null });
  },
}));
