import { create } from 'zustand';
import api from '../services/api';

export const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('voice_user') || 'null'),
  token: localStorage.getItem('voice_token'),
  isAuthenticated: !!localStorage.getItem('voice_token'),

  // ── Login ────────────────────────────────────────────────────────
  login: async (email, password) => {
    const response = await api.post('/api/auth/login', { email, password });
    const { access_token, user } = response.data;

    localStorage.setItem('voice_token', access_token);
    localStorage.setItem('voice_user', JSON.stringify(user));

    set({ user, token: access_token, isAuthenticated: true });
    return user;
  },

  // ── Logout ───────────────────────────────────────────────────────
  logout: () => {
    localStorage.removeItem('voice_token');
    localStorage.removeItem('voice_user');
    set({ user: null, token: null, isAuthenticated: false });
  },

  // ── Restore session on app load ────────────────────────────────────
  fetchMe: async () => {
    try {
      const response = await api.get('/api/auth/me');
      localStorage.setItem('voice_user', JSON.stringify(response.data));
      set({ user: response.data, isAuthenticated: true });
      return response.data;
    } catch {
      get().logout();
      return null;
    }
  },
}));