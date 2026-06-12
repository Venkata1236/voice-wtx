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
};