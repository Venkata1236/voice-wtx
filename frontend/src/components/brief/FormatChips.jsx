const FORMATS = [
  { value: 'reel_hook', label: 'Reel Hook' },
  { value: 'caption', label: 'Caption' },
  { value: 'carousel', label: 'Carousel' },
  { value: 'story', label: 'Story' },
  { value: 'linkedin', label: 'LinkedIn' },
];

export default function FormatChips({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {FORMATS.map((format) => {
        const active = value === format.value;
        return (
          <button
            key={format.value}
            onClick={() => onChange(format.value)}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-md)',
              border: active ? 'none' : '1px solid var(--sep)',
              background: active ? 'var(--surface)' : 'transparent',
              fontWeight: active ? 600 : 400,
              fontSize: '12px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              color: 'var(--label)',
            }}
          >
            {format.label}
          </button>
        );
      })}
    </div>
  );
}