// import { bookings, restaurant_tables } from '../../data/mockData';
import { useState, useEffect, useMemo } from 'react';

const ALL_STATUSES = ['all', 'confirmed', 'completed', 'cancelled', 'no_show'];
const BADGE = { confirmed: 'preparing', completed: 'completed', cancelled: 'cancelled', no_show: 'pending' };

export default function ManagerBookings() {
  const [bookings, setBookings] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState('');

  function load() {
    fetch('/api/booking/all')
      .then(r => r.json())
      .then(d => setBookings(Array.isArray(d) ? d : []))
      .catch(() => setBookings([]));
  }

  useEffect(load, []);

  const filtered = useMemo(() => bookings.filter(b => {
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    const term = search.trim().toLowerCase();
    const matchesSearch = term === '' ||
      String(b.booking_id).includes(term) ||
      b.booking_date.includes(term) ||
      b.booking_time.includes(term);
    return matchesStatus && matchesSearch;
  }), [bookings, search, statusFilter]);

  async function handleCancel(bookingId) {
    setError('');
    try {
      const res = await fetch(`/api/booking/${bookingId}/cancel`, { method: 'PATCH' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Could not cancel booking.'); return; }
      load();
    } catch {
      setError('Could not reach the server.');
    }
  }

  return (
    <div className="page">
      <h1>Bookings</h1>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="Search by ID, date or time"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '8px 10px', border: '1px solid var(--line)', fontFamily: 'var(--font-body)', fontSize: '0.9rem', width: 220 }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {ALL_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={statusFilter === s ? 'btn' : 'btn secondary'}
              style={{ padding: '5px 12px', fontSize: '0.8rem', textTransform: 'capitalize' }}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {filtered.length === 0 && (
        <p style={{ color: '#6b6558' }}>No bookings match your filter.</p>
      )}

      {filtered.map(b => (
        <div className="ticket-row" key={b.booking_id}>
          <span className="name">#{b.booking_id} · {b.booking_date} · {b.booking_time}</span>
          <span className="leader" />
          <span className={`badge ${BADGE[b.status] || 'pending'}`}>{b.status.replace('_', ' ')}</span>
          <span className="desc">Table #{b.table_number}, party of {b.party_size}{b.special_request ? ` — "${b.special_request}"` : ''}</span>
          {b.status === 'confirmed' && (
            <button
              type="button"
              className="btn secondary"
              style={{ padding: '4px 12px', fontSize: '0.8rem', marginLeft: 12 }}
              onClick={() => handleCancel(b.booking_id)}
            >
              Cancel
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
