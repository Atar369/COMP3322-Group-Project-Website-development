import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const categories = ['Starters', 'Mains', 'Desserts', 'Main', 'Side', 'Dessert'];

export default function Menu() {
  const { user } = useAuth();
  const { addItem, items, setOrderContext } = useCart();

  const [menuItems, setMenuItems] = useState([]);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [unlockError, setUnlockError] = useState('');
  const [category, setCategory] = useState('All');
  const [bookingIdInput, setBookingIdInput] = useState('');
  const [queueIdInput, setQueueIdInput] = useState('');

  useEffect(() => {
    fetch('/api/booking/menu')
      .then(r => r.json())
      .then(d => setMenuItems(Array.isArray(d) ? d : []))
      .catch(() => setMenuItems([]));
  }, []);

  async function checkBooking(val) {
    setBookingIdInput(val);
    setQueueIdInput('');
    setUnlockError('');
    setSessionInfo(null);
    setOrderContext(null);
    if (!val) return;
    try {
      const res = await fetch(`/api/booking/user/${user.user_id}`);
      const bookings = await res.json();
      const booking = Array.isArray(bookings) ? bookings.find(b => b.booking_id === Number(val)) : null;
      if (!booking || booking.status === 'cancelled') {
        setUnlockError('Please enter a valid booking ID that belongs to you.');
        return;
      }
      if (booking.status !== 'serving') {
        setUnlockError('Your booking must be checked in (serving) by the manager before you can order.');
        return;
      }
      setSessionInfo({ type: 'booking', bookingId: booking.booking_id, partySize: booking.party_size, date: booking.booking_date?.slice(0, 10), time: booking.booking_time?.slice(0, 5) });
      setOrderContext({ type: 'booking', bookingId: booking.booking_id, queueId: null });
    } catch {
      setUnlockError('Could not verify booking. Please try again.');
    }
  }

  async function checkQueue(val) {
    setQueueIdInput(val);
    setBookingIdInput('');
    setUnlockError('');
    setSessionInfo(null);
    setOrderContext(null);
    if (!val) return;
    try {
      const res = await api.get(`/queue/user/${user.user_id}`);
      const entries = Array.isArray(res.data) ? res.data : [];
      const entry = entries.find(q => q.queue_id === Number(val));
      if (!entry) {
        setUnlockError('Please enter a valid queue ID that belongs to you.');
        return;
      }
      if (entry.status !== 'serving') {
        setUnlockError('Your queue number must be called and seated by the manager before you can order.');
        return;
      }
      setSessionInfo({ type: 'queue', queueId: entry.queue_id, partySize: entry.party_size, date: entry.joined_at?.slice(0, 10), time: entry.joined_at?.slice(11, 16) });
      setOrderContext({ type: 'queue', bookingId: null, queueId: entry.queue_id });
    } catch {
      setUnlockError('Could not verify queue entry. Please try again.');
    }
  }

  const allCategories = useMemo(() => {
    const cats = [...new Set(menuItems.map(i => i.category))];
    return ['All', ...cats];
  }, [menuItems]);

  const filtered = useMemo(
    () => menuItems.filter(i => (i.is_available || i.is_available === 1) && (category === 'All' || i.category === category)),
    [menuItems, category]
  );

  const cartCount = items.reduce((n, i) => n + i.qty, 0);

  return (
    <div className="page">
      <h1>New Order</h1>

      {!sessionInfo && (
        <div className="card" style={{ marginBottom: 20, background: 'var(--paper-dim)', borderColor: 'var(--mustard)' }}>
          <h3 style={{ marginBottom: 8 }}>🔒 Order Access Required</h3>
          <p style={{ color: '#6b6558', fontSize: '0.88rem', marginBottom: 12 }}>
            To place an order, you must have an <strong>arrived booking</strong> or a <strong>called queue number</strong>.
            Please enter your booking ID or queue ID below to unlock ordering.
          </p>
          <p style={{ color: '#6b6558', fontSize: '0.82rem' }}>
            Don't have either? <Link to="/booking" style={{ color: 'var(--green)' }}>Make a reservation</Link> or <Link to="/queue" style={{ color: 'var(--green)' }}>join the queue</Link> first.
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Booking ID</label>
          <input
            placeholder="Enter Booking ID"
            value={bookingIdInput}
            onChange={e => checkBooking(e.target.value)}
          />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Queue ID</label>
          <input
            placeholder="Enter Queue ID"
            value={queueIdInput}
            onChange={e => checkQueue(e.target.value)}
          />
        </div>
      </div>
      <p style={{ color: '#6b6558', fontSize: '0.82rem', marginBottom: 16 }}>Enter only one — the other will be cleared</p>

      {unlockError && (
        <div className="card" style={{ borderColor: 'var(--rust)', marginBottom: 16 }}>
          <p style={{ color: 'var(--rust)', margin: 0, fontSize: '0.88rem' }}>{unlockError}</p>
        </div>
      )}

      {sessionInfo && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'var(--green)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: '1.2rem' }}>✓</span>
            <strong>Order unlocked</strong>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Type</span><div>{sessionInfo.type === 'booking' ? 'Booking' : 'Queue'}</div></div>
            <div><span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Date</span><div>{sessionInfo.date}</div></div>
            <div><span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Party Size</span><div>{sessionInfo.partySize} people</div></div>
            <div><span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Time</span><div>{sessionInfo.time}</div></div>
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', padding: '8px 0', marginBottom: 20, color: '#6b6558', fontSize: '0.85rem', letterSpacing: '2px' }}>
        ◆ MENU{!sessionInfo ? ' (VIEW ONLY — unlock to order)' : ''} ◆
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {allCategories.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={c === category ? 'btn' : 'btn secondary'}
            style={{ padding: '5px 12px', fontSize: '0.8rem' }}
          >
            {c}
          </button>
        ))}
      </div>

      {filtered.map(item => (
        <div className="ticket-row" key={item.item_id}>
          <span className="name">{item.name}</span>
          <span className="leader" />
          <span className="price">${Number(item.price).toFixed(0)}</span>
          {(item.is_available || item.is_available === 1) ? (
            <button
              className="btn"
              style={{ padding: '4px 12px', fontSize: '0.85rem' }}
              onClick={() => addItem(item)}
              disabled={!sessionInfo}
              title={!sessionInfo ? 'Unlock ordering with a Booking ID or Queue ID first' : ''}
            >
              +
            </button>
          ) : (
            <span className="badge cancelled">Sold out</span>
          )}
          <span className="desc">{item.description}</span>
        </div>
      ))}

      {cartCount > 0 && (
        <p style={{ marginTop: 24 }}>
          {cartCount} item(s) in your cart —{' '}
          <Link to="/cart" style={{ color: 'var(--green)', fontWeight: 600 }}>review order</Link>
        </p>
      )}
    </div>
  );
}
