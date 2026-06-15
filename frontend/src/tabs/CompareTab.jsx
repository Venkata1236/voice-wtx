import { useState, useEffect } from 'react';
import { compareService } from '../services/compareService';
import { copyService } from '../services/copyService';
import { useBrandStore } from '../store/brandStore';
import FormatChips from '../components/brief/FormatChips';
import BriefBuilder from '../components/brief/BriefBuilder';
import ModelSelector from '../components/compare/ModelSelector';
import VariantCard from '../components/variants/VariantCard';
import MicButton from '../components/common/MicButton';

export default function CompareTab({ brand, activeSessionId, onSessionCreated }) {
  const kb = useBrandStore((state) => state.kb);

  const [format, setFormat] = useState('caption');
  const [briefText, setBriefText] = useState('');
  const [showBuilder, setShowBuilder] = useState(false);
  const [modelA, setModelA] = useState('claude-haiku-4-5');
  const [modelB, setModelB] = useState('sarvam-30b');
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

  const handleBuildBrief = (fields) => {
    const lines = [`Format: ${format}`];
    if (fields.platform) lines.push(`Platform: ${fields.platform}`);
    if (fields.objective) lines.push(`Objective: ${fields.objective}`);
    if (fields.hero_product) lines.push(`Hero Product: ${fields.hero_product}`);
    if (fields.cta) lines.push(`Call to Action: ${fields.cta}`);
    if (fields.tone_override) lines.push(`Tone Override: ${fields.tone_override}`);
    if (fields.length) lines.push(`Length: ${fields.length}`);
    if (fields.notes) lines.push(`Notes: ${fields.notes}`);
    setBriefText(lines.join('\n'));
    setShowBuilder(false);
  };

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

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <FormatChips value={format} onChange={setFormat} />
        </div>

        {showBuilder && <BriefBuilder onBuild={handleBuildBrief} kb={kb} />}

        {error && (
          <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--red-bg)', color: 'var(--red)', fontSize: '12px' }}>
            {error}
          </div>
        )}

        {/* Claude-style input bar */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid var(--sep)',
            borderRadius: 'var(--radius-lg)',
            background: '#fff',
            boxShadow: 'var(--shadow-sm)',
            overflow: 'hidden',
          }}
        >
          <textarea
            value={briefText}
            onChange={(e) => setBriefText(e.target.value)}
            placeholder="Write one brief — sent to both models..."
            rows={3}
            style={{
              width: '100%',
              padding: '14px 16px 8px',
              border: 'none',
              outline: 'none',
              fontSize: '14px',
              fontFamily: 'inherit',
              resize: 'none',
              background: 'transparent',
              color: 'var(--label)',
              lineHeight: 1.6,
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleGenerate();
              }
            }}
          />

          {/* Bottom toolbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderTop: '1px solid var(--sep2)',
            }}
          >
            {/* Left tools */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={() => setShowBuilder(!showBuilder)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--sep)',
                  background: showBuilder ? 'var(--surface)' : 'transparent',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 500,
                  fontFamily: 'inherit',
                  color: 'var(--label2)',
                }}
              >
                Brief Builder
              </button>
            </div>

            {/* Right tools */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MicButton
                onTranscript={(text) =>
                  setBriefText((prev) => (prev ? prev + ' ' + text : text))
                }
              />
              <button
                onClick={handleGenerate}
                disabled={loading || !briefText.trim()}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: 'none',
                  background: briefText.trim() && !loading ? '#1E1E2A' : 'var(--surface)',
                  color: briefText.trim() && !loading ? '#fff' : 'var(--label3)',
                  cursor: loading ? 'default' : briefText.trim() ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  flexShrink: 0,
                  transition: 'all .15s',
                }}
                title="Compare (Enter)"
              >
                ↑
              </button>
            </div>
          </div>
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