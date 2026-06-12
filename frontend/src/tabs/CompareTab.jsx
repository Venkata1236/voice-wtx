import { useState, useEffect } from 'react';
import { compareService } from '../services/compareService';
import { copyService } from '../services/copyService';
import FormatChips from '../components/brief/FormatChips';
import ModelSelector from '../components/compare/ModelSelector';
import VariantCard from '../components/variants/VariantCard';

export default function CompareTab({ brand, activeSessionId, onSessionCreated }) {
  const [format, setFormat] = useState('caption');
  const [briefText, setBriefText] = useState('');
  const [modelA, setModelA] = useState('claude-haiku-4-5');
  const [modelB, setModelB] = useState('sarvam-m');
  const [variantA, setVariantA] = useState(null);
  const [variantB, setVariantB] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState(activeSessionId);

  useEffect(() => {
    if (activeSessionId) {
      setSessionId(activeSessionId);
      compareService.getSessionVariants(activeSessionId).then((variants) => {
        if (variants.length >= 2) {
          setVariantA(variants[0]);
          setVariantB(variants[1]);
        }
      });
    } else {
      setSessionId(null);
      setVariantA(null);
      setVariantB(null);
      setBriefText('');
    }
  }, [activeSessionId]);

  const handleGenerate = async () => {
    if (!briefText.trim()) return;

    setLoading(true);
    setError('');

    try {
      const result = await compareService.generate({
        brand_id: brand.id,
        format,
        raw_brief: briefText,
        model_a: modelA,
        model_b: modelB,
        session_id: sessionId,
      });

      setVariantA(result.variant_a);
      setVariantB(result.variant_b);

      if (!sessionId) {
        setSessionId(result.session_id);
        onSessionCreated(result.session_id);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Comparison failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (variantId) => {
    await copyService.approve(variantId, brand.id);
    const variants = await compareService.getSessionVariants(sessionId);
    if (variants.length >= 2) {
      setVariantA(variants[0]);
      setVariantB(variants[1]);
    }
  };

  const handleReject = async (variantId, reason) => {
    await copyService.reject(variantId, brand.id, reason);
    const variants = await compareService.getSessionVariants(sessionId);
    if (variants.length >= 2) {
      setVariantA(variants[0]);
      setVariantB(variants[1]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Two panes side by side */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={paneStyle}>
          <div style={paneHeaderStyle}>
            <ModelSelector value={modelA} onChange={setModelA} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {variantA ? (
              <VariantCard variant={variantA} onApprove={handleApprove} onReject={handleReject} />
            ) : (
              <Placeholder loading={loading} />
            )}
          </div>
        </div>

        <div style={{ ...paneStyle, borderLeft: '1px solid var(--sep)' }}>
          <div style={paneHeaderStyle}>
            <ModelSelector value={modelB} onChange={setModelB} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {variantB ? (
              <VariantCard variant={variantB} onApprove={handleApprove} onReject={handleReject} />
            ) : (
              <Placeholder loading={loading} />
            )}
          </div>
        </div>
      </div>

      {/* Input zone */}
      <div style={{ borderTop: '1px solid var(--sep)', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <FormatChips value={format} onChange={setFormat} />

        {error && (
          <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--red-bg)', color: 'var(--red)', fontSize: '12px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <textarea
            value={briefText}
            onChange={(e) => setBriefText(e.target.value)}
            placeholder="Write one brief — sent to both models..."
            rows={2}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--sep)',
              fontSize: '14px',
              fontFamily: 'inherit',
              resize: 'none',
              outline: 'none',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleGenerate();
              }
            }}
          />
          <button
            onClick={handleGenerate}
            disabled={loading || !briefText.trim()}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: '#1E1E2A',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: loading ? 'default' : 'pointer',
              opacity: loading || !briefText.trim() ? 0.5 : 1,
              fontFamily: 'inherit',
            }}
          >
            Compare
          </button>
        </div>
      </div>
    </div>
  );
}

function Placeholder({ loading }) {
  return (
    <div style={{ textAlign: 'center', color: 'var(--label3)', marginTop: '60px', fontSize: '13px' }}>
      {loading ? 'Generating...' : 'Result will appear here'}
    </div>
  );
}

const paneStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  minWidth: 0,
};

const paneHeaderStyle = {
  padding: '10px 16px',
  borderBottom: '1px solid var(--sep)',
};