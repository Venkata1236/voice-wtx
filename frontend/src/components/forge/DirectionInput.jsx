import { useState } from 'react';

export default function DirectionInput({ onAgree, onDirection, onApprove, loading }) {
  const [direction, setDirection] = useState('');
  const [showInput, setShowInput] = useState(false);

  const handleSendDirection = () => {
    if (!direction.trim()) return;
    onDirection(direction.trim());
    setDirection('');
    setShowInput(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {showInput && (
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendDirection()}
            placeholder="Tell the generator what to change..."
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--sep)',
              fontSize: '13px',
              fontFamily: 'inherit',
              outline: 'none',
            }}
            autoFocus
          />
          <button onClick={handleSendDirection} style={primaryBtn}>Send</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={onAgree} disabled={loading} style={secondaryBtn}>
          Agree
        </button>
        <button onClick={() => setShowInput(!showInput)} disabled={loading} style={secondaryBtn}>
          My direction
        </button>
        <button onClick={onApprove} disabled={loading} style={{ ...secondaryBtn, borderColor: 'rgba(34,197,94,.35)', color: 'var(--green)', background: 'var(--green-bg)' }}>
          Approve
        </button>
      </div>
    </div>
  );
}

const secondaryBtn = {
  padding: '7px 14px',
  borderRadius: 'var(--radius-xl)',
  border: '1px solid var(--sep)',
  background: 'transparent',
  color: 'var(--label2)',
  fontSize: '12px',
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const primaryBtn = {
  padding: '8px 14px',
  borderRadius: 'var(--radius-md)',
  border: 'none',
  background: '#1E1E2A',
  color: '#fff',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};