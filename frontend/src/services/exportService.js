import api from './api';

export const exportService = {
  // ── Export copy as plain text, csv, or kb archive ──────────────────
  export: async (payload) => {
    const response = await api.post('/api/export/', payload, {
      responseType: 'blob',
    });

    const filename = response.headers['x-filename'] || 'export.txt';
    return { blob: response.data, filename };
  },

  // ── Preview count before exporting ──────────────────────────────────
  preview: async (brandId, filter = 'approved_only') => {
    const response = await api.get(`/api/export/${brandId}/preview`, {
      params: { filter },
    });
    return response.data;
  },
};