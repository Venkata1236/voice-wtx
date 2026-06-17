export default function Topbar({ activeView, setActiveView, mode, setMode, onOpenKB, onOpenSettings, forgeEnabled }) {
  // Mode buttons (Single / Compare) live in chat. View buttons (Chat / Insights)
  // switch the surface. Rendered adjacent so the row reads: Single Compare Chat Insights.
  const viewTabs = [
    { key: 'chat', label: 'Chat' },
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

      {/* Single · Compare · Chat · Insights */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Mode group — only highlighted while on the chat surface */}
        <Segmented
          options={[
            { key: 'single', label: 'Single' },
            { key: 'compare', label: 'Compare' },
          ]}
          activeKey={activeView === 'chat' ? mode : null}
          onSelect={(k) => setMode(k)}
        />

        {/* View group */}
        <Segmented
          options={viewTabs}
          activeKey={activeView}
          onSelect={(k) => setActiveView(k)}
        />
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

// ── Reusable segmented control ─────────────────────────────────────
function Segmented({ options, activeKey, onSelect }) {
  return (
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
      {options.map((o) => {
        const active = o.key === activeKey;
        return (
          <button
            key={o.key}
            onClick={() => onSelect(o.key)}
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
            {o.label}
          </button>
        );
      })}
    </div>
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