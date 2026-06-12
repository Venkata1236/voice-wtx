const SUGGESTED_TAGS = ['Bold', 'Energetic', 'Conversational', 'Premium', 'Playful', 'Urban', 'Minimal'];

export default function ToneTags({ activeTags, onToggle }) {
  // Combine active tags with suggestions, deduped
  const allTags = [...new Set([...activeTags, ...SUGGESTED_TAGS])];

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {allTags.map((tag) => {
        const active = activeTags.includes(tag);
        return (
          <span
            key={tag}
            onClick={() => onToggle(tag)}
            style={{
              padding: '3px 10px',
              borderRadius: 'var(--radius-md)',
              fontSize: '11px',
              cursor: 'pointer',
              border: active ? 'none' : '1px solid var(--sep)',
              background: active ? 'var(--accent-light)' : 'transparent',
              color: active ? '#B8890A' : 'var(--label3)',
              fontWeight: active ? 600 : 400,
            }}
          >
            {tag}
          </span>
        );
      })}
    </div>
  );
}