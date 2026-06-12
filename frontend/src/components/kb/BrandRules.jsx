import { useState } from 'react';

export default function BrandRules({ title, rules, onAdd, onRemove, color }) {
  const [newRule, setNewRule] = useState('');

  const handleAdd = () => {
    if (!newRule.trim()) return;
    onAdd(newRule.trim());
    setNewRule('');
  };

  return (
    <div>
      <p style={{ margin: '0 0 6px', color: 'var(--label3)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>
        {title}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
        {rules.map((rule, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
              padding: '6px 8px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface)',
              gap: '8px',
            }}
          >
            <span style={{ flex: 1, color: 'var(--label2)' }}>{rule}</span>
            <span
              onClick={() => onRemove(i)}
              style={{ cursor: 'pointer', color: 'var(--label3)', fontSize: '12px' }}
            >
              ×
            </span>
          </div>
        ))}
        {rules.length === 0 && (
          <div style={{ fontSize: '12px', color: 'var(--label3)' }}>None set</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          value={newRule}
          onChange={(e) => setNewRule(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add a rule..."
          style={{
            flex: 1,
            padding: '6px 8px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--sep)',
            fontSize: '12px',
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        <button
          onClick={handleAdd}
          style={{
            padding: '6px 10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--sep)',
            background: 'transparent',
            fontSize: '12px',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}