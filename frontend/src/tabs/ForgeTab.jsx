import { useState, useEffect, useRef } from 'react';
import { forgeService } from '../services/forgeService';
import FormatChips from '../components/brief/FormatChips';
import AgentSelector from '../components/forge/AgentSelector';
import DebateCard from '../components/forge/DebateCard';
import VariantCard from '../components/variants/VariantCard';

export default function ForgeTab({ brand, activeSessionId, onSessionCreated }) {
  const [format, setFormat] = useState('caption');
  const [input, setInput] = useState('');
  const [brief, setBrief] = useState('');           // the original brief for this debate
  const [generator, setGenerator] = useState('Vikram');
  const [critic, setCritic] = useState('Maya');
  const [debateHistory, setDebateHistory] = useState([]);
  const [finalCopy, setFinalCopy] = useState(null);
  const [keywords, setKeywords] = useState([]);
  const [score, setScore] = useState(0);
  const [isApproved, setIsApproved] = useState(false);
  const [criticApproved, setCriticApproved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState(activeSessionId);
  const [started, setStarted] = useState(false);
  const [showDebate, setShowDebate] = useState(false);
  const [showRefine, setShowRefine] = useState(false);
  const [refineText, setRefineText] = useState('');
  const scrollRef = useRef(null);

  // Auto-scroll to the newest message
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [debateHistory, finalCopy, loading]);

  useEffect(() => {
    if (!activeSessionId) {
      setSessionId(null);
      setDebateHistory([]);
      setFinalCopy(null);
      setKeywords([]);
      setScore(0);
      setIsApproved(false);
      setCriticApproved(false);
      setStarted(false);
      setShowDebate(false);
      setShowRefine(false);
      setRefineText('');
      setBrief('');
      setInput('');
      return;
    }
    // Reopening a forge chat — load its saved result as a card.
    setSessionId(activeSessionId);
    setDebateHistory([]);
    forgeService.getResult(activeSessionId).then((res) => {
      if (res && res.content) {
        setFinalCopy(res.content);
        setKeywords(res.keywords || []);
        setScore(res.score || 0);
        setFormat(res.format || 'caption');
        setIsApproved(res.status === 'approved');
        setBrief(res.brief || '');
        setStarted(true);
        setShowDebate(false);
      }
    }).catch(() => {});
  }, [activeSessionId]);

  // ── First send: start the debate (streaming) ──────────────────────
  const runStart = async (briefText) => {
    setLoading(true);
    setError('');
    setDebateHistory([]);
    setFinalCopy(null);
    setKeywords([]);
    setScore(0);
    setIsApproved(false);
    setCriticApproved(false);
    setStarted(true);
    setShowDebate(true);   // show live while debating
    setBrief(briefText);

    try {
      await forgeService.startStream(
        { brand_id: brand.id, brief: briefText, generator, critic, format },
        {
          onSession: (sid) => { setSessionId(sid); onSessionCreated(sid); },
          onDebateMessage: (msg) =>
            setDebateHistory((prev) => [...prev, { agent: msg.agent, content: msg.content }]),
          onFinal: (data) => {
            setFinalCopy(data.content);
            setKeywords(data.keywords || []);
            setScore(data.score || 0);
            setCriticApproved(data.is_approved);
          },
          onError: (detail) => setError(detail || 'Forge debate failed.'),
        }
      );
    } catch (err) {
      console.error('[forge] start stream did not resolve cleanly:', err);
      setError(err.message || 'Forge debate failed. Make sure Ollama is running locally with mistral and gemma models.');
    } finally {
      setLoading(false);
      setShowDebate(false);   // wrap up — collapse the debate
      window.dispatchEvent(new CustomEvent('voice-session-created'));
    }
  };

  // ── Follow-up round: Agree (no direction) or custom direction ─────
  const runTurn = async (direction) => {
    setLoading(true);
    setError('');
    setShowDebate(true);   // show live while debating
    // Show the user's direction as a message in the thread
    if (direction) {
      setDebateHistory((prev) => [...prev, { agent: 'You', content: direction }]);
    }

    try {
      await forgeService.turnStream(
        { brand_id: brand.id, session_id: sessionId, brief, generator, critic, direction: direction || null },
        {
          onDebateMessage: (msg) =>
            setDebateHistory((prev) => [...prev, { agent: msg.agent, content: msg.content }]),
          onFinal: (data) => {
            setFinalCopy(data.content);
            setKeywords(data.keywords || []);
            setScore(data.score || 0);
            setCriticApproved(data.is_approved);
          },
          onError: (detail) => setError(detail || 'Forge turn failed.'),
        }
      );
    } catch (err) {
      setError(err.message || 'Forge turn failed.');
    } finally {
      setLoading(false);
      setShowDebate(false);   // wrap up — collapse the debate
    }
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      await forgeService.approve(sessionId, brand.id);
      setIsApproved(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Approval failed.');
    } finally {
      setLoading(false);
    }
  };

  // ── Bottom bar submit — branches on whether a debate exists ───────
  const handleSend = () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    if (!started || !finalCopy) {
      runStart(text);
    } else {
      runTurn(text);     // typed text = custom direction for another round
    }
  };

  const placeholder = !started || !finalCopy
    ? 'Write your brief for the debate...'
    : 'Tell the agents what to change... (or press Agree)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ── Conversation area ── */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <div style={{ maxWidth: '900px', width: '100%', margin: '0 auto' }}>
          {!started && (
            <div style={{ textAlign: 'center', color: 'var(--label3)', marginTop: '40px', fontSize: '13px' }}>
              Pick a generator and critic, write a brief below, and start the debate.
              <br />
              Uses free local models (Mistral + Gemma) — zero API cost.
            </div>
          )}

          {/* Original brief shown as a user message (like single/compare) */}
          {started && brief && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
              <div style={{
                maxWidth: '70%', background: 'var(--surface2)', color: 'var(--label2)',
                padding: '10px 14px', borderRadius: 'var(--radius-lg)', fontSize: '14px', lineHeight: 1.5,
              }}>
                {brief}
              </div>
            </div>
          )}

          {/* ── Agent debate — collapsible dropdown, between brief and response ── */}
          {debateHistory.length > 0 && (
            <div style={{
              border: '1px solid var(--sep)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '12px',
              overflow: 'hidden',
              background: 'var(--surface)',
            }}>
              {/* Header row — click to expand/collapse */}
              <button
                onClick={() => setShowDebate((v) => !v)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 12px', border: 'none', background: 'transparent',
                  color: 'var(--label2)', fontSize: '13px', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                }}
              >
                <span style={{
                  fontSize: '10px', color: 'var(--label3)',
                  transform: (showDebate || loading) ? 'rotate(90deg)' : 'none',
                  transition: 'transform 0.15s',
                }}>▸</span>
                Agent debate
                {loading && (
                  <span style={{ marginLeft: '6px', animation: 'pulse 1s ease-in-out infinite', color: 'var(--label3)', fontWeight: 400 }}>●</span>
                )}
              </button>

              {/* Body — the debate messages, nested inside the panel */}
              {(showDebate || loading) && (
                <div style={{
                  borderTop: '1px solid var(--sep)',
                  padding: '12px',
                  display: 'flex', flexDirection: 'column', gap: '10px',
                  maxHeight: '420px', overflowY: 'auto',
                  background: '#fff',
                }}>
                  {debateHistory.map((msg, i) => (
                    msg.agent === 'You' ? (
                      <div key={i} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{
                          maxWidth: '70%', background: 'var(--surface2)', color: 'var(--label2)',
                          padding: '8px 12px', borderRadius: 'var(--radius-md)', fontSize: '13px', lineHeight: 1.5,
                        }}>
                          {msg.content}
                        </div>
                      </div>
                    ) : (
                      <DebateCard key={i} message={msg} />
                    )
                  ))}
                  {loading && (
                    <div style={{ fontSize: '12px', color: 'var(--label3)', padding: '2px' }}>
                      <span style={{ animation: 'pulse 1s ease-in-out infinite' }}>thinking…</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Final copy as a VariantCard — same border as single/compare */}
          {finalCopy && (
            <VariantCard
              variant={{ model: 'forge', content: finalCopy, keywords, score, format, streaming: false }}
            />
          )}

          {/* Return / Refine / Approve actions on the current result */}
          {finalCopy && !isApproved && !loading && (
            <div style={{ marginTop: '10px' }}>
              {showRefine ? (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    value={refineText}
                    onChange={(e) => setRefineText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const t = refineText.trim();
                        if (t) { setShowRefine(false); setRefineText(''); runTurn(t); }
                      }
                    }}
                    placeholder="What should change? e.g. fewer emojis, punchier hook…"
                    autoFocus
                    style={{
                      flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--sep)', fontSize: '13px', fontFamily: 'inherit', outline: 'none',
                    }}
                  />
                  <button
                    onClick={() => {
                      const t = refineText.trim();
                      if (t) { setShowRefine(false); setRefineText(''); runTurn(t); }
                    }}
                    style={{ ...pillBtn, background: '#1E1E2A', color: '#fff', border: 'none' }}
                  >
                    Send
                  </button>
                  <button onClick={() => { setShowRefine(false); setRefineText(''); }} style={pillBtn}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                  {criticApproved && (
                    <span style={{ marginRight: 'auto', fontSize: '11px', color: 'var(--green)', fontWeight: 600 }}>
                      ✓ Critic approved — review and approve to save
                    </span>
                  )}
                  <button onClick={() => runTurn(null)} disabled={loading} style={pillBtn} title="Send back to the agents for another round">
                    Return
                  </button>
                  <button onClick={() => setShowRefine(true)} disabled={loading} style={pillBtn} title="Type how you want it tuned">
                    Refine
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={loading}
                    style={{ ...pillBtn, borderColor: 'rgba(34,197,94,.35)', color: 'var(--green)', background: 'var(--green-bg)' }}
                  >
                    Approve
                  </button>
                </div>
              )}
            </div>
          )}

          {isApproved && (
            <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--green-bg)', color: 'var(--green)', fontSize: '12px', fontWeight: 600, marginTop: '8px' }}>
              Copy approved and saved to Knowledge Base
            </div>
          )}

          {error && (
            <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--red-bg)', color: 'var(--red)', fontSize: '12px' }}>
              {error}
            </div>
          )}
        </div>
      </div>

      {/* ── Persistent bottom bar (always visible, like single/compare) ── */}
      <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '900px', width: '100%', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <FormatChips value={format} onChange={setFormat} />
          <AgentSelector generator={generator} critic={critic} onGeneratorChange={setGenerator} onCriticChange={setCritic} />
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder={placeholder}
            rows={2}
            disabled={loading}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--sep)', fontSize: '14px', fontFamily: 'inherit',
              resize: 'none', outline: 'none', background: '#fff',
            }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            style={{
              padding: '10px 18px', borderRadius: 'var(--radius-md)', border: 'none',
              background: '#1E1E2A', color: '#fff', fontSize: '13px', fontWeight: 600,
              cursor: loading ? 'default' : 'pointer',
              opacity: loading || !input.trim() ? 0.5 : 1, fontFamily: 'inherit',
            }}
          >
            {!started || !finalCopy ? 'Start' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

const pillBtn = {
  padding: '7px 14px',
  borderRadius: 'var(--radius-xl)',
  border: '1px solid var(--sep)',
  background: 'transparent',
  color: 'var(--label2)',
  fontSize: '12px',
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
};