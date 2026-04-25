import axios from 'axios';

/**
 * Dedicated axios instance for the email-gated Talent-Access flow.
 *
 * Kept separate from the regular `services/api.ts` so that:
 *  - the talent_access_token is sent only to /api/talent-access/* endpoints
 *  - a logged-in talent or business user in another tab is unaffected
 *  - 401/403 from this flow drives only the Talent-Access login screen,
 *    not the global /login redirect.
 */
export const TALENT_ACCESS_TOKEN_KEY = 'talent_access_token';
export const TALENT_ACCESS_META_KEY = 'talent_access_meta';

const taApi = axios.create({
  baseURL: '/api/talent-access',
  headers: {
    'Content-Type': 'application/json',
  },
});

taApi.interceptors.request.use((config) => {
  if (typeof window === 'undefined') return config;
  const token = localStorage.getItem(TALENT_ACCESS_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

taApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== 'undefined') {
      const status = error.response?.status;
      // 401: token missing/invalid. 403 with these codes: revoked or expired.
      if (status === 401 || status === 403) {
        // Don't auto-redirect — let components decide. Just clear stale state
        // for hard auth failures (401). 403 might be a category authz failure
        // where we want to keep the session.
        if (status === 401) {
          localStorage.removeItem(TALENT_ACCESS_TOKEN_KEY);
          localStorage.removeItem(TALENT_ACCESS_META_KEY);
        }
      }
    }
    return Promise.reject(error);
  },
);

export default taApi;
