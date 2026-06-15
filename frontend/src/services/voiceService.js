
import api from './api';

export const voiceService = {
  // ── Transcribe audio blob to text ──────────────────────────────
  transcribe: async (audioBlob) => {
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');

    const response = await api.post('/api/voice/transcribe', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return response.data.transcript;
  },
};