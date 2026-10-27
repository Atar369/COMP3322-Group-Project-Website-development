import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { formatQueueCallingCountdown, getQueueCallingCountdown, isLastOrderCutoffReached } from '../utils/orderingWindow';

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

function isAfter21(now = new Date()) {
  return isLastOrderCutoffReached(now);
}

export default function Queue() {
  const { user } = useAuth();
  const [partySize, setPartySize] = useState(2);
  const [myEntry, setMyEntry] = useState(null);
  const [allQueue, setAllQueue] = useState([]);
  const [joinError, setJoinError] = useState('');
  const [rejoinError, setRejoinError] = useState('');
  const [isRejoining, setIsRejoining] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  function loadAll() {
    api.get('/queue').then(r => setAllQueue(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    api.get(`/queue/user/${user.user_id}`).then(r => {
      const entries = Array.isArray(r.data) ? r.data : [];
      const active = entries.find(q => ['queued', 'called', 'serving'].includes(q.status));
      const today = new Date().toISOString().slice(0, 10);
      const missed = entries.find(q => q.status === 'missed' && String(q.queue_date).slice(0, 10) === today);
      setMyEntry(active || missed || null);
    }).catch(() => {});
  }

  useEffect(loadAll, [user]);
  useEffect(() => {
    const timer = setInterval(loadAll, 5000);
    return () => clearInterval(timer);
  }, [user]);

  async function handleJoin() {
    setJoinError('');
    if (isAfter21(now)) {
      setJoinError('The restaurant stops accepting new queue entries at 21:00. Please try again tomorrow.');
      return;
    }
    try {
      await api.post('/queue', { party_size: partySize });
      loadAll();
    } catch (err) {
      setJoinError(err.response?.data?.error || 'Could not join queue.');
    }
  }

  async function handleLeave() {
    if (!myEntry) return;
    await api.patch(`/queue/${myEntry.queue_id}/cancel`);
    setMyEntry(null);
    loadAll();
  }

  async function handleRejoin() {
    if (!myEntry || myEntry.status !== 'missed') return;
    setRejoinError('');
    setIsRejoining(true);
    try {
      await api.post(`/queue/${myEntry.queue_id}/rejoin`);
      await loadAll();
    } catch (err) {
      setRejoinError(err.response?.data?.error || 'Could not rejoin the queue.');
    } finally {
      setIsRejoining(false);
    }
  }

  const groups = ['A', 'B', 'C'];
  function getNowServing(group) {
    const today = new Date().toISOString().slice(0, 10);
    return allQueue
      .filter(q => getGroupLabel(q.party_size) === group && q.status === 'called' && String(q.queue_date).slice(0, 10) === today)
      .sort((a, b) => new Date(b.called_at) - new Date(a.called_at))[0];
  }

  const currentGroupCall = myEntry?.status === 'missed'
    ? getNowServing(getGroupLabel(myEntry.party_size))
    : null;
  const missedNumber = Number(myEntry?.queue_number?.slice(1));
  const currentNumber = Number(currentGroupCall?.queue_number?.slice(1));
  const isWithinRejoinWindow = Number.isFinite(missedNumber)
    && Number.isFinite(currentNumber)
    && missedNumber <= currentNumber
    && missedNumber >= currentNumber - 35;
  const canRejoin = myEntry?.status === 'missed'
    && myEntry.rejoin_count === 0
    && isWithinRejoinWindow;
  const canJoin = !isAfter21(now);
  const callingCountdown = getQueueCallingCountdown(now);

  return (
    <div className="page">
      <h1>Queue</h1>
      <p style={{ color: '#6b6558', fontSize: '0.88rem', marginBottom: 20 }}>
        Once seated, you have 45 minutes to place orders. New orders stop at 21:00.
      </p>
      {(callingCountdown.active || callingCountdown.stopped) && (
        <div
          role="status"
          style={{
            marginBottom: 20,
            padding: '12px 16px',
            border: `1px solid ${callingCountdown.stopped ? 'var(--rust)' : 'var(--mustard)'}`,
            background: callingCountdown.stopped ? '#fff3f0' : '#fff9e9',
            color: callingCountdown.stopped ? 'var(--rust)' : 'var(--ink)',
            fontWeight: 600,
          }}
        >
          {callingCountdown.stopped
            ? 'Queue calling has stopped for today.'
            : `Queue calling stops in ${formatQueueCallingCountdown(callingCountdown.remainingMs)}. Calling will stop at 21:00.`}
        </div>
      )}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ margin: '0 0 16px' }}>Now Calling</h2>
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
                  {calling ? (calling.queue_number || '#' + calling.queue_id) : '—'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {!myEntry ? (
        <div className="card">
          <h3 style={{ marginBottom: 8 }}>Join the Waiting List</h3>
          <p style={{ color: '#6b6558', fontSize: '0.88rem', marginBottom: 16 }}>Enter your party size (1–12 people). Numbers reset daily.</p>
          {!canJoin && <p style={{ color: 'var(--rust)', fontSize: '0.88rem', marginBottom: 12, fontWeight: 600 }}>⏱ Restaurant stops accepting new queue entries at 21:00</p>}
          <div className="field">
            <label>Party Size</label>
            <select value={partySize} onChange={e => setPartySize(Number(e.target.value))} style={{ padding: '10px' }} disabled={!canJoin}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          {joinError && <p className="error-text">{joinError}</p>}
          <button className="btn" onClick={handleJoin} style={{ width: '100%' }} disabled={!canJoin}>Get Queue Number</button>
        </div>
      ) : (
        <div className="card" style={{ borderColor: 'var(--green)', borderWidth: 2, background: '#f9fbf8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: '1.2rem' }}>✓</span>
            <h3 style={{ margin: 0 }}>{myEntry.status === 'missed' ? 'You missed your turn' : 'You are in the queue'}</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Queue Number</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--mustard)', letterSpacing: 2 }}>
                {myEntry.queue_number || '#' + myEntry.queue_id}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Status</div>
              <div style={{ fontSize: '0.95rem', textTransform: 'capitalize' }}>{myEntry.status}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Joined At</div>
              <div style={{ fontSize: '0.95rem' }}>{myEntry.joined_at && myEntry.joined_at.slice(11, 19)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Party Size</div>
              <div style={{ fontSize: '0.95rem' }}>{myEntry.party_size} people</div>
            </div>
          </div>
          {myEntry.status === 'serving' && (
            <div style={{ marginTop: 12, padding: 10, background: 'var(--paper-dim)', borderLeft: '3px solid var(--green)' }}>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--green)' }}>You are now seated. You may place your order.</p>
            </div>
          )}
          {myEntry.status === 'missed' && (
            <div style={{ marginTop: 12, padding: 10, background: 'var(--paper-dim)', borderLeft: '3px solid var(--mustard)' }}>
              <p style={{ margin: 0 }}>
                {currentGroupCall
                  ? `Current ${getGroupLabel(myEntry.party_size)} call: ${currentGroupCall.queue_number}.`
                  : 'There is no current call for your queue group yet.'}
              </p>
              <p style={{ margin: '6px 0 0', fontSize: '0.88rem', color: '#6b6558' }}>
                {canRejoin
                  ? 'Your missed number is within 35 numbers of the current call. Rejoining gives you the number exactly 15 after the current call.'
                  : myEntry.rejoin_count > 0
                    ? 'You have already used your rejoin for this ticket.'
                    : currentGroupCall
                      ? 'Rejoin is available when your missed number is no more than 35 numbers behind the current call.'
                      : 'Rejoin becomes available when there is a current call for your queue group.'}
              </p>
              {rejoinError && <p className="error-text">{rejoinError}</p>}
              <button
                className="btn"
                onClick={handleRejoin}
                style={{ marginTop: 12, width: '100%' }}
                disabled={!canRejoin || isRejoining}
              >
                {isRejoining ? 'Rejoining…' : 'Rejoin Queue'}
              </button>
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
