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
generateStream: async (payload, callbacks) => {
    const token = localStorage.getItem('voice_token');

    const response = await fetch(
      `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/copy/generate-stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) throw new Error('Stream failed');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'session') {
            callbacks.onSession?.(data.session_id);
          } else if (data.type === 'variant_start') {
            callbacks.onVariantStart?.(data.index);
          } else if (data.type === 'token') {
            callbacks.onToken?.(data.index, data.text);
          } else if (data.type === 'variant_done') {
            callbacks.onVariantDone?.(data);
          } else if (data.type === 'done') {
            callbacks.onDone?.();
          }
        } catch {
          continue;
        }
      }
    }
  },
  renameSession: async (sessionId, title) => {
    const response = await api.patch(`/api/copy/session/${sessionId}/rename`, null, {
      params: { title },
    });
    return response.data;
  },

  deleteSession: async (sessionId) => {
    await api.delete(`/api/copy/session/${sessionId}`);
  },
};