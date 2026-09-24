import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { queue_entries, joinQueue, getNowServing, getGroupLabel, getGroupRange } from '../data/mockData';

export default function Queue() {
  const { user } = useAuth();
  const [partySize, setPartySize] = useState(2);
  const [myQueueId, setMyQueueId] = useState(
    queue_entries.find(q => q.user_id === user.user_id && q.status !== 'seated')?.queue_id || null
  );

  function handleJoin() {
    const id = joinQueue(user.user_id, partySize);
    setMyQueueId(id);
  }

  function handleLeave() {
    setMyQueueId(null);
  }

  const groups = ['A', 'B', 'C'];

  return (
    <div className="page">
      <h1>Queue</h1>
      <p style={{ color: '#6b6558', fontSize: '0.9rem', marginBottom: 24 }}>Tuesday, May 20, 2025</p>

      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Now Calling</h2>
          <span style={{ fontSize: '0.8rem', color: '#6b6558' }}>Updated just now</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
          {groups.map(group => {
            const nowServing = getNowServing(group);
            return (
              <div key={group} className="card" style={{ padding: 16, textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--mustard)' }}>{group}</span>
                  <span style={{ fontSize: '0.8rem', color: '#6b6558' }}>{getGroupRange(group)}</span>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: '0.8rem', color: '#6b6558', marginBottom: 4 }}>Now Calling</div>
                  <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '2px' }}>
                    {nowServing?.queue_id || '—'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!myQueueId ? (
        <div className="card">
          <h3 style={{ marginBottom: 8 }}>Join the Waiting List</h3>
          <p style={{ color: '#6b6558', fontSize: '0.88rem', marginBottom: 16 }}>Enter your party size (1–12 people) to get a queue number.</p>

          <div className="field">
            <label>Party Size</label>
            <select value={partySize} onChange={e => setPartySize(Number(e.target.value))} style={{ padding: '10px' }}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <button className="btn" onClick={handleJoin} style={{ width: '100%' }}>Get Queue Number</button>
        </div>
      ) : (
        <div className="card" style={{ borderColor: 'var(--green)', borderWidth: 2, background: '#f9fbf8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: '1.2rem' }}>✓</span>
            <h3 style={{ margin: 0 }}>You have joined the waiting list</h3>
          </div>

          {(() => {
            const myEntry = queue_entries.find(q => q.queue_id === myQueueId);
            const groupWaiting = queue_entries.filter(q => q.group === myEntry?.group && q.status === 'waiting').sort((a, b) => new Date(a.joined_at) - new Date(b.joined_at));
            const position = groupWaiting.findIndex(q => q.queue_id === myQueueId) + 1;

            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Queue ID</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>{myQueueId}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Joined At</div>
                  <div style={{ fontSize: '0.95rem' }}>10:24:37 AM</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Position in Queue</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{position} <span style={{ fontSize: '0.85rem', color: '#6b6558' }}>(next in your group size)</span></div>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Party Size</div>
                  <div style={{ fontSize: '0.95rem' }}>{myEntry?.party_size} people</div>
                </div>
              </div>
            );
          })()}

          <button className="btn secondary" onClick={handleLeave} style={{ marginTop: 20, width: '100%' }}>Leave Queue</button>
        </div>
      )}
    </div>
  );
}
