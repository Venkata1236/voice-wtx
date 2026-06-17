import api from './api';

// ── Generate a unique turn id per send ─────────────────────────────
// One turn_id groups all variants from a single send: 3 for a Single
// turn, 2 for a Compare turn. Shared by both stream services.
export function newTurnId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older / non-secure contexts
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const copyService = {
  // ── Generate 3 variants for a brief (non-streaming) ───────────────
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

  // ── Get recent sessions for a brand (unified chat list) ───────────
  getSessions: async (brandId) => {
    const response = await api.get(`/api/copy/sessions/${brandId}`);
    return response.data;
  },

  // ── Get all variants for a session (flat list — legacy) ───────────
  getSessionVariants: async (sessionId) => {
    const response = await api.get(`/api/copy/session/${sessionId}`);
    return response.data;
  },

  // ── Load the WHOLE chat as ordered turns ──────────────────────────
  // Returns { session_id, turns: [{ turn_id, turn_type, brief,
  // created_at, variants: [...] }] }. This is what the unified Chat
  // view uses to replay a mix of Single + Compare turns in order.
  getThread: async (sessionId) => {
    const response = await api.get(`/api/copy/thread/${sessionId}`);
    return response.data;
  },

  // ── Pin / unpin a session ─────────────────────────────────────────
  pinSession: async (sessionId) => {
    const response = await api.patch(`/api/copy/session/${sessionId}/pin`);
    return response.data;
  },

  // ── Streaming Single-mode send ────────────────────────────────────
  // payload should include turn_id (use newTurnId()). All 3 variants
  // are tagged with it server-side.
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
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Keep the last (possibly partial) line in the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'session') {
            callbacks.onSession?.(data.session_id, data.turn_id, data.turn_type);
          } else if (data.type === 'title') {
            callbacks.onTitle?.(data.session_id, data.title);
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