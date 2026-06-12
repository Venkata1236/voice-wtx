import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Attach JWT token to every request ──────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('voice_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Handle 401 — token expired or invalid ──────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('voice_token');
      localStorage.removeItem('voice_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;