import { useState } from 'react';
import { authService } from '../../services/authService';
import { useBrandStore } from '../../store/brandStore';

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'copy_lead', label: 'Copy Lead' },
  { value: 'strategist', label: 'Strategist' },
  { value: 'copywriter', label: 'Copywriter' },
  { value: 'brand_manager', label: 'Brand Manager' },
];

export default function TeamMembers() {
  const { brands } = useBrandStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: '', full_name: '', role: 'copywriter', brand_ids: [] });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleToggleBrand = (brandId) => {
    setForm((f) => ({
      ...f,
      brand_ids: f.brand_ids.includes(brandId)
        ? f.brand_ids.filter((id) => id !== brandId)
        : [...f.brand_ids, brandId],
    }));
  };

  const handleSubmit = async () => {
    setError('');
    try {
      const user = await authService.register(form);
      setResult(user);
      setForm({ email: '', full_name: '', role: 'copywriter', brand_ids: [] });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add team member');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Team members</h3>
        <button onClick={() => setShowForm(!showForm)} style={primaryBtn}>
          + Add member
        </button>
      </div>

      {result && (
        <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--green-bg)', color: 'var(--green)', fontSize: '12px', marginBottom: '12px' }}>
          {result.full_name} added. Check backend logs for temporary password to share privately.
        </div>
      )}

      {showForm && (
        <div style={{ border: '1px solid var(--sep)', borderRadius: 'var(--radius-lg)', padding: '14px', marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Field label="Full name" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
          <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />

          <div>
            <label style={fieldLabelStyle}>Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              style={inputStyle}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={fieldLabelStyle}>Brand access</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {brands.map((brand) => (
                <span
                  key={brand.id}
                  onClick={() => handleToggleBrand(brand.id)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '12px',
                    cursor: 'pointer',
                    border: '1px solid var(--sep)',
                    background: form.brand_ids.includes(brand.id) ? 'var(--accent-light)' : 'transparent',
                    fontWeight: form.brand_ids.includes(brand.id) ? 600 : 400,
                  }}
                >
                  {brand.name}
                </span>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--red-bg)', color: 'var(--red)', fontSize: '12px' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button onClick={() => setShowForm(false)} style={secondaryBtn}>Cancel</button>
            <button onClick={handleSubmit} style={primaryBtn}>Add member</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label style={fieldLabelStyle}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
    </div>
  );
}

const fieldLabelStyle = { display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--label3)', marginBottom: '4px' };
const inputStyle = { width: '100%', padding: '7px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--sep)', fontSize: '13px', fontFamily: 'inherit', outline: 'none' };
const primaryBtn = { padding: '7px 14px', borderRadius: 'var(--radius-md)', border: 'none', background: '#1E1E2A', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const secondaryBtn = { padding: '7px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--sep)', background: 'transparent', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' };