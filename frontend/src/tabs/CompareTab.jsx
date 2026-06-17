import { useState, useEffect, useRef } from 'react';
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

  // BUG FIX #3: Track whether we are currently streaming so session load
  // doesn't overwrite in-progress content.
  const isStreamingRef = useRef(false);

  useEffect(() => {
    if (activeSessionId) {
      setSessionId(activeSessionId);

      // Don't reload from DB while a stream is in progress
      if (isStreamingRef.current) return;

      // BUG FIX #4: Clear previous variants first so the UI doesn't show
      // stale data from the previous session while the new one loads.
      setVariantA(null);
      setVariantB(null);
      setBriefText('');

      compareService.getSessionVariants(activeSessionId).then((variants) => {
        if (!variants || variants.length === 0) return;

        if (variants.length >= 2) {
          // Backend already sorts: claude=0, sarvam=1, gpt=2, others=3
          // So variants[0] is always left pane, variants[1] is always right pane.
          const left = variants[0];
          const right = variants[1];

          setVariantA(left);
          setVariantB(right);
          // BUG FIX #5: Sync the model pill selectors to what's actually in the DB,
          // so pills always match the content shown.
          setModelA(left.model);
          setModelB(right.model);
        } else if (variants.length === 1) {
          setVariantA(variants[0]);
          setModelA(variants[0].model);
          setVariantB(null);
        }
      }).catch(() => {
        // If session load fails, just show empty state
        setVariantA(null);
        setVariantB(null);
      });
    } else {
      // New chat — clear everything
      setSessionId(null);
      setVariantA(null);
      setVariantB(null);
      setBriefText('');
      setModelA('claude-haiku-4-5');
      setModelB('sarvam-30b');
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
    isStreamingRef.current = true;

    const emptyVariant = (model) => ({
      id: null,
      content: '',
      keywords: [],
      score: 70,
      status: 'pending',
      model,
      format,
      brand_id: brand.id,
      streaming: true,
    });

    setVariantA(emptyVariant(modelA));
    setVariantB(emptyVariant(modelB));

    try {
      await compareService.generateStream(
        {
          brand_id: brand.id,
          format,
          raw_brief: briefText,
          model_a: modelA,
          model_b: modelB,
          session_id: sessionId,
        },
        {
          onSession: (id) => {
            setSessionId(id);
            onSessionCreated(id);
          },
          onToken: (index, text) => {
            if (index === 0) {
              setVariantA((prev) => ({ ...prev, content: (prev?.content || '') + text }));
            } else {
              setVariantB((prev) => ({ ...prev, content: (prev?.content || '') + text }));
            }
          },
          onPaneDone: (data) => {
            if (data.index === 0) {
              setVariantA((prev) => ({
                ...prev,
                id: data.variant_id,
                content: data.content || prev?.content || '',
                keywords: data.keywords || [],
                score: 70,
                status: 'pending',
                model: data.model,
                format: data.format,
                brand_id: data.brand_id,
                session_id: data.session_id,
                streaming: false,
              }));
            } else {
              setVariantB((prev) => ({
                ...prev,
                id: data.variant_id,
                content: data.content || prev?.content || '',
                keywords: data.keywords || [],
                score: 70,
                status: 'pending',
                model: data.model,
                format: data.format,
                brand_id: data.brand_id,
                session_id: data.session_id,
                streaming: false,
              }));
            }
          },
          onDone: () => {
            setLoading(false);
            isStreamingRef.current = false;
            window.dispatchEvent(new CustomEvent('voice-session-created'));
          },
        }
      );
    } catch (err) {
      setError('Comparison failed. Please try again.');
      setLoading(false);
      isStreamingRef.current = false;
    }
  };

  const handleApprove = async (variantId) => {
    await copyService.approve(variantId, brand.id);
    const variants = await compareService.getSessionVariants(sessionId);
    if (variants.length >= 2) {
      setVariantA(variants[0]);
      setVariantB(variants[1]);
      setModelA(variants[0].model);
      setModelB(variants[1].model);
    }
  };

  const handleReject = async (variantId, reason) => {
    await copyService.reject(variantId, brand.id, reason);
    const variants = await compareService.getSessionVariants(sessionId);
    if (variants.length >= 2) {
      setVariantA(variants[0]);
      setVariantB(variants[1]);
      setModelA(variants[0].model);
      setModelB(variants[1].model);
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