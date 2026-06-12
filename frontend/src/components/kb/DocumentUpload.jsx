import { useRef } from 'react';
import { kbService } from '../../services/kbService';

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
        </div>
      ) : (
        <div style={{ fontSize: '12px', color: 'var(--label3)' }}>No document uploaded</div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx"
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