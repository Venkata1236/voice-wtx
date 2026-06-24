import { useRef } from 'react';
import { kbService } from '../../services/kbService';

// ── Friendly "time ago" formatter ──────────────────────────────────
function timeAgo(iso) {
  if (!iso) return '';
  const then = new Date(iso);
  if (isNaN(then.getTime())) return '';
  const secs = Math.floor((Date.now() - then.getTime()) / 1000);

  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;

  // Older than a week → show the date
  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function DocumentUpload({ brandId, docType, label, document, onUploaded }) {
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      await kbService.uploadDocument(brandId, docType, file);
      onUploaded();
    } catch (err) {
      alert(err.response?.data?.detail || 'Upload failed');
    }
  };

  const statusColor = {
    pending: 'var(--orange)',
    approved: 'var(--green)',
    rejected: 'var(--red)',
  };

  // Prefer updated_at (reflects re-uploads); fall back to created_at
  const stamp = document?.updated_at || document?.created_at;

  return (
    <div
      style={{
        border: '1px solid var(--sep)',
        borderRadius: 'var(--radius-md)',
        padding: '10px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600 }}>{label}</span>
        {document && (
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              color: statusColor[document.status],
              textTransform: 'uppercase',
            }}
          >
            {document.status}
          </span>
        )}
      </div>

      {document ? (
        <div style={{ fontSize: '12px', color: 'var(--label2)' }}>
          {document.file_name} · {document.word_count} words
          {stamp && (
            <div style={{ fontSize: '11px', color: 'var(--label3)', marginTop: '2px' }}>
              Updated {timeAgo(stamp)}
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: '12px', color: 'var(--label3)' }}>No document uploaded</div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.html,.htm"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      <button
        onClick={() => fileInputRef.current.click()}
        style={{
          marginTop: '8px',
          padding: '5px 10px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--sep)',
          background: 'transparent',
          fontSize: '12px',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {document ? 'Replace' : 'Upload'}
      </button>
    </div>
  );
}