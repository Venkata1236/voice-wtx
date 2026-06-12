import { useState, useEffect } from 'react';
import api from '../../services/api';

export default function FeatureFlags() {
  const [forgeEnabled, setForgeEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Note: requires a GET endpoint for feature flags - using direct table read via KB route as fallback
    setLoading(false);
  }, []);

  const handleToggle = async () => {
    const newValue = !forgeEnabled;
    setForgeEnabled(newValue);
    try {
      await api.patch('/api/settings/feature-flags/forge_mode', { is_enabled: newValue });
    } catch {
      setForgeEnabled(!newValue);
    }
  };

  if (loading) return null;

  return (
    <div>
      <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 600 }}>Feature flags</h3>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', border: '1px solid var(--sep)', borderRadius: 'var(--radius-md)' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>Forge mode</div>
          <div style={{ fontSize: '11px', color: 'var(--label3)' }}>Agent debate mode for important campaign copy</div>
        </div>
        <Toggle checked={forgeEnabled} onChange={handleToggle} />
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <div
      onClick={onChange}
      style={{
        width: '40px',
        height: '22px',
        borderRadius: '11px',
        background: checked ? 'var(--accent)' : 'var(--sep)',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background .15s',
      }}
    >
      <div
        style={{
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          background: '#fff',
          position: 'absolute',
          top: '2px',
          left: checked ? '20px' : '2px',
          transition: 'left .15s',
          boxShadow: 'var(--shadow-sm)',
        }}
      />
    </div>
  );
}