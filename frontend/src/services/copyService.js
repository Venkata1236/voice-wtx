import api from './api';

export const copyService = {
  // ── Generate 3 variants for a brief ───────────────────────────────
  generate: async (payload) => {
    const response = await api.post('/api/copy/generate', payload);
    return response.data;
  },

  // ── Approve / unapprove a variant (toggle) ────────────────────────
  approve: async (variantId, brandId) => {
    const response = await api.post('/api/copy/approve', {
      variant_id: variantId,
      brand_id: brandId,
    });
    return response.data;
  },

  // ── Reject a variant with a reason — returns revised variants ─────
  reject: async (variantId, brandId, reason) => {
    const response = await api.post('/api/copy/reject', {
      variant_id: variantId,
      brand_id: brandId,
      reason,
    });
    return response.data;
  },

  // ── Get recent sessions for a brand ────────────────────────────────
  getSessions: async (brandId) => {
    const response = await api.get(`/api/copy/sessions/${brandId}`);
    return response.data;
  },

  // ── Get all variants for a session ─────────────────────────────────
  getSessionVariants: async (sessionId) => {
    const response = await api.get(`/api/copy/session/${sessionId}`);
    return response.data;
  },

  // ── Pin / unpin a session ───────────────────────────────────────────
  pinSession: async (sessionId) => {
    const response = await api.patch(`/api/copy/session/${sessionId}/pin`);
    return response.data;
  },
};