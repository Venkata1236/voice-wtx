import api from './api';

export const imageService = {
  /**
   * Upload an image file to Supabase Storage via the backend.
   * Returns { url, filename }.
   */
  upload: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/api/image/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data; // { url, filename }
  },
};