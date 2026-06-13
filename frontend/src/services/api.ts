import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';

declare module 'axios' {
  export interface AxiosRequestConfig {
    _isRefresh?: boolean;
    _retried?: boolean;
  }
}

const ACCESS_KEY = 'squadhire_token';
const REFRESH_KEY = 'squadhire_refresh';
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/login/talent',
  '/login/business',
  '/signup/talent',
  '/signup/business',
  '/forgot-password',
  '/apply/creative',
  '/apply/accountant',
  '/apply/sales',
];

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function clearAuthAndRedirect() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  if (typeof window !== 'undefined' && !PUBLIC_PATHS.includes(window.location.pathname)) {
    window.location.href = '/login';
  }
}

let pendingRefresh: Promise<void> | null = null;

async function performRefresh(): Promise<void> {
  const accessTokenAtStart = localStorage.getItem(ACCESS_KEY);
  const refreshToken = localStorage.getItem(REFRESH_KEY);

  try {
    if (refreshToken) {
      // Supabase auth (talent/admin)
      const { data } = await axios.post<{ access_token: string; refresh_token?: string }>(
        '/api/auth/refresh',
        { refresh_token: refreshToken },
        { _isRefresh: true } as AxiosRequestConfig
      );
      localStorage.setItem(ACCESS_KEY, data.access_token);
      if (data.refresh_token) localStorage.setItem(REFRESH_KEY, data.refresh_token);
    } else if (accessTokenAtStart) {
      // Business JWT — rotate via the still-valid token
      const { data } = await axios.post<{ access_token: string }>(
        '/api/auth/business-refresh',
        {},
        {
          headers: { Authorization: `Bearer ${accessTokenAtStart}` },
          _isRefresh: true,
        } as AxiosRequestConfig
      );
      localStorage.setItem(ACCESS_KEY, data.access_token);
    } else {
      throw new Error('No token available to refresh');
    }
  } catch (err) {
    // Cross-tab race: another tab may have already rotated the token. If our
    // stored access token changed during this attempt, accept that and let the
    // caller retry with the fresh value.
    const accessTokenNow = localStorage.getItem(ACCESS_KEY);
    if (accessTokenNow && accessTokenNow !== accessTokenAtStart) return;
    throw err;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as InternalAxiosRequestConfig | undefined;

    if (error.response?.status !== 401 || !config) {
      return Promise.reject(error);
    }

    // 401 on the refresh call itself, or already retried — give up.
    if (config._isRefresh || config._retried) {
      clearAuthAndRedirect();
      return Promise.reject(error);
    }

    if (!localStorage.getItem(ACCESS_KEY)) {
      clearAuthAndRedirect();
      return Promise.reject(error);
    }

    config._retried = true;

    try {
      if (!pendingRefresh) {
        pendingRefresh = performRefresh().finally(() => {
          pendingRefresh = null;
        });
      }
      await pendingRefresh;
    } catch {
      clearAuthAndRedirect();
      return Promise.reject(error);
    }

    const newToken = localStorage.getItem(ACCESS_KEY);
    if (!newToken) {
      clearAuthAndRedirect();
      return Promise.reject(error);
    }
    config.headers.Authorization = `Bearer ${newToken}`;
    return api(config);
  }
);

export default api;
