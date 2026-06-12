import { useState } from 'react';
import api from '../../services/api';
import { useBrandStore } from '../../store/brandStore';

const CATEGORIES = ['FMCG', 'D2C', 'Fashion', 'Beauty', 'Fitness', 'F&B', 'Tech', 'Other'];

export default function BrandManagement() {
  const { brands, fetchBrands } = useBrandStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'FMCG', color: '#6366f1' });
  const [error, setError] = useState('');

  const handleAdd = async () => {
    setError('');
    try {
      await api.post('/api/brands/', form);
      setForm({ name: '', category: 'FMCG', color: '#6366f1' });
      setShowForm(false);
      fetchBrands();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add brand');
    }
  };

  const handleArchive = async (brandId) => {
    await api.patch(`/api/brands/${brandId}/archive`);
    fetchBrands();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Brand management</h3>
        <button onClick={() => setShowForm(!showForm)} style={primaryBtn}>+ Add brand</button>
      </div>

      {showForm && (
        <div style={{ border: '1px solid var(--sep)', borderRadius: 'var(--radius-lg)', padding: '14px', marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <label style={fieldLabelStyle}>Brand name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={fieldLabelStyle}>Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={inputStyle}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={fieldLabelStyle}>Colour</label>
            <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} style={{ ...inputStyle, padding: '2px', height: '32px' }} />
          </div>

          {error && (
            <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--red-bg)', color: 'var(--red)', fontSize: '12px' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button onClick={() => setShowForm(false)} style={secondaryBtn}>Cancel</button>
            <button onClick={handleAdd} style={primaryBtn}>Add brand</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {brands.map((brand) => (
          <div key={brand.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid var(--sep)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: brand.color }} />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>{brand.name}</span>
              <span style={{ fontSize: '11px', color: 'var(--label3)' }}>{brand.category}</span>
            </div>
            <span onClick={() => handleArchive(brand.id)} style={{ fontSize: '12px', color: 'var(--label3)', cursor: 'pointer' }}>
              Archive
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const fieldLabelStyle = { display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--label3)', marginBottom: '4px' };
const inputStyle = { width: '100%', padding: '7px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--sep)', fontSize: '13px', fontFamily: 'inherit', outline: 'none' };
const primaryBtn = { padding: '7px 14px', borderRadius: 'var(--radius-md)', border: 'none', background: '#1E1E2A', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const secondaryBtn = { padding: '7px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--sep)', background: 'transparent', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' };