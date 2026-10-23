import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

function getGroupLabel(size) {
  if (size <= 2) return 'A';
  if (size <= 6) return 'B';
  return 'C';
}

function getGroupRange(group) {
  if (group === 'A') return '1–2 People';
  if (group === 'B') return '3–6 People';
  return '7+ People';
}

export default function Queue() {
  const { user } = useAuth();
  const [partySize, setPartySize] = useState(2);
  const [myEntry, setMyEntry] = useState(null);
  const [allQueue, setAllQueue] = useState([]);

  function loadAll() {
    api.get('/queue').then(r => setAllQueue(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    api.get(`/queue/user/${user.user_id}`).then(r => {
      const entries = Array.isArray(r.data) ? r.data : [];
      const active = entries.find(q => ['queued', 'called', 'serving'].includes(q.status));
      setMyEntry(active || null);
    }).catch(() => {});
  }

  useEffect(loadAll, [user]);

  async function handleJoin() {
    const res = await api.post('/queue', { user_id: user.user_id, party_size: partySize });
    loadAll();
  }

  async function handleLeave() {
    if (!myEntry) return;
    await api.patch(`/queue/${myEntry.queue_id}/cancel`);
    setMyEntry(null);
    loadAll();
  }

  const groups = ['A', 'B', 'C'];

  function getNowServing(group) {
    return allQueue.find(q => getGroupLabel(q.party_size) === group && q.status === 'called');
  }

  return (
    <div className="page">
      <h1>Queue</h1>

      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Now Calling</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
          {groups.map(group => {
            const calling = getNowServing(group);
            return (
              <div key={group} className="card" style={{ padding: 16, textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--mustard)' }}>{group}</span>
                  <span style={{ fontSize: '0.8rem', color: '#6b6558' }}>{getGroupRange(group)}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#6b6558', marginBottom: 4 }}>Now Calling</div>
                <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '2px' }}>
                  {calling ? `#${calling.queue_id}` : '—'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!myEntry ? (
        <div className="card">
          <h3 style={{ marginBottom: 8 }}>Join the Waiting List</h3>
          <p style={{ color: '#6b6558', fontSize: '0.88rem', marginBottom: 16 }}>Enter your party size (1–12 people) to get a queue number.</p>
          <div className="field">
            <label>Party Size</label>
            <select value={partySize} onChange={e => setPartySize(Number(e.target.value))} style={{ padding: '10px' }}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <button className="btn" onClick={handleJoin} style={{ width: '100%' }}>Get Queue Number</button>
        </div>
      ) : (
        <div className="card" style={{ borderColor: 'var(--green)', borderWidth: 2, background: '#f9fbf8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: '1.2rem' }}>✓</span>
            <h3 style={{ margin: 0 }}>You are in the queue</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Queue ID</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>#{myEntry.queue_id}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Status</div>
              <div style={{ fontSize: '0.95rem', textTransform: 'capitalize' }}>{myEntry.status}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Joined At</div>
              <div style={{ fontSize: '0.95rem' }}>{myEntry.joined_at?.slice(11, 16)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Party Size</div>
              <div style={{ fontSize: '0.95rem' }}>{myEntry.party_size} people</div>
            </div>
          </div>
          {myEntry.status === 'serving' && (
            <div style={{ marginTop: 12, padding: 10, background: 'var(--paper-dim)', borderLeft: '3px solid var(--green)' }}>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--green)' }}>✓ You are now seated. You may place your order.</p>
            </div>
          )}
          {['queued', 'called'].includes(myEntry.status) && (
            <button className="btn secondary" onClick={handleLeave} style={{ marginTop: 20, width: '100%' }}>Leave Queue</button>
          )}
        </div>
      )}
    </div>
  );
}

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
