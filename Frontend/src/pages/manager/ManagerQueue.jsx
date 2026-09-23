import { useState } from 'react';
import { queue_entries as initial } from '../../data/mockData';

export default function ManagerQueue() {
  const [queue, setQueue] = useState(initial);

  function callNext(queue_id) {
    setQueue(prev => prev.map(q => q.queue_id === queue_id ? { ...q, status: 'called', called_at: new Date().toISOString() } : q));
  }

  function markSeated(queue_id) {
    setQueue(prev => prev.map(q => q.queue_id === queue_id ? { ...q, status: 'seated', seated_at: new Date().toISOString() } : q));
  }

  return (
    <div className="page">
      <h1>Queue management</h1>
      {queue.filter(q => q.status !== 'seated' && q.status !== 'cancelled').map(q => (
        <div className="ticket-row" key={q.queue_id}>
          <span className="name">Party of {q.party_size}</span>
          <span className="leader" />
          <span className={`badge ${q.status === 'waiting' ? 'pending' : 'ready'}`}>{q.status}</span>
          {q.status === 'waiting' && <button className="btn" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => callNext(q.queue_id)}>Call</button>}
          {q.status === 'called' && <button className="btn" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => markSeated(q.queue_id)}>Seated</button>}
        </div>
      ))}
    </div>
  );
}
