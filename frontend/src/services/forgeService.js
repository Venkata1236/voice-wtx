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

  // ── Streaming start — debate appears live, then final card ────────
  startStream: async (payload, callbacks) => {
    const token = localStorage.getItem('voice_token');

    const response = await fetch(
      `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/forge/start-stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) throw new Error('Forge stream failed');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'session') {
            callbacks.onSession?.(data.session_id);
          } else if (data.type === 'debate_message') {
            callbacks.onDebateMessage?.(data);
          } else if (data.type === 'final') {
            callbacks.onFinal?.(data);
          } else if (data.type === 'done') {
            callbacks.onDone?.();
          } else if (data.type === 'error') {
            callbacks.onError?.(data.detail);
          }
        } catch {
          continue;
        }
      }
    }
  },

  // ── Streaming follow-up round (Agree / direction) ─────────────────
  turnStream: async (payload, callbacks) => {
    const token = localStorage.getItem('voice_token');

    const response = await fetch(
      `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/forge/turn-stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) throw new Error('Forge turn stream failed');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'session') callbacks.onSession?.(data.session_id);
          else if (data.type === 'debate_message') callbacks.onDebateMessage?.(data);
          else if (data.type === 'final') callbacks.onFinal?.(data);
          else if (data.type === 'done') callbacks.onDone?.();
          else if (data.type === 'error') callbacks.onError?.(data.detail);
        } catch {
          continue;
        }
      }
    }
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