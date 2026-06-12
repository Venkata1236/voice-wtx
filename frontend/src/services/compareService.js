import api from './api';

export const compareService = {
  // ── Compare mode generation — two models, one brief ────────────────
  generate: async (payload) => {
    const response = await api.post('/api/compare/', payload);
    return response.data;
  },

  // ── Get recent compare sessions ────────────────────────────────────
  getSessions: async (brandId) => {
    const response = await api.get(`/api/compare/sessions/${brandId}`);
    return response.data;
  },

  // ── Get variants for a compare session ─────────────────────────────
  getSessionVariants: async (sessionId) => {
    const response = await api.get(`/api/compare/session/${sessionId}`);
    return response.data;
  },
};