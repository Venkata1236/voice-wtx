import api from './api';

export const kbService = {
  // ── Get full KB for a brand ────────────────────────────────────────
  getKB: async (brandId) => {
    const response = await api.get(`/api/kb/${brandId}`);
    return response.data;
  },

  // ── Update KB settings — tone tags, rules, brief template ──────────
  updateKB: async (brandId, payload) => {
    const response = await api.patch(`/api/kb/${brandId}`, payload);
    return response.data;
  },

  // ── Upload a brand document (PDF/DOCX) ──────────────────────────────
  uploadDocument: async (brandId, docType, file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post(
      `/api/kb/${brandId}/upload?doc_type=${docType}`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  // ── Approve a pending document ──────────────────────────────────────
  approveDocument: async (brandId, docId) => {
    const response = await api.post(`/api/kb/${brandId}/approve/${docId}`);
    return response.data;
  },

  // ── Reject a pending document ────────────────────────────────────────
  rejectDocument: async (brandId, docId) => {
    const response = await api.post(`/api/kb/${brandId}/reject/${docId}`);
    return response.data;
  },
};