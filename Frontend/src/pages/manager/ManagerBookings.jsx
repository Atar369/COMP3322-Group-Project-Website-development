import { useState, useMemo } from 'react';
import { bookings, restaurant_tables } from '../../data/mockData';

const ALL_STATUSES = ['all', 'confirmed', 'completed', 'cancelled', 'no_show'];

const BADGE = { confirmed: 'preparing', completed: 'completed', cancelled: 'cancelled', no_show: 'pending' };

export default function ManagerBookings() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = useMemo(() => bookings.filter(b => {
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    const term = search.trim().toLowerCase();
    const matchesSearch = term === '' ||
      String(b.booking_id).includes(term) ||
      b.booking_date.includes(term) ||
      b.booking_time.includes(term);
    return matchesStatus && matchesSearch;
  }), [search, statusFilter]);

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

      {filtered.length === 0 && (
        <p style={{ color: '#6b6558' }}>No bookings match your filter.</p>
      )}

      {filtered.map(b => {
        const table = restaurant_tables.find(t => t.table_id === b.table_id);
        return (
          <div className="ticket-row" key={b.booking_id}>
            <span className="name">#{b.booking_id} · {b.booking_date} · {b.booking_time}</span>
            <span className="leader" />
            <span className={`badge ${BADGE[b.status] || 'pending'}`}>{b.status.replace('_', ' ')}</span>
            <span className="desc">Table #{table?.table_number}, party of {b.party_size}{b.special_request ? ` — "${b.special_request}"` : ''}</span>
          </div>
        );
      })}
    </div>
  );
}
