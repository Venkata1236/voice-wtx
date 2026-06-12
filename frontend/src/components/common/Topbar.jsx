import { useAuthStore } from '../../store/authStore';

export default function Topbar({ activeView, setActiveView, onOpenKB, onOpenSettings, forgeEnabled }) {
  const user = useAuthStore((state) => state.user);

  const initials = user?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  const tabs = [
    { key: 'single', label: 'Single' },
    { key: 'compare', label: 'Compare' },
    ...(forgeEnabled ? [{ key: 'forge', label: '⚡ Forge' }] : []),
    { key: 'insights', label: 'Insights' },
  ];

  return (
    <header
      style={{
        height: '52px',
        background: '#fff',
        borderBottom: '1px solid var(--sep)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        flexShrink: 0,
        boxShadow: '0 1px 0 var(--sep)',
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700 }}>
        <span style={{ fontWeight: 800, letterSpacing: '-0.5px' }}>WTX</span>
        <div style={{ width: '1px', height: '14px', background: 'var(--sep)' }} />
        <span style={{ fontWeight: 600, color: 'var(--accent)' }}>Voice</span>
      </div>

      {/* Segmented control */}
      <div
        style={{
          display: 'flex',
          background: 'var(--surface)',
          borderRadius: '9px',
          padding: '2px',
          gap: '1px',
          border: '1px solid var(--sep)',
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveView(tab.key)}
            style={{
              padding: '5px 16px',
              borderRadius: '7px',
              border: 'none',
              background: activeView === tab.key ? '#fff' : 'transparent',
              color: activeView === tab.key ? '#1E1E2A' : 'var(--label3)',
              fontSize: '13px',
              fontWeight: activeView === tab.key ? 600 : 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: activeView === tab.key ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button onClick={onOpenKB} style={sfBtnStyle}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)' }} />
          Knowledge Base
        </button>
        <button onClick={onOpenSettings} style={sfBtnStyle}>
          Settings
        </button>
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 700,
            color: '#1E1E2A',
            cursor: 'pointer',
          }}
          title={user?.full_name}
        >
          {initials}
        </div>
      </div>
    </header>
  );
}

const sfBtnStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
  padding: '6px 12px',
  background: '#fff',
  border: '1px solid var(--sep)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--label2)',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
  boxShadow: 'var(--shadow-sm)',
};