import api from './api';

export const compareService = {
  // ── Compare mode generation — two models, one brief (non-stream) ──
  generate: async (payload) => {
    const response = await api.post('/api/compare/', payload);
    return response.data;
  },

  // ── Get recent sessions (legacy — sidebar uses copyService) ───────
  getSessions: async (brandId) => {
    const response = await api.get(`/api/compare/sessions/${brandId}`);
    return response.data;
  },

  // ── Get the two latest variants for a compare session (legacy) ────
  getSessionVariants: async (sessionId) => {
    const response = await api.get(`/api/compare/session/${sessionId}`);
    return response.data;
  },

  // ── Streaming Compare-mode send ───────────────────────────────────
  // payload should include turn_id (use newTurnId() from copyService).
  // Both panes are tagged with it server-side as one compare turn.
  generateStream: async (payload, callbacks) => {
    const token = localStorage.getItem('voice_token');

    const response = await fetch(
      `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/compare/stream`,
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
          if (data.type === 'session') callbacks.onSession?.(data.session_id, data.turn_id, data.turn_type);
          else if (data.type === 'title') callbacks.onTitle?.(data.session_id, data.title);
          else if (data.type === 'vision_reading') callbacks.onVisionReading?.();
          else if (data.type === 'vision_done') callbacks.onVisionDone?.(data.context);
          else if (data.type === 'pane_start') callbacks.onPaneStart?.(data.index, data.model);
          else if (data.type === 'token') callbacks.onToken?.(data.index, data.text);
          else if (data.type === 'pane_done') callbacks.onPaneDone?.(data);
          else if (data.type === 'score_update') callbacks.onScoreUpdate?.(data);
          else if (data.type === 'done') callbacks.onDone?.();
        } catch {
          continue;
        }
      }
    }
  },
};