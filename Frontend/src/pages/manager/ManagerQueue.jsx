import { useState } from 'react';
import { queue_entries as initial, getGroupRange } from '../../data/mockData';

export default function ManagerQueue() {
  const [queue, setQueue] = useState(initial);

  function callNext(queue_id) {
    setQueue(prev => prev.map(q => q.queue_id === queue_id ? { ...q, status: 'serving', called_at: new Date().toISOString() } : q));
  }

  function markSeated(queue_id) {
    setQueue(prev => prev.map(q => q.queue_id === queue_id ? { ...q, status: 'seated', seated_at: new Date().toISOString() } : q));
  }

  const active = queue.filter(q => q.status !== 'seated' && q.status !== 'cancelled')
    .sort((a, b) => new Date(a.joined_at) - new Date(b.joined_at));

  return (
    <div className="page">
      <h1>Queue Management</h1>

      {['A', 'B', 'C'].map(group => {
        const entries = active.filter(q => q.group === group);
        if (!entries.length) return null;
        return (
          <div key={group} style={{ marginBottom: 28 }}>
            <h3 style={{ marginBottom: 12 }}>Group {group} — {getGroupRange(group)}</h3>
            {entries.map(q => (
              <div className="ticket-row" key={q.queue_id}>
                <span style={{ fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: '1.1rem', minWidth: 60 }}>{q.queue_id}</span>
                <span className="name">Party of {q.party_size}</span>
                <span className="leader" />
                <span className={`badge ${q.status === 'waiting' ? 'pending' : 'ready'}`}>{q.status === 'serving' ? 'calling' : q.status}</span>
                {q.status === 'waiting' && <button className="btn" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => callNext(q.queue_id)}>Call</button>}
                {q.status === 'serving' && <button className="btn" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => markSeated(q.queue_id)}>Seated</button>}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
