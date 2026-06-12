const MODELS = {
  priority: [
    { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', provider: 'Anthropic', color: '#D97706' },
    { value: 'sarvam-30b', label: 'Sarvam 30B', provider: 'Sarvam', color: '#ea580c' },
  ],
  alternatives: [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'OpenAI', color: '#10a37f' },
    { value: 'gemini-1.5-flash', label: 'Gemini Flash', provider: 'Google', color: '#4285f4' },
  ],
};

const ALL_MODELS = [...MODELS.priority, ...MODELS.alternatives];

export default function ModelSelector({ value, onChange, openUp = false }) {
  const [open, setOpen] = useState(false);
  const current = ALL_MODELS.find((m) => m.value === value) || ALL_MODELS[0];

  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          background: 'var(--surface)',
          border: '1px solid var(--sep)',
          borderRadius: 'var(--radius-xl)',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: current.color }} />
        <span style={{ fontSize: '13px', fontWeight: 500 }}>{current.label}</span>
        <span style={{ fontSize: '11px', color: 'var(--label3)' }}>{current.provider}</span>
        <span style={{ fontSize: '9px', color: 'var(--label3)', transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
      </div>

      {open && (
        <div
          style={{
            position: 'absolute',
            ...(openUp ? { bottom: 'calc(100% + 6px)' } : { top: 'calc(100% + 6px)' }),
            left: 0,
            width: '260px',
            background: 'rgba(255,255,255,.97)',
            border: '1px solid var(--sep)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-md)',
            zIndex: 50,
            padding: '6px',
          }}
        >
          <div style={sectionLabel}>Priority</div>
          {MODELS.priority.map((m) => (
            <ModelRow key={m.value} model={m} selected={m.value === value} onClick={() => { onChange(m.value); setOpen(false); }} />
          ))}
          <div style={sectionLabel}>Alternatives</div>
          {MODELS.alternatives.map((m) => (
            <ModelRow key={m.value} model={m} selected={m.value === value} onClick={() => { onChange(m.value); setOpen(false); }} />
          ))}
        </div>
      )}
    </div>
  );
}

function ModelRow({ model, selected, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '9px',
        padding: '8px 9px',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        background: selected ? 'var(--accent-light)' : 'transparent',
      }}
    >
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: model.color, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: 600 }}>{model.label}</div>
        <div style={{ fontSize: '10px', color: 'var(--label3)' }}>{model.provider}</div>
      </div>
    </div>
  );
}

const sectionLabel = {
  fontSize: '10px',
  fontWeight: 700,
  color: 'var(--label3)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  padding: '6px 8px 3px',
};

import { useState } from 'react';