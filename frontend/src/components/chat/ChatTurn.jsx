import VariantCard from '../variants/VariantCard';

// ── Pretty model labels ────────────────────────────────────────────
const MODEL_LABELS = {
  'claude-haiku-4-5': 'Haiku 4.5',
  'sarvam-30b': 'Sarvam',
  'gpt-4o-mini': 'GPT',
  'gemini-1.5-flash': 'Gemini',
};
const prettyModel = (m) => MODEL_LABELS[m] || m;

// ── One conversation turn ───────────────────────────────────────────
// Renders the user's brief as a message, then the AI response in the
// layout that matches how it was generated:
//   • single  → variant cards stacked
//   • compare → two model panes side by side
export default function ChatTurn({ turn, onApprove, onReject, onRefine, onMoreLike }) {
  const isCompare = turn.turn_type === 'compare';

  return (
    <div style={{ marginBottom: '28px' }}>
      {/* User message — image (if any) + brief text */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
        {/* Images — previews during streaming, or stored URLs on reload */}
        {(() => {
          const imgs =
            (turn.image_previews && turn.image_previews.length
              ? turn.image_previews
              : turn.image_urls && turn.image_urls.length
              ? turn.image_urls
              : (turn.image_preview || turn.image_url)
              ? [turn.image_preview || turn.image_url]
              : []);
          if (!imgs.length) return null;
          return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'flex-end' }}>
              {imgs.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={`Attached ${i + 1}`}
                  style={{
                    maxWidth: '180px',
                    maxHeight: '180px',
                    borderRadius: '12px',
                    objectFit: 'cover',
                    border: '1px solid var(--sep)',
                  }}
                />
              ))}
            </div>
          );
        })()}
        {turn.brief && (
          <div
            style={{
              maxWidth: '80%',
              background: 'var(--surface2)',
              color: 'var(--label)',
              padding: '10px 14px',
              borderRadius: '14px 14px 4px 14px',
              fontSize: '13.5px',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {turn.brief}
          </div>
        )}
      </div>

      {/* AI response */}
      {isCompare ? (
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          {turn.variants.map((v, i) => (
            <div key={v.id || `pane-${i}`} style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--label3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  padding: '0 2px 6px',
                }}
              >
                {prettyModel(v.model)}
              </div>
              <VariantCard variant={v} onApprove={onApprove} onReject={onReject} onRefine={onRefine} onMoreLike={onMoreLike} />
            </div>
          ))}
        </div>
      ) : (
        <div>
          {turn.variants.map((v, i) => (
            <VariantCard
              key={v.id || `variant-${i}`}
              variant={v}
              onApprove={onApprove}
              onReject={onReject}
              onRefine={onRefine}
              onMoreLike={onMoreLike}
            />
          ))}
        </div>
      )}
    </div>
  );
}