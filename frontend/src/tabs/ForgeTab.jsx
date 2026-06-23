import { useState, useEffect, useRef } from 'react';
import { forgeService } from '../services/forgeService';
import FormatChips from '../components/brief/FormatChips';
import AgentSelector from '../components/forge/AgentSelector';
import DebateCard from '../components/forge/DebateCard';
import VariantCard from '../components/variants/VariantCard';

const newId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

const blankTurn = (userText) => ({
  id: newId(),
  userText: userText ?? null,   // shown as the user's message bubble (null = no bubble, e.g. Return)
  debate: [],
  finalCopy: null,
  keywords: [],
  score: 0,
  criticApproved: false,
  isApproved: false,
  showDebate: true,             // expanded while streaming
  loading: true,
});

export default function ForgeTab({ brand, activeSessionId, onSessionCreated }) {
  const [format, setFormat] = useState('caption');
  const [generator, setGenerator] = useState('Vikram');
  const [critic, setCritic] = useState('Maya');
  const [input, setInput] = useState('');
  const [brief, setBrief] = useState('');          // original brief for the session
  const [turns, setTurns] = useState([]);          // conversation thread
  const [sessionId, setSessionId] = useState(activeSessionId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [refineFor, setRefineFor] = useState(null); // turn id whose refine input is open
  const [refineText, setRefineText] = useState('');
  const scrollRef = useRef(null);

  // Auto-scroll to newest
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, busy]);

  // Session switch — reset, then load the saved result as a single turn
  useEffect(() => {
    setSessionId(activeSessionId);
    setTurns([]);
    setBrief('');
    setInput('');
    setError('');
    setRefineFor(null);
    setRefineText('');
    if (!activeSessionId) return;
    forgeService.getResult(activeSessionId).then((res) => {
      if (res && res.content) {
        setBrief(res.brief || '');
        setFormat(res.format || 'caption');
        setTurns([{
          id: newId(),
          userText: res.brief || null,
          debate: [],
          finalCopy: res.content,
          keywords: res.keywords || [],
          score: res.score || 0,
          criticApproved: false,
          isApproved: res.status === 'approved',
          showDebate: false,
          loading: false,
        }]);
      }
    }).catch(() => {});
  }, [activeSessionId]);

  const patchTurn = (id, patch) =>
    setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  // Stream a turn — start (first) or turn (follow-up with direction)
  const runStream = async (turnId, isFirst, briefOrDirection) => {
    const callbacks = {
      onSession: (sid) => { setSessionId(sid); onSessionCreated(sid); },
      onDebateMessage: (msg) =>
        setTurns((prev) => prev.map((t) =>
          t.id === turnId ? { ...t, debate: [...t.debate, { agent: msg.agent, content: msg.content }] } : t
        )),
      onFinal: (data) =>
        patchTurn(turnId, {
          finalCopy: data.content,
          keywords: data.keywords || [],
          score: data.score || 0,
          criticApproved: data.is_approved,
        }),
      onError: (detail) => setError(detail || 'Forge failed.'),
    };

    try {
      if (isFirst) {
        await forgeService.startStream(
          { brand_id: brand.id, brief: briefOrDirection, generator, critic, format },
          callbacks
        );
      } else {
        await forgeService.turnStream(
          { brand_id: brand.id, session_id: sessionId, brief, generator, critic, direction: briefOrDirection },
          callbacks
        );
      }
    } catch (err) {
      console.error('[forge] stream error:', err);
      setError(err.message || 'Forge failed. Make sure Ollama is running locally with mistral and gemma models.');
    } finally {
      patchTurn(turnId, { loading: false, showDebate: false });
      setBusy(false);
      window.dispatchEvent(new CustomEvent('voice-session-created'));
    }
  };

  // Bottom bar send — first brief or a follow-up brief/direction
  const handleSend = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setError('');
    setBusy(true);
    const isFirst = !sessionId;
    if (isFirst) setBrief(text);
    const turn = blankTurn(text);
    setTurns((prev) => [...prev, turn]);
    runStream(turn.id, isFirst, text);
  };

  // Return — send back to the agents for another round (no user message)
  const handleReturn = () => {
    if (busy) return;
    setError('');
    setBusy(true);
    const turn = blankTurn(null);
    setTurns((prev) => [...prev, turn]);
    runStream(turn.id, false, null);
  };

  // Refine — user typed how to tune it
  const submitRefine = () => {
    const text = refineText.trim();
    if (!text || busy) return;
    setRefineFor(null);
    setRefineText('');
    setError('');
    setBusy(true);
    const turn = blankTurn(text);
    setTurns((prev) => [...prev, turn]);
    runStream(turn.id, false, text);
  };

  const handleApprove = async (turnId) => {
    setBusy(true);
    try {
      await forgeService.approve(sessionId, brand.id);
      patchTurn(turnId, { isApproved: true });
    } catch (err) {
      setError(err.response?.data?.detail || 'Approval failed.');
    } finally {
      setBusy(false);
    }
  };

  const started = turns.length > 0;
  const placeholder = !started
    ? 'Write your brief for the debate...'
    : 'Send a new brief or direction...';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ── Conversation thread ── */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <div style={{ maxWidth: '900px', width: '100%', margin: '0 auto' }}>
          {!started && (
            <div style={{ textAlign: 'center', color: 'var(--label3)', marginTop: '40px', fontSize: '13px' }}>
              Pick a generator and critic, write a brief below, and start the debate.
              <br />
              Uses free local models (Mistral + Gemma) — zero API cost.
            </div>
          )}

          {turns.map((turn, idx) => {
            const isLast = idx === turns.length - 1;
            return (
              <div key={turn.id} style={{ marginBottom: '8px' }}>
                {/* User message bubble */}
                {turn.userText && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
                    <div style={{
                      maxWidth: '70%', background: 'var(--surface2)', color: 'var(--label2)',
                      padding: '10px 14px', borderRadius: 'var(--radius-lg)', fontSize: '14px', lineHeight: 1.5,
                    }}>
                      {turn.userText}
                    </div>
                  </div>
                )}

                {/* Agent debate — collapsible dropdown for this turn */}
                {turn.debate.length > 0 && (
                  <div style={{
                    border: '1px solid var(--sep)', borderRadius: 'var(--radius-md)',
                    marginBottom: '12px', overflow: 'hidden', background: 'var(--surface)',
                  }}>
                    <button
                      onClick={() => patchTurn(turn.id, { showDebate: !turn.showDebate })}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '10px 12px', border: 'none', background: 'transparent',
                        color: 'var(--label2)', fontSize: '13px', fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                      }}
                    >
                      <span style={{
                        fontSize: '10px', color: 'var(--label3)',
                        transform: (turn.showDebate || turn.loading) ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.15s',
                      }}>▸</span>
                      Agent debate
                      {turn.loading && (
                        <span style={{ marginLeft: '6px', animation: 'pulse 1s ease-in-out infinite', color: 'var(--label3)', fontWeight: 400 }}>●</span>
                      )}
                    </button>
                    {(turn.showDebate || turn.loading) && (
                      <div style={{
                        borderTop: '1px solid var(--sep)', padding: '12px',
                        display: 'flex', flexDirection: 'column', gap: '10px',
                        maxHeight: '420px', overflowY: 'auto', background: '#fff',
                      }}>
                        {turn.debate.map((msg, i) => (
                          msg.agent === 'You' ? null : <DebateCard key={i} message={msg} />
                        ))}
                        {turn.loading && (
                          <div style={{ fontSize: '12px', color: 'var(--label3)', padding: '2px' }}>
                            <span style={{ animation: 'pulse 1s ease-in-out infinite' }}>thinking…</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Result card */}
                {turn.finalCopy && (
                  <VariantCard
                    variant={{ model: 'forge', content: turn.finalCopy, keywords: turn.keywords, score: turn.score, format, streaming: false }}
                  />
                )}

                {/* Actions — only on the latest turn */}
                {isLast && turn.finalCopy && !turn.isApproved && !turn.loading && (
                  <div style={{ marginTop: '10px' }}>
                    {refineFor === turn.id ? (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          value={refineText}
                          onChange={(e) => setRefineText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') submitRefine(); }}
                          placeholder="What should change? e.g. fewer emojis, punchier hook…"
                          autoFocus
                          style={{
                            flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--sep)', fontSize: '13px', fontFamily: 'inherit', outline: 'none',
                          }}
                        />
                        <button onClick={submitRefine} style={{ ...pillBtn, background: '#1E1E2A', color: '#fff', border: 'none' }}>Send</button>
                        <button onClick={() => { setRefineFor(null); setRefineText(''); }} style={pillBtn}>Cancel</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {turn.criticApproved && (
                          <span style={{ marginRight: 'auto', fontSize: '11px', color: 'var(--green)', fontWeight: 600 }}>
                            ✓ Critic approved — review and approve to save
                          </span>
                        )}
                        <button onClick={handleReturn} disabled={busy} style={pillBtn} title="Send back to the agents for another round">Return</button>
                        <button onClick={() => { setRefineFor(turn.id); setRefineText(''); }} disabled={busy} style={pillBtn} title="Type how you want it tuned">Refine</button>
                        <button
                          onClick={() => handleApprove(turn.id)}
                          disabled={busy}
                          style={{ ...pillBtn, borderColor: 'rgba(34,197,94,.35)', color: 'var(--green)', background: 'var(--green-bg)' }}
                        >
                          Approve
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {isLast && turn.isApproved && (
                  <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--green-bg)', color: 'var(--green)', fontSize: '12px', fontWeight: 600, marginTop: '8px' }}>
                    Copy approved and saved to Knowledge Base
                  </div>
                )}
              </div>
            );
          })}

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
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={placeholder}
            rows={2}
            disabled={busy}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--sep)', fontSize: '14px', fontFamily: 'inherit',
              resize: 'none', outline: 'none', background: '#fff',
            }}
          />
          <button
            onClick={handleSend}
            disabled={busy || !input.trim()}
            style={{
              padding: '10px 18px', borderRadius: 'var(--radius-md)', border: 'none',
              background: '#1E1E2A', color: '#fff', fontSize: '13px', fontWeight: 600,
              cursor: busy ? 'default' : 'pointer',
              opacity: busy || !input.trim() ? 0.5 : 1, fontFamily: 'inherit',
            }}
          >
            {!started ? 'Start' : 'Send'}
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