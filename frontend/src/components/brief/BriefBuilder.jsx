import { useState } from 'react';

export default function BriefBuilder({ onBuild, kb }) {
  const [fields, setFields] = useState({
    platform: '',
    objective: '',
    hero_product: kb?.brief_template?.hero_product || '',
    cta: kb?.brief_template?.cta || '',
    tone_override: kb?.brief_template?.tone_direction || '',
    length: '',
    notes: '',
  });

  const update = (key, value) => setFields((f) => ({ ...f, [key]: value }));

  const handleBuild = () => {
    onBuild(fields);
  };

  return (
    <div
      style={{
        border: '1px solid var(--sep)',
        borderRadius: 'var(--radius-lg)',
        padding: '14px',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px',
        background: 'var(--surface)',
      }}
    >
      <Field label="Platform" value={fields.platform} onChange={(v) => update('platform', v)} placeholder="Instagram" />
      <Field label="Objective" value={fields.objective} onChange={(v) => update('objective', v)} placeholder="Drive app downloads" />
      <Field label="Hero product" value={fields.hero_product} onChange={(v) => update('hero_product', v)} placeholder="Alphonso mango" />
      <Field label="Call to action" value={fields.cta} onChange={(v) => update('cta', v)} placeholder="Order now" />
      <Field label="Tone override" value={fields.tone_override} onChange={(v) => update('tone_override', v)} placeholder="Conversational hinglish" />
      <Field label="Length" value={fields.length} onChange={(v) => update('length', v)} placeholder="Under 50 words" />

      <div style={{ gridColumn: 'span 2' }}>
        <Field label="Notes" value={fields.notes} onChange={(v) => update('notes', v)} placeholder="Mention Ratnagiri origin" />
      </div>

      <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={handleBuild}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: '#1E1E2A',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Build brief
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--label3)', marginBottom: '4px' }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '7px 10px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--sep)',
          fontSize: '13px',
          fontFamily: 'inherit',
          outline: 'none',
          background: '#fff',
        }}
      />
    </div>
  );
}