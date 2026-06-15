import { useState, useEffect } from 'react';
import { useBrandStore } from '../store/brandStore';
import { copyService } from '../services/copyService';
import BriefBuilder from '../components/brief/BriefBuilder';
import FormatChips from '../components/brief/FormatChips';
import VariantCard from '../components/variants/VariantCard';
import ModelSelector from '../components/compare/ModelSelector';
import MicButton from '../components/common/MicButton';

export default function SingleTab({ brand, activeSessionId, onSessionCreated }) {
  const kb = useBrandStore((state) => state.kb);

  const [format, setFormat] = useState('caption');
  const [model, setModel] = useState('claude-haiku-4-5');
  const [briefText, setBriefText] = useState('');
  const [showBuilder, setShowBuilder] = useState(false);
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState(activeSessionId);

  // Load variants when switching to an existing session
  useEffect(() => {
    if (activeSessionId) {
      setSessionId(activeSessionId);
      copyService.getSessionVariants(activeSessionId).then(setVariants);
    } else {
      setSessionId(null);
      setVariants([]);
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
      const newVariants = await copyService.generate({
        brand_id: brand.id,
        format,
        model,
        raw_brief: briefText,
        session_id: sessionId,
      });

      setVariants(newVariants);

      if (!sessionId && newVariants.length > 0) {
        const newSessionId = newVariants[0].session_id;
        setSessionId(newSessionId);
        onSessionCreated(newSessionId);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Generation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (variantId) => {
    await copyService.approve(variantId, brand.id);
    // Refresh variants to reflect new status
    if (sessionId) {
      const updated = await copyService.getSessionVariants(sessionId);
      setVariants(updated);
    }
  };

  const handleReject = async (variantId, reason) => {
    setLoading(true);
    try {
      const revised = await copyService.reject(variantId, brand.id, reason);
      // Refresh to show rejected card + new revised variants
      const updated = await copyService.getSessionVariants(sessionId);
      setVariants(updated);
    } catch (err) {
      setError(err.response?.data?.detail || 'Revision failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {variants.length === 0 && !loading && (
          <div style={{ textAlign: 'center', color: 'var(--label3)', marginTop: '60px', fontSize: '13px' }}>
            Write a brief below and press Generate to get 3 copy variants for {brand.name}
          </div>
        )}

        {variants.map((variant) => (
          <VariantCard
            key={variant.id}
            variant={variant}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: '4px', padding: '12px 0', alignItems: 'center' }}>
            <Dot delay={0} />
            <Dot delay={0.18} />
            <Dot delay={0.36} />
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: '12px',
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--red-bg)',
              color: 'var(--red)',
              fontSize: '12px',
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Input zone */}
      <div style={{ borderTop: '1px solid var(--sep)', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <FormatChips value={format} onChange={setFormat} />
            <ModelSelector value={model} onChange={setModel} openUp={true} />
        </div>

        {showBuilder && <BriefBuilder onBuild={handleBuildBrief} kb={kb} />}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowBuilder(!showBuilder)}
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--sep)',
              background: showBuilder ? 'var(--surface)' : 'transparent',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            Brief Builder
          </button>

          <textarea
            value={briefText}
            onChange={(e) => setBriefText(e.target.value)}
            placeholder="Type your brief, or use the Brief Builder..."
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
          <MicButton onTranscript={(text) => setBriefText((prev) => prev ? prev + ' ' + text : text)} />
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
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}

function Dot({ delay }) {
  return (
    <div
      style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: 'var(--label3)',
        animation: `td 0.9s ease-in-out infinite`,
        animationDelay: `${delay}s`,
      }}
    />
  );
}