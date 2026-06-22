import { useState, useEffect, useRef } from 'react';
import { useBrandStore } from '../store/brandStore';
import { copyService, newTurnId } from '../services/copyService';
import { compareService } from '../services/compareService';
import BriefBuilder from '../components/brief/BriefBuilder';
import FormatChips from '../components/brief/FormatChips';
import ModelSelector from '../components/compare/ModelSelector';
import MicButton from '../components/common/MicButton';
import ImageAttachButton from '../components/common/ImageAttachButton';
import ChatTurn from '../components/chat/ChatTurn';

export default function ChatTab({ brand, activeSessionId, onSessionCreated, mode = 'single' }) {
  const kb = useBrandStore((state) => state.kb);

  const [turns, setTurns] = useState([]);
  const [sessionId, setSessionId] = useState(activeSessionId);
  const [briefText, setBriefText] = useState('');
  const [format, setFormat] = useState('caption');
  const [showBuilder, setShowBuilder] = useState(false);

  const [model, setModel] = useState('claude-haiku-4-5');
  const [modelA, setModelA] = useState('claude-haiku-4-5');
  const [modelB, setModelB] = useState('sarvam-30b');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Image attachment — imageUrl is the Supabase URL, imagePreview is the local blob
  const [imageUrl, setImageUrl] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  // Refine — when set, the next send rewrites this variant with the same model
  const [refineTarget, setRefineTarget] = useState(null);
  const [visionReading, setVisionReading] = useState(false);

  const isStreamingRef = useRef(false);
  const scrollRef = useRef(null);
  const shouldAutoScroll = useRef(true);

  // ── Load the chat thread when the session changes ─────────────────
  useEffect(() => {
    if (activeSessionId) {
      setSessionId(activeSessionId);

      // Don't clobber an in-progress stream
      if (isStreamingRef.current) return;

      setTurns([]);
      setBriefText('');
      setImageUrl(null);
      setImagePreview(null);
      setRefineTarget(null);
      setVisionReading(false);

      copyService.getThread(activeSessionId).then((data) => {
        setTurns(data?.turns || []);
        shouldAutoScroll.current = true;
      }).catch(() => {
        setTurns([]);
      });
    } else {
      // New chat
      setSessionId(null);
      setTurns([]);
      setBriefText('');
      setImageUrl(null);
      setImagePreview(null);
      setRefineTarget(null);
    }
  }, [activeSessionId]);

  // ── Auto-scroll to bottom unless the user scrolled up ─────────────
  useEffect(() => {
    if (shouldAutoScroll.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    shouldAutoScroll.current = nearBottom;
  };

  // ── Update one variant inside one turn (by turn_id + index) ───────
  const updateTurnVariant = (turnId, index, updater) => {
    setTurns((prev) =>
      prev.map((t) => {
        if (t.turn_id !== turnId) return t;
        const variants = [...t.variants];
        variants[index] = updater(variants[index] || {});
        return { ...t, variants };
      })
    );
  };

  const handleRefine = (variant) => {
    setRefineTarget(variant);
  };

  const cancelRefine = () => setRefineTarget(null);

  const handleImageUploaded = (url, preview) => {
    setImageUrl(url);
    setImagePreview(preview);
  };

  const handleRemoveImage = () => {
    setImageUrl(null);
    setImagePreview(null);
  };

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

  // ── Send a message (a new turn) ───────────────────────────────────
  const handleSend = async () => {
    if (!briefText.trim() || loading) return;

    const brief = briefText.trim();
    const turnId = newTurnId();
    const refining = refineTarget; // capture before clearing

    setLoading(true);
    setError('');
    isStreamingRef.current = true;
    setBriefText('');
    setImageUrl(null);
    setImagePreview(null);
    setRefineTarget(null);
    shouldAutoScroll.current = true;

    const emptyVariant = (m) => ({
      id: null,
      content: '',
      keywords: [],
      score: 0,
      status: 'pending',
      model: m,
      format,
      brand_id: brand.id,
      streaming: true,
    });

    // ── Refine path — rewrite the chosen response with the same model ──
    if (refining) {
      const refineModel = refining.model;
      const refineFormat = refining.format || format;
      const newTurn = {
        turn_id: turnId,
        turn_type: 'single',
        brief,
        created_at: new Date().toISOString(),
        variants: [{ ...emptyVariant(refineModel), format: refineFormat }],
      };
      setTurns((prev) => [...prev, newTurn]);

      try {
        await copyService.generateStream(
          {
            brand_id: brand.id,
            format: refineFormat,
            model: refineModel,
            raw_brief: brief,
            refine_from: refining.content,
            session_id: sessionId,
            turn_id: turnId,
          },
          {
            onSession: (id) => {
              setSessionId(id);
              onSessionCreated(id);
            },
            onTitle: () => {
              window.dispatchEvent(new CustomEvent('voice-session-created'));
            },
            onToken: (index, text) =>
              updateTurnVariant(turnId, index, (v) => ({
                ...v,
                content: (v.content || '') + text,
              })),
            onVisionReading: () => setVisionReading(true),
            onVisionDone: () => setVisionReading(false),
            onVisionReading: () => setVisionReading(true),
            onVisionDone: () => setVisionReading(false),
                        onScoreUpdate: (data) =>
              updateTurnVariant(turnId, data.index, (v) => ({
                ...v,
                score: data.score,
              })),
            onVariantDone: (data) =>
              updateTurnVariant(turnId, data.index, (v) => ({
                ...v,
                id: data.variant_id,
                content: data.content || v.content || '',
                keywords: data.keywords || [],
                score: data.score,
                model: data.model,
                format: data.format,
                brand_id: data.brand_id,
                session_id: data.session_id,
                turn_id: data.turn_id,
                turn_type: 'single',
                streaming: false,
              })),
            onDone: () => {
              setLoading(false);
              isStreamingRef.current = false;
              setVisionReading(false);
              window.dispatchEvent(new CustomEvent('voice-session-created'));
            },
          }
        );
      } catch {
        setError('Refine failed. Please try again.');
        setLoading(false);
        isStreamingRef.current = false;
      }
      return;
    }

    if (mode === 'single') {
      // Optimistic single turn — 3 empty cards
      const newTurn = {
        turn_id: turnId,
        turn_type: 'single',
        brief,
        created_at: new Date().toISOString(),
        image_url: imageUrl,
        image_preview: imagePreview,
        variants: [emptyVariant(model)],
      };
      setTurns((prev) => [...prev, newTurn]);

      try {
        await copyService.generateStream(
          {
            brand_id: brand.id,
            format,
            model,
            raw_brief: brief,
            session_id: sessionId,
            turn_id: turnId,
            image_url: imageUrl || undefined,
          },
          {
            onSession: (id) => {
              setSessionId(id);
              onSessionCreated(id);
            },
            onTitle: () => {
              // Refresh the sidebar so the auto-generated title shows immediately
              window.dispatchEvent(new CustomEvent('voice-session-created'));
            },
            onToken: (index, text) =>
              updateTurnVariant(turnId, index, (v) => ({
                ...v,
                content: (v.content || '') + text,
              })),
            onVariantDone: (data) =>
              updateTurnVariant(turnId, data.index, (v) => ({
                ...v,
                id: data.variant_id,
                content: data.content || v.content || '',
                keywords: data.keywords || [],
                score: data.score,
                model: data.model,
                format: data.format,
                brand_id: data.brand_id,
                session_id: data.session_id,
                turn_id: data.turn_id,
                turn_type: 'single',
                streaming: false,
              })),
            onDone: () => {
              setLoading(false);
              isStreamingRef.current = false;
              window.dispatchEvent(new CustomEvent('voice-session-created'));
            },
          }
        );
      } catch {
        setError('Generation failed. Please try again.');
        setLoading(false);
        isStreamingRef.current = false;
      }
    } else {
      // Optimistic compare turn — 2 empty panes (A = left, B = right)
      const newTurn = {
        turn_id: turnId,
        turn_type: 'compare',
        brief,
        created_at: new Date().toISOString(),
        image_url: imageUrl,
        image_preview: imagePreview,
        variants: [emptyVariant(modelA), emptyVariant(modelB)],
      };
      setTurns((prev) => [...prev, newTurn]);

      try {
        await compareService.generateStream(
          {
            brand_id: brand.id,
            format,
            raw_brief: brief,
            model_a: modelA,
            model_b: modelB,
            session_id: sessionId,
            turn_id: turnId,
            image_url: imageUrl || undefined,
          },
          {
            onSession: (id) => {
              setSessionId(id);
              onSessionCreated(id);
            },
            onTitle: () => {
              // Refresh the sidebar so the auto-generated title shows immediately
              window.dispatchEvent(new CustomEvent('voice-session-created'));
            },
            onToken: (index, text) =>
              updateTurnVariant(turnId, index, (v) => ({
                ...v,
                content: (v.content || '') + text,
              })),
            onVisionReading: () => setVisionReading(true),
            onVisionDone: () => setVisionReading(false),
                        onScoreUpdate: (data) =>
              updateTurnVariant(turnId, data.index, (v) => ({
                ...v,
                score: data.score,
              })),
            onPaneDone: (data) =>
              updateTurnVariant(turnId, data.index, (v) => ({
                ...v,
                id: data.variant_id,
                content: data.content || v.content || '',
                keywords: data.keywords || [],
                score: data.score,
                model: data.model,
                format: data.format,
                brand_id: data.brand_id,
                session_id: data.session_id,
                turn_id: data.turn_id,
                turn_type: 'compare',
                streaming: false,
              })),
            onDone: () => {
              setLoading(false);
              isStreamingRef.current = false;
              window.dispatchEvent(new CustomEvent('voice-session-created'));
            },
          }
        );
      } catch {
        setError('Comparison failed. Please try again.');
        setLoading(false);
        isStreamingRef.current = false;
      }
    }
  };

  const handleApprove = async (variantId) => {
    await copyService.approve(variantId, brand.id);
    if (sessionId) {
      const data = await copyService.getThread(sessionId);
      setTurns(data?.turns || []);
    }
  };

  const handleReject = async (variantId, reason) => {
    setLoading(true);
    try {
      await copyService.reject(variantId, brand.id, reason);
      if (sessionId) {
        const data = await copyService.getThread(sessionId);
        setTurns(data?.turns || []);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Revision failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Conversation thread */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: 'auto', padding: '20px', maxWidth: '900px', width: '100%', margin: '0 auto' }}
      >
        {turns.length === 0 && !loading && (
          <div style={{ textAlign: 'center', color: 'var(--label3)', marginTop: '60px', fontSize: '13px' }}>
            Start a new chat for {brand.name}. Pick Single or Compare below, write a brief, and press send.
          </div>
        )}

        {turns.map((turn) => (
          <ChatTurn
            key={turn.turn_id}
            turn={turn}
            onApprove={handleApprove}
            onReject={handleReject}
            onRefine={handleRefine}
          />
        ))}
      </div>

      {/* Input zone */}
      <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '900px', width: '100%', margin: '0 auto' }}>

        {/* Mode toggle + format + model selectors */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FormatChips value={format} onChange={setFormat} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {mode === 'single' ? (
              <ModelSelector value={model} onChange={setModel} openUp={true} />
            ) : (
              <>
                <ModelSelector value={modelA} onChange={setModelA} openUp={true} />
                <span style={{ color: 'var(--label3)', fontSize: '12px' }}>vs</span>
                <ModelSelector value={modelB} onChange={setModelB} openUp={true} />
              </>
            )}
          </div>
        </div>

        {showBuilder && <BriefBuilder onBuild={handleBuildBrief} kb={kb} />}

        {error && (
          <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--red-bg)', color: 'var(--red)', fontSize: '12px' }}>
            {error}
          </div>
        )}

        {/* Input bar */}
        {/* Vision reading indicator */}
        {visionReading && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '7px 12px', borderRadius: 'var(--radius-md)',
            background: 'var(--surface)', border: '1px solid var(--sep)',
            fontSize: '12px', color: 'var(--label3)',
          }}>
            <span style={{ animation: 'pulse 1s ease-in-out infinite' }}>👁</span>
            Reading image...
          </div>
        )}

        {/* Refine banner */}
        {refineTarget && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface)',
              border: '1px solid var(--sep)',
              fontSize: '12px',
              color: 'var(--label2)',
            }}
          >
            <span style={{ flexShrink: 0, fontWeight: 600 }}>Refining</span>
            <span
              style={{
                flex: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                color: 'var(--label3)',
              }}
            >
              "{(refineTarget.content || '').slice(0, 60)}{(refineTarget.content || '').length > 60 ? '\u2026' : ''}"
            </span>
            <button
              onClick={cancelRefine}
              title="Cancel refine"
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--label3)',
                fontSize: '16px',
                lineHeight: 1,
                padding: '0 2px',
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* Image preview above input bar */}
        {imagePreview && (
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: '6px' }}>
            <img
              src={imagePreview}
              alt="Attached"
              style={{
                height: '72px',
                width: 'auto',
                borderRadius: '8px',
                border: '1px solid var(--sep)',
                objectFit: 'cover',
              }}
            />
            <button
              onClick={handleRemoveImage}
              style={{
                position: 'absolute',
                top: '-6px',
                right: '-6px',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                border: 'none',
                background: '#1E1E2A',
                color: '#fff',
                fontSize: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        )}

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
            placeholder={
              refineTarget
                ? 'Describe the change (e.g. make it funnier, shorter, more Tenglish)'
                : mode === 'single'
                ? 'Describe your brief... (Single → 1 response)'
                : 'Write one brief — sent to both models (Compare)...'
            }
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
                handleSend();
              }
            }}
          />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderTop: '1px solid var(--sep2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ImageAttachButton
                onUploaded={handleImageUploaded}
                disabled={loading}
              />
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MicButton
                onTranscript={(text) =>
                  setBriefText((prev) => (prev ? prev + ' ' + text : text))
                }
              />
              <button
                onClick={handleSend}
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
                title="Send (Enter)"
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