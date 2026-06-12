export default function DebateCard({ message }) {
  const isCritic = message.agent === 'Maya' || message.agent === 'Arjun';
  const isApproved = message.content.includes('APPROVED');

  const agentColors = {
    Vikram: '#7c3aed',
    Priya: '#7c3aed',
    Maya: '#D85A30',
    Arjun: '#D85A30',
  };

  return (
    <div
      style={{
        border: '1px solid var(--sep)',
        borderLeft: `3px solid ${agentColors[message.agent] || 'var(--accent)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '12px 14px',
        marginBottom: '10px',
        background: '#fff',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: agentColors[message.agent] }}>
          {message.agent} {isCritic ? '· Critic' : '· Generator'}
        </span>
        {isApproved && (
          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase' }}>
            Approved
          </span>
        )}
      </div>
      <div style={{ fontSize: '13.5px', color: 'var(--label2)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
        {message.content}
      </div>
    </div>
  );
}