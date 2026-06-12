const COLOR_MAP = {
  yellow: '#FFF8DC',
  green: '#E8F5E9',
  red: '#FFEBEE',
  blue: '#E3F2FD',
  orange: '#FFF3E0',
  purple: '#F3E5F5',
};

const TAG_LABELS = {
  client_feedback: 'Client feedback',
  brand_rule: 'Brand rule',
  important: 'Important',
  follow_up: 'Follow up',
  research: 'Research',
};

export default function NoteCard({ note, onTogglePin, onDelete, onEdit }) {
  return (
    <div
      style={{
        background: COLOR_MAP[note.color] || COLOR_MAP.yellow,
        borderRadius: 'var(--radius-md)',
        padding: '12px',
        position: 'relative',
        minHeight: '100px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {note.is_pinned && (
        <span style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '12px' }}>📌</span>
      )}

      {note.tag && (
        <span
          style={{
            fontSize: '9px',
            fontWeight: 700,
            textTransform: 'uppercase',
            color: 'var(--label2)',
            background: 'rgba(255,255,255,0.6)',
            padding: '2px 6px',
            borderRadius: 'var(--radius-sm)',
            alignSelf: 'flex-start',
            marginBottom: '6px',
          }}
        >
          {TAG_LABELS[note.tag] || note.tag}
        </span>
      )}

      <div
        style={{ fontSize: '13px', color: 'var(--label)', lineHeight: 1.6, flex: 1, whiteSpace: 'pre-wrap' }}
        dangerouslySetInnerHTML={{ __html: note.content }}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
        <span onClick={() => onTogglePin(note.id)} style={iconStyle} title="Pin">
          {note.is_pinned ? 'Unpin' : 'Pin'}
        </span>
        <span onClick={() => onEdit(note)} style={iconStyle} title="Edit">
          Edit
        </span>
        <span onClick={() => onDelete(note.id)} style={{ ...iconStyle, color: 'var(--red)' }} title="Delete">
          Delete
        </span>
      </div>
    </div>
  );
}

const iconStyle = {
  fontSize: '11px',
  cursor: 'pointer',
  color: 'var(--label2)',
  fontWeight: 500,
};