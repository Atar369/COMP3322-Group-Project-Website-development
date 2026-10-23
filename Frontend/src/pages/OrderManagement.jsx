import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import api from '../services/api';

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function TimeLeft({ servedAt }) {
  const now = useNow();
  if (!servedAt) return null;
  const remaining = TWO_HOURS_MS - (now - new Date(servedAt).getTime());
  if (remaining <= 0) return <span style={{ fontSize: '0.78rem', color: 'var(--rust)', fontWeight: 600 }}>⏱ Time up</span>;
  const mins = Math.floor(remaining / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const label = h > 0 ? `${h}h ${m}m left` : `${m}m left`;
  return <span style={{ fontSize: '0.78rem', color: h === 0 && m <= 15 ? 'var(--rust)' : 'var(--green)', fontWeight: 600 }}>⏱ {label}</span>;
}

export default function OrderManagement() {
  const { user } = useAuth();
  const { items, setOrderContext } = useCart();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [queues, setQueues] = useState([]);

  const load = useCallback(() => {
    if (!user) return;
    fetch(`/api/booking/user/${user.user_id}`)
      .then(r => r.json())
      .then(d => setBookings(Array.isArray(d) ? d.filter(b => !['cancelled', 'no_show', 'paid'].includes(b.status)) : []))
      .catch(() => setBookings([]));
    api.get(`/queue/user/${user.user_id}`)
      .then(r => setQueues(Array.isArray(r.data) ? r.data.filter(q => !['cancelled', 'paid'].includes(q.status)) : []))
      .catch(() => setQueues([]));
  }, [user]);

  useEffect(load, [load]);

  function handleOrder(type, id) {
    if (type === 'booking') setOrderContext({ type: 'booking', bookingId: id, queueId: null });
    else setOrderContext({ type: 'queue', bookingId: null, queueId: id });
    navigate('/menu');
  }

  async function handleRequestPayment(type, id) {
    try {
      if (type === 'booking') await api.patch(`/booking/${id}/finish`);
      else await api.patch(`/queue/${id}/finish`);
      load();
    } catch { /* ignore */ }
  }

  const cartCount = items.reduce((n, i) => n + i.qty, 0);

  function servingButtons(type, id, servedAt) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="order-btn serving"
            style={{ cursor: 'pointer', minWidth: 80 }}
            onClick={() => handleOrder(type, id)}
          >
            Order →
          </button>
          <button
            className="btn secondary"
            style={{ padding: '5px 10px', fontSize: '0.8rem', position: 'relative' }}
            onClick={() => navigate('/cart')}
            title="View cart"
          >
            🛒{cartCount > 0 && <span style={{ position: 'absolute', top: -4, right: -4, background: 'var(--rust)', color: 'white', borderRadius: '50%', width: 16, height: 16, fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{cartCount}</span>}
          </button>
        </div>
        <TimeLeft servedAt={servedAt} />
        <button
          className="btn"
          style={{ padding: '4px 10px', fontSize: '0.78rem', background: 'var(--mustard)', color: 'var(--ink)' }}
          onClick={() => handleRequestPayment(type, id)}
        >
          Request Payment
        </button>
      </div>
    );
  }

  function bookingButton(b) {
    if (b.status === 'reserved') return <span className="order-btn disabled">Awaiting Arrival</span>;
    if (b.status === 'serving') return servingButtons('booking', b.booking_id, b.served_at);
    if (b.status === 'finished') return <span className="order-btn disabled">Finished</span>;
    return <span className="order-btn disabled">{b.status}</span>;
  }

  function queueButton(q) {
    if (q.status === 'queued' || q.status === 'called') return <span className="order-btn disabled">In Queue</span>;
    if (q.status === 'serving') return servingButtons('queue', q.queue_id, q.served_at);
    if (q.status === 'finished') return <span className="order-btn disabled">Finished</span>;
    return <span className="order-btn disabled">{q.status}</span>;
  }

  const hasAnything = bookings.length > 0 || queues.length > 0;

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <h1>Order</h1>
      <p style={{ color: '#6b6558', fontSize: '0.88rem', marginBottom: 20 }}>
        Your active reservations and queue entries. <strong>Order →</strong> unlocks when you're checked in. Click <strong>Request Payment</strong> when you're ready to pay.
      </p>

      {!hasAnything && (
        <p>No active reservations or queue entries. <a href="/booking" style={{ color: 'var(--green)' }}>Book a table</a> or <a href="/queue" style={{ color: 'var(--green)' }}>join the queue</a>.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {bookings.map(b => (
          <div key={`b-${b.booking_id}`} className="order-card">
            <div className="order-card-left">
              <div style={{ fontSize: '1.5rem' }}>📋</div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.05rem' }}>
                  Booking #{b.booking_id}
                </div>
                <div style={{ color: '#6b6558', fontSize: '0.85rem', marginTop: 2 }}>
                  {b.booking_date?.slice(0, 10)} {b.booking_time?.slice(0, 5)} · Party of {b.party_size}
                </div>
                {b.special_request && <div style={{ color: '#6b6558', fontSize: '0.82rem', fontStyle: 'italic' }}>"{b.special_request}"</div>}
              </div>
            </div>
            <div className="order-card-right">
              {bookingButton(b)}
            </div>
          </div>
        ))}

        {queues.map(q => (
          <div key={`q-${q.queue_id}`} className="order-card">
            <div className="order-card-left">
              <div style={{ fontSize: '1.5rem' }}>🔢</div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.05rem' }}>
                  Queue #{q.queue_id}
                </div>
                <div style={{ color: '#6b6558', fontSize: '0.85rem', marginTop: 2 }}>
                  Joined {q.joined_at?.slice(11, 16)} · Party of {q.party_size}
                </div>
              </div>
            </div>
            <div className="order-card-right">
              {queueButton(q)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
