import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export default function ManagerQueue() {
  const [queue, setQueue] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const load = useCallback(() => {
    api.get('/queue').then(r => setQueue(Array.isArray(r.data) ? r.data : [])).catch(() => setQueue([]));
  }, []);

  useEffect(load, [load]);

  // 2-hour auto-finish timer
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      queue.forEach(q => {
        if (q.status === 'serving' && q.served_at) {
          if (now - new Date(q.served_at).getTime() >= TWO_HOURS_MS) {
            api.patch(`/queue/${q.queue_id}/finish`).then(() => {
              setNotifications(prev => {
                if (prev.find(n => n.id === q.queue_id)) return prev;
                return [...prev, { id: q.queue_id, msg: `⏰ Queue #${q.queue_id} (Party of ${q.party_size}) — 2 hours elapsed. Please collect payment.`, time: new Date().toLocaleTimeString() }];
              });
              load();
            }).catch(() => {});
          }
        }
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [queue, load]);

  async function handleCall(queue_id) {
    await api.patch(`/queue/${queue_id}/call`);
    load();
  }

  async function handleServe(queue_id) {
    await api.patch(`/queue/${queue_id}/checkin`);
    load();
  }

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

  function getTimeRemaining(served_at) {
    if (!served_at) return null;
    const remaining = TWO_HOURS_MS - (Date.now() - new Date(served_at).getTime());
    if (remaining <= 0) return 'Time up';
    const mins = Math.floor(remaining / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  const active = queue.filter(q => !['finished', 'paid', 'cancelled'].includes(q.status));

  return (
    <div className="page">
      <h1>Queue Management</h1>
      <p style={{ color: '#6b6558', fontSize: '0.85rem', marginBottom: 12 }}>
        Call waiting customers, then click <strong>Seat &amp; Serve</strong> when the customer presents their number. A 2-hour timer starts on serving.
      </p>

      {notifications.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {notifications.map(n => (
            <div key={n.id} style={{ background: '#fff3cd', border: '2px solid var(--mustard)', padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{n.msg}</p>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#6b6558' }}>At {n.time}</p>
              </div>
              <button className="btn secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => setNotifications(prev => prev.filter(x => x.id !== n.id))}>Dismiss</button>
            </div>
          ))}
        </div>
      )}

      {['A', 'B', 'C'].map(group => {
        const entries = active.filter(q => getGroupLabel(q.party_size) === group);
        if (!entries.length) return null;
        return (
          <div key={group} style={{ marginBottom: 28 }}>
            <h3 style={{ marginBottom: 12 }}>Group {group} — {getGroupRange(group)}</h3>
            {entries.map(q => {
              const tr = getTimeRemaining(q.served_at);
              return (
                <div className="ticket-row" key={q.queue_id}>
                  <span style={{ fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: '1.1rem', minWidth: 50 }}>#{q.queue_id}</span>
                  <span className="name">Party of {q.party_size}</span>
                  <span className="leader" />
                  <span className={`badge ${q.status === 'queued' ? 'pending' : q.status === 'serving' ? 'preparing' : 'ready'}`}>
                    {q.status === 'queued' ? 'In Queue' : q.status === 'called' ? 'Called' : q.status === 'serving' ? 'Serving' : q.status}
                  </span>
                  {q.status === 'serving' && tr && (
                    <span style={{ fontSize: '0.8rem', color: tr === 'Time up' ? 'var(--rust)' : 'var(--green)', fontWeight: 600, marginLeft: 6 }}>⏱ {tr}</span>
                  )}
                  {q.status === 'queued' && <button className="btn" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => handleCall(q.queue_id)}>Call</button>}
                  {q.status === 'called' && <button className="btn" style={{ padding: '4px 10px', fontSize: '0.8rem', background: 'var(--mustard)' }} onClick={() => handleServe(q.queue_id)}>Seat &amp; Serve</button>}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
