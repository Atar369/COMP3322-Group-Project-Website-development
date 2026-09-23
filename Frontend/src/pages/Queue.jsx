import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { queue_entries, joinQueue } from '../data/mockData';

export default function Queue() {
  const { user } = useAuth();
  const [partySize, setPartySize] = useState(2);
  const [myQueueId, setMyQueueId] = useState(
    queue_entries.find(q => q.user_id === user.user_id && q.status === 'waiting')?.queue_id || null
  );

  const waitingList = queue_entries.filter(q => q.status === 'waiting').sort((a, b) => new Date(a.joined_at) - new Date(b.joined_at));
  const myPosition = waitingList.findIndex(q => q.queue_id === myQueueId) + 1;

  function handleJoin() {
    const id = joinQueue(user.user_id, partySize);
    setMyQueueId(id);
  }

  return (
    <div className="page">
      <h1>Queue</h1>
      {!myQueueId ? (
        <div className="card">
          <div className="field">
            <label>Party size</label>
            <input type="number" min={1} max={12} value={partySize} onChange={e => setPartySize(Number(e.target.value))} />
          </div>
          <button className="btn" onClick={handleJoin}>Join the queue</button>
        </div>
      ) : (
        <div className="card">
          <p style={{ fontSize: '0.9rem', color: '#6b6558' }}>Real-time position — updates automatically via WebSocket in the live app</p>
          <p className="stat"><span className="num">#{myPosition}</span> <span className="label">in line, party of {partySize}</span></p>
        </div>
      )}
    </div>
  );
}
