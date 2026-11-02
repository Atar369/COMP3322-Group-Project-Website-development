import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { socket } from '../../socket';
import { isLastOrderCutoffReached } from '../../utils/orderingWindow';

const GROUPS = ['A', 'B', 'C'];
const GROUP_RANGES = { A: '1–2 People', B: '3–6 People', C: '7+ People' };
const AUTO_CALL_TIMEOUT_MS = 10_000;
const DINING_SESSION_MS = 60 * 60 * 1000;

function getGroupLabel(size) {
  if (size <= 2) return 'A';
  if (size <= 6) return 'B';
  return 'C';
}

function getCurrentCall(queue, group) {
  return queue
    .filter(entry => getGroupLabel(entry.party_size) === group && entry.status === 'called')
    .sort((a, b) => new Date(b.called_at) - new Date(a.called_at))[0] || null;
}

function getNextQueued(queue, group) {
  return queue
    .filter(entry => getGroupLabel(entry.party_size) === group && entry.status === 'queued')
    .sort((a, b) => (a.queue_number || '').localeCompare(b.queue_number || ''))[0] || null;
}

export default function ManagerQueue() {
  const [queue, setQueue] = useState([]);
  const [autoCall, setAutoCall] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState('');

  const [busy, setBusy] = useState({});
  const [now, setNow] = useState(Date.now());
  const cutoffReached = isLastOrderCutoffReached(new Date(now));

  const isBusy = (group, action) => Boolean(busy[`${group}:${action}`]);
  const setBusyFlag = (group, action, value) => {
    setBusy(previous => ({ ...previous, [`${group}:${action}`]: value }));
  };

  const load = useCallback(async () => {
    try {
      const [queueResponse, settingsResponse] = await Promise.all([
        api.get('/queue'),
        api.get('/queue/auto-call'),
      ]);
      setQueue(Array.isArray(queueResponse.data) ? queueResponse.data : []);
      const settings = Array.isArray(settingsResponse.data) ? settingsResponse.data : [];
      setAutoCall(Object.fromEntries(settings.map(setting => [setting.group_code, Boolean(setting.enabled)])));
      setError('');
    } catch {
      setError('Unable to load queue and auto-call status. Please retry.');
    }
  }, []);

  useEffect(() => {
    load();
    if (!socket.connected) socket.connect();

    const refresh = () => load();
    socket.on('queue:update', refresh);
    socket.on('queue:manager-update', refresh);

    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      socket.off('queue:update', refresh);
      socket.off('queue:manager-update', refresh);
      clearInterval(clock);
    };
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => {
      queue.forEach(entry => {
        if (entry.status === 'serving' && entry.served_at
          && Date.now() - new Date(entry.served_at).getTime() >= DINING_SESSION_MS) {
          setNotifications(previous => {
            if (previous.some(n => n.id === entry.queue_id)) return previous;
            return [...previous, {
              id: entry.queue_id,
              message: `Queue ${entry.queue_number || `#${entry.queue_id}`} has completed dining. Please collect payment.`,
            }];
          });
        }
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [queue]);

  async function handleSeat(group, currentCall) {
    if (!currentCall || isBusy(group, 'seat')) return;
    setBusyFlag(group, 'seat', true);
    setError('');
    try {
      await api.patch(`/queue/${currentCall.queue_id}/seat`);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to seat this customer.');
    } finally {
      setBusyFlag(group, 'seat', false);
    }
  }

  async function handleCallNext(group) {
    if (isBusy(group, 'call')) return;
    const next = getNextQueued(queue, group);
    if (!next) {
      setError(`No one is waiting in group ${group}.`);
      return;
    }
    setBusyFlag(group, 'call', true);
    setError('');
    try {
      await api.patch(`/queue/${next.queue_id}/call`);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to call the next customer.');
    } finally {
      setBusyFlag(group, 'call', false);
    }
  }

  async function handleToggleAutoCall(group) {
    if (isBusy(group, 'auto')) return;
    const enabled = !autoCall[group];
    setBusyFlag(group, 'auto', true);
    setError('');
    try {
      await api.patch(`/queue/auto-call/${group}`, { enabled });
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to change auto-call mode.');
    } finally {
      setBusyFlag(group, 'auto', false);
    }
  }

  return (
    <div className="page">
      <h1>Queue Management</h1>
      <p style={{ color: '#6b6558', fontSize: '0.85rem', marginBottom: 20 }}>
        Auto call selects the next waiting party with a suitable free table. Unseated calls are marked missed after 10 seconds.
        Use <strong>Call next</strong> to manually call the next waiting party in a group.
      </p>
      {cutoffReached && (
        <p className="error-text">Queue calls and seating are closed for the day after 21:00.</p>
      )}

      {error && (
        <p className="error-text">
          {error} <button className="btn secondary" onClick={load}>Retry</button>
        </p>
      )}

      {notifications.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {notifications.map(notification => (
            <div key={notification.id} style={{ background: '#fff3cd', border: '2px solid var(--mustard)', padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
              <p style={{ flex: 1, margin: 0, fontWeight: 600 }}>{notification.message}</p>
              <button
                className="btn secondary"
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                onClick={() => setNotifications(previous => previous.filter(item => item.id !== notification.id))}
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ margin: '0 0 16px' }}>Now Calling</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {GROUPS.map(group => {
          const currentCall = getCurrentCall(queue, group);
          const nextQueued = getNextQueued(queue, group);
          const callAge = currentCall?.called_at
            ? Math.max(0, now - new Date(currentCall.called_at).getTime())
            : null;
          const remainingSeconds = callAge === null
            ? null
            : Math.max(0, Math.ceil((AUTO_CALL_TIMEOUT_MS - callAge) / 1000));

          const seating = isBusy(group, 'seat');
          const calling = isBusy(group, 'call');
          const toggling = isBusy(group, 'auto');

          return (
            <div key={group} className="card" style={{ padding: 18, textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--mustard)' }}>{group}</span>
                <span style={{ fontSize: '0.8rem', color: '#6b6558' }}>{GROUP_RANGES[group]}</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6b6558', marginBottom: 4 }}>Now Calling</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: 2 }}>
                {currentCall?.queue_number || '—'}
              </div>
              {currentCall && (
                <div style={{ minHeight: 42, marginTop: 8, color: '#6b6558', fontSize: '0.85rem' }}>
                  Party of {currentCall.party_size}
                  {currentCall.assigned_table_number && ` · Table ${currentCall.assigned_table_number}`}
                  {autoCall[group] && remainingSeconds > 0 && ` · ${remainingSeconds}s to seat`}
                </div>
              )}
              <div style={{ minHeight: 18, marginTop: 4, color: '#6b6558', fontSize: '0.78rem' }}>
                {nextQueued ? `Next: ${nextQueued.queue_number} · party of ${nextQueued.party_size}` : 'No one waiting'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                <button
                  className="btn"
                  disabled={!currentCall || seating || cutoffReached}
                  onClick={() => handleSeat(group, currentCall)}
                  style={{
                    width: '100%',
                    background: 'var(--green)',
                    opacity: cutoffReached ? 0.5 : 1,
                    cursor: cutoffReached ? 'not-allowed' : 'pointer',
                  }}
                >
                  {seating ? 'Seating…' : 'Seated'}
                </button>
                <button
                  className="btn"
                  disabled={!nextQueued || calling || cutoffReached}
                  onClick={() => handleCallNext(group)}
                  style={{
                    width: '100%',
                    background: 'var(--mustard)',
                    color: 'var(--ink)',
                    opacity: (!nextQueued || cutoffReached) ? 0.5 : 1,
                    cursor: (!nextQueued || cutoffReached) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {calling ? 'Calling…' : 'Call next'}
                </button>
                <button
                  className="btn secondary"
                  disabled={toggling || cutoffReached}
                  onClick={() => handleToggleAutoCall(group)}
                  style={{
                    width: '100%',
                    opacity: cutoffReached ? 0.5 : 1,
                    cursor: cutoffReached ? 'not-allowed' : 'pointer',
                  }}
                >
                  {autoCall[group] ? 'Auto off' : 'Auto On'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}