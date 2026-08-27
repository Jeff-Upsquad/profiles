import api from './api';
export const squadApi = {
  signup: (data: { email: string; password: string }) => api.post('/squad/signup', data).then(r=>r.data),
  me: () => api.get('/squad/me').then(r=>r.data),
  updateMe: (data: any) => api.put('/squad/me', data).then(r=>r.data),
  allowedCategories: () => api.get('/squad/allowed-categories').then(r=>r.data),
  listProfiles: () => api.get('/squad/profiles').then(r=>r.data),
  createProfile: (data: any) => api.post('/squad/profiles', data).then(r=>r.data),
  updateProfile: (id:string, data:any) => api.put(`/squad/profiles/${id}`, data).then(r=>r.data),
  deleteProfile: (id:string) => api.delete(`/squad/profiles/${id}`).then(r=>r.data),
};
