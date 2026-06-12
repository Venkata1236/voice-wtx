const GENERATORS = [
  { value: 'Vikram', label: 'Vikram', desc: 'Performance writer' },
  { value: 'Priya', label: 'Priya', desc: 'Regional voice' },
];

const CRITICS = [
  { value: 'Maya', label: 'Maya', desc: 'Brand guardian' },
  { value: 'Arjun', label: 'Arjun', desc: 'Digital native' },
];

export default function AgentSelector({ generator, critic, onGeneratorChange, onCriticChange }) {
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <Pill label="Generator" options={GENERATORS} value={generator} onChange={onGeneratorChange} color="#7c3aed" />
      <span style={{ fontSize: '12px', color: 'var(--label3)' }}>vs</span>
      <Pill label="Critic" options={CRITICS} value={critic} onChange={onCriticChange} color="#D85A30" />
    </div>
  );
}

function Pill({ label, options, value, onChange, color }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 10px',
        background: 'var(--surface)',
        border: '1px solid var(--sep)',
        borderRadius: 'var(--radius-xl)',
      }}
    >
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: color }} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          border: 'none',
          background: 'transparent',
          fontSize: '13px',
          fontWeight: 500,
          fontFamily: 'inherit',
          outline: 'none',
          cursor: 'pointer',
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label} — {opt.desc}
          </option>
        ))}
      </select>
    </div>
  );
}