import { useState, useEffect } from 'react';
import { exportService } from '../../services/exportService';

const FORMATS = [
  { value: 'plain_text', label: 'Plain text', desc: 'Google Docs, WhatsApp, decks' },
  { value: 'csv', label: 'CSV', desc: 'Buffer, Hootsuite, Sheets' },
  { value: 'kb_archive', label: 'KB archive', desc: 'Full records with metadata' },
];

export default function ExportPanel({ brandId, sessionId, onClose }) {
  const [format, setFormat] = useState('plain_text');
  const [filter, setFilter] = useState('approved_only');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    exportService.preview(brandId, filter).then(setPreview).catch(() => setPreview(null));
  }, [brandId, filter]);

  const handleExport = async (download) => {
    setLoading(true);
    setError('');

    try {
      const { blob, filename } = await exportService.export({
        brand_id: brandId,
        session_id: sessionId,
        format,
        filter,
      });

      if (download) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const text = await blob.text();
        await navigator.clipboard.writeText(text);
        alert('Copied to clipboard');
      }
    } catch (err) {
      setError('No copy found to export. Try switching the filter.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Export copy</h3>
          <span onClick={onClose} style={{ cursor: 'pointer', color: 'var(--label3)', fontSize: '16px' }}>×</span>
        </div>

        {/* Filter */}
        <div style={{ marginBottom: '14px' }}>
          <p style={labelStyle}>Filter</p>
          <div style={{ display: 'flex', gap: '6px' }}>
            <FilterChip active={filter === 'approved_only'} onClick={() => setFilter('approved_only')}>
              Approved only
            </FilterChip>
            <FilterChip active={filter === 'all_variants'} onClick={() => setFilter('all_variants')}>
              All variants
            </FilterChip>
          </div>
          {filter === 'all_variants' && (
            <p style={{ fontSize: '11px', color: 'var(--orange)', marginTop: '6px' }}>
              Includes rejected and unreviewed copy — not safe for client delivery.
            </p>
          )}
        </div>

        {/* Format */}
        <div style={{ marginBottom: '14px' }}>
          <p style={labelStyle}>Format</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {FORMATS.map((f) => (
              <div
                key={f.value}
                onClick={() => setFormat(f.value)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--sep)',
                  background: format === f.value ? 'var(--accent-light)' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 600 }}>{f.label}</span>
                <span style={{ fontSize: '11px', color: 'var(--label3)' }}>{f.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Preview count */}
        {preview && (
          <p style={{ fontSize: '12px', color: 'var(--label3)', marginBottom: '14px' }}>
            {preview.total} variant{preview.total !== 1 ? 's' : ''} ready to export
          </p>
        )}

        {error && (
          <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--red-bg)', color: 'var(--red)', fontSize: '12px', marginBottom: '10px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button onClick={() => handleExport(false)} disabled={loading} style={secondaryBtn}>
            Copy
          </button>
          <button onClick={() => handleExport(true)} disabled={loading} style={primaryBtn}>
            Download
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '5px 12px',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--sep)',
        background: active ? 'var(--accent-light)' : 'transparent',
        fontSize: '12px',
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
      }}
    >
      {children}
    </div>
  );
}

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const modalStyle = {
  background: '#fff',
  borderRadius: 'var(--radius-lg)',
  padding: '20px',
  width: '380px',
  boxShadow: 'var(--shadow-md)',
};

const labelStyle = {
  margin: '0 0 8px',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--label3)',
  textTransform: 'uppercase',
};

const secondaryBtn = {
  padding: '8px 16px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--sep)',
  background: 'transparent',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const primaryBtn = {
  padding: '8px 16px',
  borderRadius: 'var(--radius-md)',
  border: 'none',
  background: '#1E1E2A',
  color: '#fff',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};