import { useState, useEffect } from 'react';
import api from '../../services/api';

export default function KBApprovalQueue() {
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async () => {
    const response = await api.get('/api/kb/approval-queue/all');
    setQueue(response.data);
  };

  const handleApprove = async (doc) => {
    await api.post(`/api/kb/${doc.brand_id}/approve/${doc.id}`);
    loadQueue();
  };

  const handleReject = async (doc) => {
    await api.post(`/api/kb/${doc.brand_id}/reject/${doc.id}`);
    loadQueue();
  };

  return (
    <div>
      <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 600 }}>KB approval queue</h3>

      {queue.length === 0 && (
        <p style={{ fontSize: '13px', color: 'var(--label3)' }}>No pending documents</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {queue.map((doc) => (
          <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: '1px solid var(--sep)', borderRadius: 'var(--radius-md)' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{doc.file_name}</div>
              <div style={{ fontSize: '11px', color: 'var(--label3)' }}>
                {doc.brands?.name} · {doc.doc_type.replace('_', ' ')} · {doc.word_count} words
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => handleReject(doc)} style={rejectBtn}>Reject</button>
              <button onClick={() => handleApprove(doc)} style={approveBtn}>Approve</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const approveBtn = { padding: '5px 12px', borderRadius: 'var(--radius-xl)', border: '1px solid rgba(34,197,94,.35)', color: 'var(--green)', background: 'var(--green-bg)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' };
const rejectBtn = { padding: '5px 12px', borderRadius: 'var(--radius-xl)', border: '1px solid rgba(239,68,68,.3)', color: 'var(--red)', background: 'var(--red-bg)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' };