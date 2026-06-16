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
  const [briefText, setBriefText] = useState('');
  const [showBuilder, setShowBuilder] = useState(false);
  const [model, setModel] = useState('claude-haiku-4-5');
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState(activeSessionId);

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

  // Initialize 3 empty streaming variants
  const streamingVariants = [
    { id: null, content: '', keywords: [], score: 70, status: 'pending', model: model, format, brand_id: brand.id, session_id: null, streaming: true },
    { id: null, content: '', keywords: [], score: 70, status: 'pending', model: model, format, brand_id: brand.id, session_id: null, streaming: true },
    { id: null, content: '', keywords: [], score: 70, status: 'pending', model: model, format, brand_id: brand.id, session_id: null, streaming: true },
  ];
  setVariants([...streamingVariants]);

  try {
    await copyService.generateStream(
      {
        brand_id: brand.id,
        format,
        model,
        raw_brief: briefText,
        session_id: sessionId,
      },
      {
        onSession: (id) => {
          setSessionId(id);
          onSessionCreated(id);
        },
        onVariantStart: (index) => {
          // variant card already shown as empty
        },
        onToken: (index, text) => {
          setVariants((prev) => {
            const updated = [...prev];
            updated[index] = {
              ...updated[index],
              content: updated[index].content + text,
            };
            return updated;
          });
        },
        onVariantDone: (data) => {
          setVariants((prev) => {
            const updated = [...prev];
            updated[data.index] = {
              ...updated[data.index],
              id: data.variant_id,
              content: data.content || updated[data.index].content,
              keywords: data.keywords || [],
              score: 70,
              status: 'pending',
              model: data.model,
              format: data.format,
              brand_id: data.brand_id,
              session_id: data.session_id,
              streaming: false,
            };
            return updated;
          });
        },
        onDone: () => {
          setLoading(false);
        },
      }
    );
  } catch (err) {
    setError('Generation failed. Please try again.');
    setLoading(false);
  }
};

  const handleApprove = async (variantId) => {
    await copyService.approve(variantId, brand.id);
    if (sessionId) {
      const updated = await copyService.getSessionVariants(sessionId);
      setVariants(updated);
    }
  };

  const handleReject = async (variantId, reason) => {
    setLoading(true);
    try {
      await copyService.reject(variantId, brand.id, reason);
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

        {variants.map((variant, index) => (
          <VariantCard
            key={variant.id || `streaming-${index}`}
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
          <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--red-bg)', color: 'var(--red)', fontSize: '12px' }}>
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
          {/* Text area */}
          <textarea
            value={briefText}
            onChange={(e) => setBriefText(e.target.value)}
            placeholder="Describe your brief... (e.g. Caption for Alphonso mango launch on Instagram, Hinglish, urgent tone)"
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

          {/* Bottom toolbar inside bar */}
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
              <ToolBtn
                title="Brief Builder"
                onClick={() => setShowBuilder(!showBuilder)}
                active={showBuilder}
              >
                Brief Builder
              </ToolBtn>
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
                title="Generate (Enter)"
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

function ToolBtn({ children, onClick, active, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: '5px 10px',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--sep)',
        background: active ? 'var(--surface)' : 'transparent',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: 500,
        fontFamily: 'inherit',
        color: 'var(--label2)',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {children}
    </button>
  );
}