const REJECTION_REASONS = [
  { value: 'off_brand_tone', label: 'Off-brand tone' },
  { value: 'wrong_format', label: 'Wrong format' },
  { value: 'too_long', label: 'Too long' },
  { value: 'too_short', label: 'Too short' },
  { value: 'cta_missing', label: 'CTA missing' },
  { value: 'rule_violation', label: 'Rule violation' },
  { value: 'wrong_language_mix', label: 'Wrong language mix' },
  { value: 'client_preference', label: 'Client preference' },
];

import { useState } from 'react';

export default function VariantCard({ variant, onApprove, onReject }) {
  const [showRejectMenu, setShowRejectMenu] = useState(false);

  const scoreClass = variant.score >= 80 ? 'hi' : variant.score >= 60 ? 'md' : 'lo';
  const scoreColor = scoreClass === 'hi' ? 'var(--green)' : scoreClass === 'md' ? 'var(--orange)' : 'var(--red)';

  const isApproved = variant.status === 'approved';
  const isRejected = variant.status === 'rejected';

  const handleCopy = () => {
    navigator.clipboard.writeText(variant.content);
  };

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--sep)',
        borderLeft: isApproved ? '3px solid var(--green)' : '3px solid var(--accent)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        marginTop: '10px',
        boxShadow: isApproved ? '0 0 0 1px var(--green), var(--shadow-sm)' : 'var(--shadow-sm)',
        opacity: isRejected ? 0.45 : 1,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid var(--sep)',
          background: 'var(--surface)',
        }}
      >
        <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--label3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {variant.model}
        </span>
        <span style={{ fontSize: '12px', fontWeight: 600, color: scoreColor }}>
          {variant.score}%
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: '14px', fontSize: '13.5px', color: 'var(--label2)', lineHeight: 1.75 }}>
        {variant.content}
      </div>

      {/* Rejection reason banner */}
      {isRejected && variant.rejection_reason && (
        <div
          style={{
            margin: '0 12px 8px',
            padding: '9px 12px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--orange-bg)',
            border: '1px solid rgba(245,158,11,0.2)',
            fontSize: '12px',
            color: 'var(--orange)',
          }}
        >
          <b style={{ display: 'block', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '3px' }}>
            Rejected
          </b>
          {variant.rejection_reason}
        </div>
      )}

      {/* Footer actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '9px 14px',
          borderTop: '1px solid var(--sep)',
          gap: '6px',
          position: 'relative',
        }}
      >
        <button onClick={handleCopy} style={btnStyle}>
          Copy
        </button>

        {!isRejected && (
          <>
            <button
              onClick={() => setShowRejectMenu(!showRejectMenu)}
              style={{ ...btnStyle, borderColor: 'rgba(239,68,68,.3)', color: 'var(--red)', background: 'var(--red-bg)' }}
            >
              Reject
            </button>
            <button
              onClick={() => onApprove(variant.id)}
              style={{
                ...btnStyle,
                borderColor: 'rgba(34,197,94,.35)',
                color: isApproved ? '#fff' : 'var(--green)',
                background: isApproved ? 'var(--green)' : 'var(--green-bg)',
              }}
            >
              {isApproved ? 'Approved' : 'Approve'}
            </button>
          </>
        )}

        {showRejectMenu && (
          <div
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 4px)',
              right: '14px',
              background: '#fff',
              border: '1px solid var(--sep)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-md)',
              padding: '6px',
              zIndex: 10,
              minWidth: '180px',
            }}
          >
            {REJECTION_REASONS.map((reason) => (
              <div
                key={reason.value}
                onClick={() => {
                  onReject(variant.id, reason.value);
                  setShowRejectMenu(false);
                }}
                style={{
                  padding: '7px 10px',
                  fontSize: '12px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {reason.label}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const btnStyle = {
  padding: '5px 12px',
  borderRadius: 'var(--radius-xl)',
  border: '1px solid var(--sep)',
  background: 'transparent',
  color: 'var(--label2)',
  fontSize: '12px',
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
};