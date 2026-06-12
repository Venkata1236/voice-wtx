import { create } from 'zustand';
import api from '../services/api';

export const useBrandStore = create((set, get) => ({
  brands: [],
  activeBrand: null,
  kb: null,
  loading: false,

  // ── Fetch all brands assigned to current user ──────────────────────
  fetchBrands: async () => {
    set({ loading: true });
    try {
      const response = await api.get('/api/brands/');
      const brands = response.data;
      set({ brands, loading: false });

      // Auto-select first brand if none selected
      if (brands.length > 0 && !get().activeBrand) {
        get().setActiveBrand(brands[0]);
      }
      return brands;
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  // ── Switch active brand and load its KB ────────────────────────────
  setActiveBrand: async (brand) => {
    set({ activeBrand: brand, kb: null });
    try {
      const response = await api.get(`/api/kb/${brand.id}`);
      set({ kb: response.data });
    } catch (error) {
      console.error('Failed to load KB:', error);
    }
  },
}));