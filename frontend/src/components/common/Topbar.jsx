export default function Topbar({ activeView, setActiveView, mode, setMode, onOpenKB, onOpenSettings, forgeEnabled }) {
  // One combined control: Single · Compare · Chat · Insights
  // Single/Compare set the chat mode; Chat/Insights switch the view.
  const tabs = [
    { key: 'single', label: 'Single' },
    { key: 'compare', label: 'Compare' },
    { key: 'chat', label: 'Chat' },
    { key: 'insights', label: 'Notes' },
    ...(forgeEnabled ? [{ key: 'forge', label: '⚡ Forge' }] : []),
  ];

  // Exactly one button is active: in chat the active one is the mode,
  // otherwise it's the current view.
  const activeKey = activeView === 'chat' ? mode : activeView;

  const handleSelect = (k) => {
    if (k === 'single' || k === 'compare') {
      setMode(k); // sets mode AND switches to the chat surface
    } else {
      setActiveView(k); // 'chat' | 'insights' | 'forge'
    }
  };

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

      {/* Single · Compare · Chat · Insights — one control */}
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
        {tabs.map((t) => {
          const active = t.key === activeKey;
          return (
            <button
              key={t.key}
              onClick={() => handleSelect(t.key)}
              style={{
                padding: '5px 16px',
                borderRadius: '7px',
                border: 'none',
                background: active ? '#fff' : 'transparent',
                color: active ? '#1E1E2A' : 'var(--label3)',
                fontSize: '13px',
                fontWeight: active ? 600 : 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: active ? 'var(--shadow-sm)' : 'none',
              }}
            >
              {t.label}
            </button>
          );
        })}
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