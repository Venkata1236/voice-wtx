import { useState } from 'react';

const MODEL_LABELS = {
  'claude-haiku-4-5': 'Haiku 4.5',
  'sarvam': 'Sarvam',
  'gpt-4o-mini': 'GPT',
  'gemini-1.5-flash': 'Gemini',
};

export default function VariantCard({ variant }) {
  const [copied, setCopied] = useState(false);

  const isStreaming = variant.streaming === true;

  const handleCopy = () => {
    navigator.clipboard.writeText(variant.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--sep)',
        borderLeft: '3px solid var(--label4)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        marginTop: '10px',
        boxShadow: 'var(--shadow-sm)',
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
          {MODEL_LABELS[variant.model] || variant.model}
        </span>

        {!isStreaming && (
          <button
            onClick={handleCopy}
            title={copied ? 'Copied!' : 'Copy'}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              color: copied ? 'var(--green)' : 'var(--label3)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.05)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {copied ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '14px 14px 10px', fontSize: '13.5px', color: 'var(--label2)', lineHeight: 1.75, minHeight: '60px' }}>
        {variant.content || (isStreaming && (
          <span style={{ color: 'var(--label3)', fontSize: '12px' }}>Generating...</span>
        ))}
        {isStreaming && variant.content && (
          <span
            style={{
              display: 'inline-block',
              width: '2px',
              height: '14px',
              background: 'var(--label3)',
              marginLeft: '2px',
              animation: 'blink 1s step-end infinite',
              verticalAlign: 'text-bottom',
            }}
          />
        )}
      </div>

      {/* Keywords */}
      {!isStreaming && variant.keywords && variant.keywords.length > 0 && (
        <div style={{ padding: '0 14px 12px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {variant.keywords.map((kw, i) => (
            <span
              key={i}
              onClick={() => navigator.clipboard.writeText(kw)}
              title="Click to copy"
              style={{
                padding: '3px 8px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface2)',
                color: 'var(--label2)',
                fontSize: '11px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {kw}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}