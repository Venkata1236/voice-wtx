import { useState, useEffect } from 'react';
import { kbService } from '../../services/kbService';
import ToneTags from './ToneTags';
import DocumentUpload from './DocumentUpload';

export default function KBPanel({ brand, kb: initialKb, onClose }) {
  const [kb, setKb] = useState(initialKb);

  useEffect(() => {
    setKb(initialKb);
  }, [initialKb]);

  const refresh = async () => {
    const updated = await kbService.getKB(brand.id);
    setKb(updated);
  };

  // Fetch the latest KB (including document approval status) whenever the
  // panel opens, so an approval done elsewhere shows without a full refresh.
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!kb) {
    return (
      <div style={panelStyle}>
        <PanelHeader onClose={onClose} />
        <div style={{ padding: '16px', color: 'var(--label3)', fontSize: '13px' }}>Loading...</div>
      </div>
    );
  }

  const handleToggleTag = async (tag) => {
    const newTags = kb.tone_tags.includes(tag)
      ? kb.tone_tags.filter((t) => t !== tag)
      : [...kb.tone_tags, tag];

    setKb({ ...kb, tone_tags: newTags });
    await kbService.updateKB(brand.id, { tone_tags: newTags });
  };

  const brandDoc = kb.documents?.find((d) => d.doc_type === 'brand_document');
  const personasDoc = kb.documents?.find((d) => d.doc_type === 'audience_personas');

  return (
    <div style={panelStyle}>
      <PanelHeader onClose={onClose} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Stats */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', padding: '10px' }}>
          <p style={{ margin: 0, fontSize: '11px', color: 'var(--label3)' }}>Posts in KB</p>
          <p style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>{kb.approved_posts_count}</p>
        </div>

        {/* Tone tags */}
        <div>
          <p style={labelStyle}>Tone tags</p>
          <ToneTags activeTags={kb.tone_tags || []} onToggle={handleToggleTag} />
        </div>

        {/* Documents */}
        <div>
          <p style={labelStyle}>Documents</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <DocumentUpload
              brandId={brand.id}
              docType="brand_document"
              label="Brand document"
              document={brandDoc}
              onUploaded={refresh}
            />
            <DocumentUpload
              brandId={brand.id}
              docType="audience_personas"
              label="Audience personas"
              document={personasDoc}
              onUploaded={refresh}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PanelHeader({ onClose }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 14px',
        borderBottom: '1px solid var(--sep)',
      }}
    >
      <span style={{ fontWeight: 600, fontSize: '14px' }}>Knowledge base</span>
      <span onClick={onClose} style={{ cursor: 'pointer', color: 'var(--label3)', fontSize: '16px' }}>×</span>
    </div>
  );
}

const panelStyle = {
  width: '280px',
  borderLeft: '1px solid var(--sep)',
  background: '#fff',
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
  overflow: 'hidden',
};

const labelStyle = {
  margin: '0 0 6px',
  color: 'var(--label3)',
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
};