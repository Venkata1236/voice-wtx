import { useState, useEffect } from 'react';
import { kbService } from '../../services/kbService';
import ToneTags from './ToneTags';
import BrandRules from './BrandRules';
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

  const handleAddRule = async (type, rule) => {
    const key = type === 'do' ? 'rules_do' : 'rules_dont';
    const apiKey = type === 'do' ? 'brand_rules_do' : 'brand_rules_dont';
    const newRules = [...kb[key], rule];

    setKb({ ...kb, [key]: newRules });
    await kbService.updateKB(brand.id, { [apiKey]: newRules });
  };

  const handleRemoveRule = async (type, index) => {
    const key = type === 'do' ? 'rules_do' : 'rules_dont';
    const apiKey = type === 'do' ? 'brand_rules_do' : 'brand_rules_dont';
    const newRules = kb[key].filter((_, i) => i !== index);

    setKb({ ...kb, [key]: newRules });
    await kbService.updateKB(brand.id, { [apiKey]: newRules });
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

        {/* DO rules */}
        <BrandRules
          title="Always do"
          rules={kb.rules_do || kb.brand_rules_do || []}
          onAdd={(rule) => handleAddRule('do', rule)}
          onRemove={(i) => handleRemoveRule('do', i)}
        />

        {/* DONT rules */}
        <BrandRules
          title="Never do"
          rules={kb.rules_dont || kb.brand_rules_dont || []}
          onAdd={(rule) => handleAddRule('dont', rule)}
          onRemove={(i) => handleRemoveRule('dont', i)}
        />

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