import { useState, useEffect } from 'react';
import { forgeService } from '../services/forgeService';
import FormatChips from '../components/brief/FormatChips';
import AgentSelector from '../components/forge/AgentSelector';
import DebateCard from '../components/forge/DebateCard';
import DirectionInput from '../components/forge/DirectionInput';
import VariantCard from '../components/variants/VariantCard';

export default function ForgeTab({ brand, activeSessionId, onSessionCreated }) {
  const [format, setFormat] = useState('caption');
  const [briefText, setBriefText] = useState('');
  const [generator, setGenerator] = useState('Vikram');
  const [critic, setCritic] = useState('Maya');
  const [debateHistory, setDebateHistory] = useState([]);
  const [finalCopy, setFinalCopy] = useState(null);
  const [keywords, setKeywords] = useState([]);
  const [score, setScore] = useState(0);
  const [isApproved, setIsApproved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState(activeSessionId);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!activeSessionId) {
      setSessionId(null);
      setDebateHistory([]);
      setFinalCopy(null);
      setKeywords([]);
      setScore(0);
      setIsApproved(false);
      setStarted(false);
      setBriefText('');
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
        setBriefText(res.brief || '');
        setStarted(true);
      }
    }).catch(() => {});
  }, [activeSessionId]);

  const handleStart = async () => {
    if (!briefText.trim()) return;

    setLoading(true);
    setError('');

    try {
      const result = await forgeService.start({
        brand_id: brand.id,
        brief: briefText,
        generator,
        critic,
        format,
      });

      setDebateHistory(result.debate_history);
      setFinalCopy(result.final_copy);
      setKeywords(result.keywords || []);
      setScore(result.score || 0);
      setIsApproved(result.is_approved);
      setSessionId(result.session_id);
      setStarted(true);
      onSessionCreated(result.session_id);
    } catch (err) {
      console.error('[forge] start request did not resolve cleanly:', err);
      setError(
        err.response?.data?.detail ||
        'Forge debate failed. Make sure Ollama is running locally with mistral and gemma models.'
      );
    } finally {
      setLoading(false);
      // Refresh the sidebar no matter what — the backend creates the
      // chat_sessions row at the start of the debate, so the session
      // exists even if the request later errors or times out.
      window.dispatchEvent(new CustomEvent('voice-session-created'));
    }
  };

  const handleTurn = async (direction) => {
    setLoading(true);
    setError('');

    try {
      const result = await forgeService.turn({
        brand_id: brand.id,
        session_id: sessionId,
        brief: briefText,
        generator,
        critic,
        direction,
      });

      setDebateHistory([...debateHistory, ...result.debate_history]);
      setFinalCopy(result.final_copy);
      setKeywords(result.keywords || []);
      setScore(result.score || 0);
      setIsApproved(result.is_approved);
    } catch (err) {
      setError(err.response?.data?.detail || 'Forge turn failed.');
    } finally {
      setLoading(false);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {!started && (
          <div style={{ textAlign: 'center', color: 'var(--label3)', marginTop: '40px', fontSize: '13px' }}>
            Select a generator and critic, write a brief, and start the debate.
            <br />
            Uses free local models (Mistral + Gemma) — zero API cost.
          </div>
        )}

        {debateHistory.map((msg, i) => (
          <DebateCard key={i} message={msg} />
        ))}

        {finalCopy && (
          <VariantCard
            variant={{
              model: 'forge',
              content: finalCopy,
              keywords,
              score,
              format,
              streaming: false,
            }}
          />
        )}

        {finalCopy && !isApproved && (
          <DirectionInput
            onAgree={() => handleTurn(null)}
            onDirection={(dir) => handleTurn(dir)}
            onApprove={handleApprove}
            loading={loading}
          />
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

      <div style={{ borderTop: '1px solid var(--sep)', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <FormatChips value={format} onChange={setFormat} />
          <AgentSelector generator={generator} critic={critic} onGeneratorChange={setGenerator} onCriticChange={setCritic} />
        </div>

        {!started && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <textarea
              value={briefText}
              onChange={(e) => setBriefText(e.target.value)}
              placeholder="Write your brief for the debate..."
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
            />
            <button
              onClick={handleStart}
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
              Start debate
            </button>
          </div>
        )}
      </div>
    </div>
  );
}