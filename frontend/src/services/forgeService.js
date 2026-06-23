import api from './api';

export const forgeService = {
  // ── Start a new Forge debate ───────────────────────────────────────
  start: async (payload) => {
    const response = await api.post('/api/forge/start', payload);
    return response.data;
  },

  // ── Continue debate — Agree or My Direction ────────────────────────
  turn: async (payload) => {
    const response = await api.post('/api/forge/turn', payload);
    return response.data;
  },

  // ── Approve final Forge copy ───────────────────────────────────────
  approve: async (sessionId, brandId) => {
    const response = await api.post(`/api/forge/approve/${sessionId}`, null, {
      params: { brand_id: brandId },
    });
    return response.data;
  },

  // ── Get saved result for a session (for reload) ────────────────────
  getResult: async (sessionId) => {
    const response = await api.get(`/api/forge/result/${sessionId}`);
    return response.data;
  },

  // ── Get recent Forge sessions ──────────────────────────────────────
  getSessions: async (brandId) => {
    const response = await api.get(`/api/forge/sessions/${brandId}`);
    return response.data;
  },
};