import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { menu_items, bookings, getBooking, getQueue, getTable, isQueueCalled } from '../data/mockData';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

const categories = ['Starters', 'Mains', 'Desserts'];

export default function Menu() {
  const { user } = useAuth();
  const { addItem, items, setOrderContext } = useCart();

  const [bookingIdInput, setBookingIdInput] = useState('');
  const [queueIdInput, setQueueIdInput] = useState('');
  const [sessionInfo, setSessionInfo] = useState(null); // { type, bookingId, queueId, table, partySize, date, time, canOrder }
  const [idError, setIdError] = useState('');
  const [category, setCategory] = useState('All');

  function handleBookingIdChange(val) {
    setBookingIdInput(val);
    setQueueIdInput('');
    setIdError('');
    setSessionInfo(null);
    setOrderContext(null);
    if (!val) return;
    const booking = getBooking(val);
    if (!booking || booking.user_id !== user.user_id || booking.status === 'cancelled') {
      setIdError('Please enter a valid booking ID.');
      return;
    }
    const table = getTable(booking.table_id);
    setSessionInfo({
      type: 'booking',
      bookingId: booking.booking_id,
      queueId: null,
      table: table ? `Table ${table.table_number} (seats ${table.capacity})` : '—',
      partySize: booking.party_size,
      date: booking.booking_date,
      time: booking.booking_time,
      canOrder: () => {
        const now = new Date();
        const bookingDT = new Date(`${booking.booking_date}T${booking.booking_time}`);
        return now >= bookingDT;
      },
    });
    setOrderContext({ type: 'booking', bookingId: booking.booking_id, queueId: null });
  }

  function handleQueueIdChange(val) {
    setQueueIdInput(val.toUpperCase());
    setBookingIdInput('');
    setIdError('');
    setSessionInfo(null);
    setOrderContext(null);
    if (!val) return;
    const entry = getQueue(val.toUpperCase());
    if (!entry || entry.user_id !== user.user_id) {
      setIdError('Please enter a valid queue ID.');
      return;
    }
    const called = isQueueCalled(entry.queue_id);
    const table = called ? (entry.table_id ? getTable(entry.table_id) : null) : null;
    setSessionInfo({
      type: 'queue',
      bookingId: null,
      queueId: entry.queue_id,
      table: table ? `Table ${table.table_number} (seats ${table.capacity})` : called ? 'Allocated' : 'Pending',
      partySize: entry.party_size,
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      canOrder: () => isQueueCalled(entry.queue_id),
    });
    setOrderContext({ type: 'queue', bookingId: null, queueId: entry.queue_id });
  }

  const filtered = useMemo(
    () => menu_items.filter(i => category === 'All' || i.category === category),
    [category]
  );

  const cartCount = items.reduce((n, i) => n + i.qty, 0);

  return (
    <div className="page">
      <h1>New Order</h1>

      <div className="card" style={{ marginBottom: 20, background: 'var(--paper-dim)', borderColor: 'var(--mustard)' }}>
        <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: '0.88rem' }}>Demo instructions</p>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.85rem', color: '#6b6558', lineHeight: 1.7 }}>
          <li>Enter <strong>Booking ID 1</strong> to load Alice's confirmed booking (booking time in the past, so Place Order will be unlocked immediately).</li>
          <li>Enter <strong>Queue ID A015</strong> to load Alice's called queue entry (already called, so Place Order is unlocked).</li>
          <li>Enter any other ID to see the "invalid ID" error and the menu Add buttons will remain disabled.</li>
          <li>Leave both fields empty — the menu is visible for browsing but no items can be added.</li>
        </ul>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Booking ID</label>
          <input
            placeholder="Enter Booking ID"
            value={bookingIdInput}
            onChange={e => handleBookingIdChange(e.target.value)}
          />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Queue ID</label>
          <input
            placeholder="Enter Queue ID"
            value={queueIdInput}
            onChange={e => handleQueueIdChange(e.target.value)}
          />
        </div>
      </div>
      <p style={{ color: '#6b6558', fontSize: '0.82rem', marginBottom: 16 }}>Enter only one — the other will be cleared</p>

      {idError && (
        <div className="card" style={{ borderColor: 'var(--rust)', marginBottom: 16 }}>
          <p style={{ color: 'var(--rust)', margin: 0 }}>{idError}</p>
        </div>
      )}

      {sessionInfo && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'var(--green)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Date</span><div>{sessionInfo.date}</div></div>
            <div><span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Time</span><div>{sessionInfo.time}</div></div>
            <div><span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Party Size</span><div>{sessionInfo.partySize} people</div></div>
            <div><span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Table</span><div>{sessionInfo.table}</div></div>
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', padding: '8px 0', marginBottom: 20, color: '#6b6558', fontSize: '0.85rem', letterSpacing: '2px' }}>
        ◆ MENU{!sessionInfo ? ' (VIEW ONLY)' : ''} ◆
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {['All', ...categories].map(c => (
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
          <span className="price">${item.price}</span>
          {item.is_available ? (
            <button
              className="btn"
              style={{ padding: '4px 12px', fontSize: '0.85rem' }}
              onClick={() => addItem(item)}
              disabled={!sessionInfo}
              title={!sessionInfo ? 'Enter a Booking ID or Queue ID first' : ''}
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
