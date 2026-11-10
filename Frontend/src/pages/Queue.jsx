import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { socket } from '../socket';
import {
  formatQueueCallingCountdown,
  getQueueCallingCountdown,
  isLastOrderCutoffReached,
} from '../utils/orderingWindow';
import {
  formatRestaurantTime,
  getRestaurantDateKey,
  getRestaurantTimestamp,
} from '../utils/restaurantTime';
import '../queue.css';

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

// --- Display-only helpers (no effect on queue logic) ---
const STEPS = [
  { key: 'queued', label: 'Waiting' },
  { key: 'called', label: 'Called' },
  { key: 'serving', label: 'Seated' },
];

const STATUS_COPY = {
  queued: { title: 'You are in the queue', text: 'This page updates automatically when your number is called.' },
  called: { title: '🔔 Called — please proceed to the counter', text: 'Your table is ready. Please see our host now.' },
  serving: { title: 'You are now seated', text: 'You may place your order.' },
  missed: { title: 'You missed your turn', text: 'You have already missed your turn once. Please see the manager to rejoin.' },
};

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c.9-3.6 3.8-5.5 7.5-5.5s6.6 1.9 7.5 5.5" />
    </svg>
  );
}

export default function Queue() {
  const { user } = useAuth();
  const [partySize, setPartySize] = useState(2);
  const [myEntry, setMyEntry] = useState(null);
  const [allQueue, setAllQueue] = useState([]);
  const [joinError, setJoinError] = useState('');
  const [joinMessage, setJoinMessage] = useState('');
  const [queueActionError, setQueueActionError] = useState('');
  const [isLeaving, setIsLeaving] = useState(false);
  const [calledBanner, setCalledBanner] = useState(null);
  const [now, setNow] = useState(new Date());
  const queueRequestVersion = useRef(0);
  const myEntryRef = useRef(myEntry);

  useEffect(() => {
    myEntryRef.current = myEntry;
  }, [myEntry]);

  // Timer for the 21:00 cutoff countdown
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Queue Data
  const loadAll = useCallback(async () => {
    if (!user) return;
    const requestVersion = ++queueRequestVersion.current;
    try {
      const [queueRes, mineRes] = await Promise.all([
        api.get('/queue'),
        api.get(`/queue/user/${user.user_id}`),
      ]);
      if (requestVersion !== queueRequestVersion.current) return;
      setAllQueue(Array.isArray(queueRes.data) ? queueRes.data : []);

      const entries = Array.isArray(mineRes.data) ? mineRes.data : [];
      const today = getRestaurantDateKey();
      const active = entries.find(q =>
        ['queued', 'called', 'serving'].includes(q.status)
        && String(q.queue_date).slice(0, 10) === today
      );

      const missed = entries.find(
        q => q.status === 'missed' && String(q.queue_date).slice(0, 10) === today
      );
      setMyEntry(active || missed || null);
    } catch {
      /* silent */
    }
  }, [user]);

  // Setup WebSocket & Initial Load
  useEffect(() => {
    loadAll();

    if (!socket.connected) socket.connect();

    const refresh = payload => {
      if (payload?.action === 'call' || payload?.action === 'auto-call') {
        const entry = myEntryRef.current;
        const calledNumber = String(payload.queueNumber || '');
        if (
          entry?.status === 'queued'
          && calledNumber
          && calledNumber !== entry.queue_number
          && getGroupLabel(entry.party_size) === calledNumber[0]
        ) {
          setCalledBanner({
            queueNumber: calledNumber,
            message: `${calledNumber} is being called. Please wait for your number.`,
          });
          setTimeout(() => setCalledBanner(null), 15000);
        }
      }
      loadAll();
    };
    const onCalled = payload => {
      if (!payload) return;
      setCalledBanner(payload);
      refresh();

      // Auto-hide the banner after 15 seconds
      setTimeout(() => setCalledBanner(null), 15000);
    };

    socket.on('queue:update', refresh);
    socket.on('queue:called', onCalled);

    return () => {
      socket.off('queue:update', refresh);
      socket.off('queue:called', onCalled);
    };
  }, [loadAll]);

  async function handleJoin() {
    setJoinError('');
    setJoinMessage('');
    if (isLastOrderCutoffReached(now)) {
      setJoinError('The restaurant stops accepting new queue entries at 21:00. Please try again tomorrow.');
      return;
    }
    try {
      await api.post('/queue', { party_size: partySize });
      loadAll();
    } catch (err) {
      setJoinError(err.response?.data?.error || 'Could not join the queue.');
    }
  }

  async function handleLeave() {
    if (!myEntry) return;
    setIsLeaving(true);
    setQueueActionError('');
    setJoinError('');
    setJoinMessage('');
    try {
      await api.patch(`/queue/${myEntry.queue_id}/cancel`);
      queueRequestVersion.current += 1;
      setPartySize(Number(myEntry.party_size));
      setMyEntry(null);
      setJoinMessage('You have left the queue. Choose a party size and select “Get queue number” to join again; no new ticket has been issued.');
    } catch (err) {
      setQueueActionError(err.response?.data?.error || 'Could not leave the queue. Please try again.');
      setIsLeaving(false);
      return;
    }

    try {
      const response = await api.get('/queue');
      setAllQueue(Array.isArray(response.data) ? response.data : []);
    } catch {
      setQueueActionError('You left the queue, but the public queue board could not be refreshed.');
    } finally {
      setIsLeaving(false);
    }
  }

  const groups = ['A', 'B', 'C'];

  function getNowServing(group, queueDate = null) {
    return allQueue
      .filter(q => getGroupLabel(q.party_size) === group
        && q.status === 'called'
        && (!queueDate || String(q.queue_date).slice(0, 10) === String(queueDate).slice(0, 10)))
      .sort((a, b) => getRestaurantTimestamp(b.called_at) - getRestaurantTimestamp(a.called_at))[0];
  }

  const canJoin = !isLastOrderCutoffReached(now);
  const callingCountdown = getQueueCallingCountdown(now);

  // Display-only values for the ticket
  const myGroup = myEntry ? getGroupLabel(myEntry.party_size) : null;
  const myGroupCall = myGroup ? getNowServing(myGroup) : null;
  const stepIndex = myEntry ? STEPS.findIndex(step => step.key === myEntry.status) : -1;
  const copy = myEntry ? (STATUS_COPY[myEntry.status] || { title: myEntry.status, text: '' }) : null;
  const myNumber = myEntry ? (myEntry.queue_number || '#' + myEntry.queue_id) : '';

  return (
    <div className="page queue-page">
      {/* REAL-TIME BANNER (Appears when the manager calls your number via WebSocket) */}
      {calledBanner && (
        <div className="queue-toast" role="alert">
          <span className="queue-toast-bell" aria-hidden="true">🔔</span>
          <div>
            <strong>{calledBanner.queueNumber}</strong>
            <p>{calledBanner.message}</p>
          </div>
        </div>
      )}

      <header className="queue-header">
        <span className="queue-eyebrow">WALK-IN QUEUE</span>
        <h1>Queue</h1>
        <span className="queue-squiggle" aria-hidden="true" />
        <p className="queue-intro">Once seated, you have 45 minutes to place orders. New orders stop at 21:00.</p>
      </header>

      {(callingCountdown.active || callingCountdown.stopped) && (
        <div
          role="status"
          className={`queue-notice${callingCountdown.stopped ? ' is-stopped' : ''}`}
        >
          {callingCountdown.stopped
            ? 'Queue calling has stopped for today.'
            : `Queue calling stops in ${formatQueueCallingCountdown(callingCountdown.remainingMs)}.`}
        </div>
      )}

      {/* NOW CALLING */}
      <section className="queue-calling" aria-label="Now calling">
        <div className="queue-section-head">
          <h2>Now calling</h2>
          <span className="queue-section-note">Updates in real time</span>
        </div>
        <div className="queue-calling-grid">
          {groups.map(group => {
            const calling = getNowServing(group);
            const mine = myGroup === group;
            return (
              <div key={group} className={`queue-calling-card${mine ? ' is-mine' : ''}`}>
                <span className={`queue-circle queue-circle-${group.toLowerCase()}`}>{group}</span>
                <span className="queue-calling-range">{getGroupRange(group)}</span>
                <span className="queue-calling-number">
                  {calling ? (calling.queue_number || '#' + calling.queue_id) : '—'}
                </span>
                {mine && <span className="queue-mine-tag">Your group</span>}
              </div>
            );
          })}
        </div>
      </section>

      {!myEntry ? (
        /* JOIN */
        <section className="queue-join">
          <span className="queue-eyebrow">GET A TICKET</span>
          <h2>Join the waiting list</h2>
          <p className="queue-join-text">Enter your party size (1–12 people). Numbers reset daily.</p>
          {!canJoin && (
            <p className="queue-warning">⏱ Restaurant stops accepting new queue entries at 21:00</p>
          )}

          <div className="queue-stepper" role="group" aria-label="Party size">
            <button
              type="button"
              className="queue-stepper-btn"
              aria-label="Fewer guests"
              onClick={() => setPartySize(size => Math.max(1, size - 1))}
              disabled={!canJoin || partySize <= 1}
            >
              −
            </button>
            <div className="queue-stepper-value" aria-live="polite">
              <strong>{partySize}</strong>
              <span>{partySize === 1 ? 'guest' : 'guests'}</span>
            </div>
            <button
              type="button"
              className="queue-stepper-btn"
              aria-label="More guests"
              onClick={() => setPartySize(size => Math.min(12, size + 1))}
              disabled={!canJoin || partySize >= 12}
            >
              +
            </button>
          </div>

          <p className="queue-group-chip">
            <span className={`queue-circle queue-circle-small queue-circle-${getGroupLabel(partySize).toLowerCase()}`}>
              {getGroupLabel(partySize)}
            </span>
            Group {getGroupLabel(partySize)} · {getGroupRange(getGroupLabel(partySize))}
          </p>

          {joinError && <p className="error-text">{joinError}</p>}
          {joinMessage && <p className="queue-join-text" role="status">{joinMessage}</p>}
          <button type="button" className="queue-primary-btn" onClick={handleJoin} disabled={!canJoin}>
            Get queue number →
          </button>
        </section>
      ) : (
        /* TICKET */
        <section className={`queue-ticket queue-ticket-${myEntry.status}`} aria-label="Your queue ticket">
          <div className="queue-ticket-zig" aria-hidden="true" />
          <div className="queue-ticket-head">
            <div className="queue-ticket-id">
              <span className="queue-ticket-label">YOUR NUMBER</span>
              <span className="queue-ticket-number">{myNumber}</span>
              <span className="queue-ticket-party">
                <PersonIcon /> {myEntry.party_size} {Number(myEntry.party_size) === 1 ? 'person' : 'people'}
              </span>
            </div>
            <div className="queue-ticket-now">
              <span>NOW CALLING · GROUP {myGroup}</span>
              <strong>{myGroupCall ? (myGroupCall.queue_number || '#' + myGroupCall.queue_id) : '—'}</strong>
            </div>
          </div>

          <div className="queue-ticket-body">
            <h3 className="queue-ticket-title">{copy.title}</h3>
            {copy.text && <p className="queue-ticket-text">{copy.text}</p>}

            {stepIndex >= 0 && (
              <ol className="queue-steps" aria-label="Queue progress">
                {STEPS.map((step, index) => (
                  <li
                    key={step.key}
                    className={index < stepIndex ? 'is-done' : index === stepIndex ? 'is-current' : ''}
                    aria-current={index === stepIndex ? 'step' : undefined}
                  >
                    <span className="queue-step-dot">{index < stepIndex ? '✓' : index + 1}</span>
                    <span className="queue-step-label">{step.label}</span>
                  </li>
                ))}
              </ol>
            )}

          </div>

          <div className="queue-ticket-perf" aria-hidden="true" />

          <div className="queue-ticket-stub">
            <div>
              <span className="queue-stub-label">Joined at</span>
              <span className="queue-stub-value">{formatRestaurantTime(myEntry.joined_at)}</span>
            </div>
            <div>
              <span className="queue-stub-label">Party size</span>
              <span className="queue-stub-value">{myEntry.party_size} people</span>
            </div>
            <div>
              <span className="queue-stub-label">Group</span>
              <span className="queue-stub-value">{myGroup} · {getGroupRange(myGroup)}</span>
            </div>
          </div>

          {['queued', 'called'].includes(myEntry.status) && (
            <div className="queue-ticket-actions">
              {queueActionError && <p className="error-text" role="alert">{queueActionError}</p>}
              <button type="button" className="queue-leave-btn" onClick={handleLeave} disabled={isLeaving}>
                {isLeaving ? 'Leaving…' : 'Leave queue'}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}