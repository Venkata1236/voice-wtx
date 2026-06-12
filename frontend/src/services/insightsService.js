import api from './api';

export const insightsService = {
  // ── Get all notes for a brand ──────────────────────────────────────
  getNotes: async (brandId) => {
    const response = await api.get(`/api/insights/${brandId}`);
    return response.data;
  },

  // ── Create a new note ───────────────────────────────────────────────
  createNote: async (payload) => {
    const response = await api.post('/api/insights/', payload);
    return response.data;
  },

  // ── Update a note ────────────────────────────────────────────────────
  updateNote: async (noteId, payload) => {
    const response = await api.patch(`/api/insights/${noteId}`, payload);
    return response.data;
  },

  // ── Toggle pin ────────────────────────────────────────────────────────
  togglePin: async (noteId) => {
    const response = await api.patch(`/api/insights/${noteId}/pin`);
    return response.data;
  },

  // ── Delete a note ─────────────────────────────────────────────────────
  deleteNote: async (noteId) => {
    await api.delete(`/api/insights/${noteId}`);
  },

  // ── Get count / cap status ───────────────────────────────────────────
  getCount: async (brandId) => {
    const response = await api.get(`/api/insights/${brandId}/count`);
    return response.data;
  },
};