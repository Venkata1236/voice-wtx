import api from './api';

export const authService = {
  // ── Register new team member (admin only) ──────────────────────────
  register: async (payload) => {
    const response = await api.post('/api/auth/register', payload);
    return response.data;
  },

  // ── Change own password ─────────────────────────────────────────────
  changePassword: async (oldPassword, newPassword) => {
    const response = await api.post('/api/auth/change-password', null, {
      params: { old_password: oldPassword, new_password: newPassword },
    });
    return response.data;
  },

  // ── Request a password reset link (self-service) ────────────────────
  forgotPassword: async (email) => {
    const response = await api.post('/api/auth/forgot-password', { email });
    return response.data;
  },

  // ── Complete a password reset with a token from the email link ──────
  resetPassword: async (token, newPassword) => {
    const response = await api.post('/api/auth/reset-password', {
      token,
      new_password: newPassword,
    });
    return response.data;
  },
};