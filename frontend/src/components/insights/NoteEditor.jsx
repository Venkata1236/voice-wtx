import { useState } from 'react';

const COLORS = ['yellow', 'green', 'red', 'blue', 'orange', 'purple'];
const TAGS = [
  { value: '', label: 'No tag' },
  { value: 'client_feedback', label: 'Client feedback' },
  { value: 'brand_rule', label: 'Brand rule' },
  { value: 'important', label: 'Important' },
  { value: 'follow_up', label: 'Follow up' },
  { value: 'research', label: 'Research' },
];

const COLOR_MAP = {
  yellow: '#FFF8DC',
  green: '#E8F5E9',
  red: '#FFEBEE',
  blue: '#E3F2FD',
  orange: '#FFF3E0',
  purple: '#F3E5F5',
};

export default function NoteEditor({ note, onSave, onCancel }) {
  const [content, setContent] = useState(note?.content || '');
  const [color, setColor] = useState(note?.color || 'yellow');
  const [tag, setTag] = useState(note?.tag || '');

  const handleSave = () => {
    if (!content.trim()) return;
    onSave({ content, color, tag: tag || null });
  };

  return (
    <div
      style={{
        border: '1px solid var(--sep)',
        borderRadius: 'var(--radius-lg)',
        padding: '14px',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What's worth remembering?"
        rows={4}
        autoFocus
        style={{
          padding: '8px 10px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--sep)',
          fontSize: '13px',
          fontFamily: 'inherit',
          resize: 'vertical',
          outline: 'none',
        }}
      />

      <div style={{ display: 'flex', gap: '6px' }}>
        {COLORS.map((c) => (
          <span
            key={c}
            onClick={() => setColor(c)}
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: COLOR_MAP[c],
              border: color === c ? '2px solid var(--accent)' : '1px solid var(--sep)',
              cursor: 'pointer',
            }}
          />
        ))}
      </div>

      <select
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        style={{
          padding: '6px 8px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--sep)',
          fontSize: '12px',
          fontFamily: 'inherit',
        }}
      >
        {TAGS.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button onClick={onCancel} style={secondaryBtn}>Cancel</button>
        <button onClick={handleSave} style={primaryBtn}>Save</button>
      </div>
    </div>
  );
}

const secondaryBtn = {
  padding: '7px 14px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--sep)',
  background: 'transparent',
  fontSize: '12px',
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const primaryBtn = {
  padding: '7px 14px',
  borderRadius: 'var(--radius-md)',
  border: 'none',
  background: '#1E1E2A',
  color: '#fff',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};