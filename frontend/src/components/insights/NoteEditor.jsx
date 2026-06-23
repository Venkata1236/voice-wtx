import { useState } from 'react';

const COLORS = ['yellow', 'green', 'red', 'blue', 'orange', 'purple'];

const PREDEFINED = [
  { value: 'misc', label: 'Miscellaneous' },
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

export default function NoteEditor({ note, onSave, onCancel, existingTags = [], onDeleteTag }) {
  const [content, setContent] = useState(note?.content || '');
  const [color, setColor] = useState(note?.color || 'yellow');
  const [tag, setTag] = useState(note?.tag || 'misc');
  const [adding, setAdding] = useState(false);
  const [newTag, setNewTag] = useState('');

  const predefinedValues = PREDEFINED.map((t) => t.value);
  // Custom tags = those used by existing notes + the one currently selected (if new)
  const customTags = [
    ...new Set(
      [...existingTags, tag].filter((t) => t && !predefinedValues.includes(t))
    ),
  ];

  const handleSave = () => {
    if (!content.trim()) return;
    onSave({ content, color, tag: tag || 'misc' });
  };

  const addNewTag = () => {
    const t = newTag.trim();
    if (!t) return;
    setTag(t);
    setAdding(false);
    setNewTag('');
  };

  return (
    <div style={{
      border: '1px solid var(--sep)', borderRadius: 'var(--radius-lg)',
      padding: '14px', background: '#fff', display: 'flex', flexDirection: 'column', gap: '12px',
    }}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What's worth remembering?"
        rows={4}
        autoFocus
        style={{
          padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--sep)',
          fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', outline: 'none',
        }}
      />

      {/* Colour swatches */}
      <div style={{ display: 'flex', gap: '6px' }}>
        {COLORS.map((c) => (
          <span
            key={c}
            onClick={() => setColor(c)}
            style={{
              width: '20px', height: '20px', borderRadius: '50%', background: COLOR_MAP[c],
              border: color === c ? '2px solid var(--accent)' : '1px solid var(--sep)', cursor: 'pointer',
            }}
          />
        ))}
      </div>

      {/* Tag chips */}
      <div>
        <div style={{ fontSize: '11px', color: 'var(--label3)', marginBottom: '6px' }}>Tag</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          {PREDEFINED.map((t) => (
            <Chip key={t.value} label={t.label} active={tag === t.value} onClick={() => setTag(t.value)} />
          ))}

          {customTags.map((t) => (
            <span key={t} style={{ display: 'inline-flex', alignItems: 'center' }}>
              <Chip label={t} active={tag === t} onClick={() => setTag(t)} />
              {onDeleteTag && (
                <button
                  type="button"
                  title="Delete this tag everywhere"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete the "${t}" tag from all notes? They'll become Miscellaneous.`)) {
                      if (tag === t) setTag('misc');
                      onDeleteTag(t);
                    }
                  }}
                  style={{
                    marginLeft: '-2px', width: '18px', height: '18px', borderRadius: '50%',
                    border: 'none', background: 'transparent', color: 'var(--label3)',
                    cursor: 'pointer', fontSize: '13px', lineHeight: 1,
                  }}
                >
                  ×
                </button>
              )}
            </span>
          ))}

          {adding ? (
            <span style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
              <input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNewTag(); } }}
                placeholder="New tag…"
                autoFocus
                style={{
                  padding: '4px 8px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--sep)',
                  fontSize: '12px', fontFamily: 'inherit', outline: 'none', width: '110px',
                }}
              />
              <button type="button" onClick={addNewTag} style={{ ...chipBtn, background: '#1E1E2A', color: '#fff', border: 'none' }}>Add</button>
              <button type="button" onClick={() => { setAdding(false); setNewTag(''); }} style={chipBtn}>×</button>
            </span>
          ) : (
            <button type="button" onClick={() => setAdding(true)} title="Add your own tag" style={chipBtn}>
              + Tag
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button onClick={onCancel} style={secondaryBtn}>Cancel</button>
        <button onClick={handleSave} style={primaryBtn}>Save</button>
      </div>
    </div>
  );
}

function Chip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '5px 11px', borderRadius: 'var(--radius-xl)',
        border: active ? '1px solid var(--accent)' : '1px solid var(--sep)',
        background: active ? 'var(--surface2)' : 'transparent',
        color: 'var(--label2)', fontSize: '12px', fontWeight: active ? 600 : 500,
        cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  );
}

const chipBtn = {
  padding: '5px 10px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--sep)',
  background: 'transparent', color: 'var(--label2)', fontSize: '12px', fontWeight: 500,
  cursor: 'pointer', fontFamily: 'inherit',
};

const secondaryBtn = {
  padding: '7px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--sep)',
  background: 'transparent', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
};

const primaryBtn = {
  padding: '7px 14px', borderRadius: 'var(--radius-md)', border: 'none', background: '#1E1E2A',
  color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};