import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../services/api';

const ALL_STATUSES = ['all', 'reserved', 'serving', 'finished', 'paid', 'cancelled', 'no_show'];
const BADGE = { reserved: 'preparing', serving: 'ready', finished: 'ready', paid: 'completed', cancelled: 'cancelled', no_show: 'pending' };
const STATUS_LABEL = { reserved: 'Reserved', serving: 'Serving', finished: 'Finished', paid: 'Paid', cancelled: 'Cancelled', no_show: 'No Show' };
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export default function ManagerBookings() {
  const [bookings, setBookings] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState('');
  const [notifications, setNotifications] = useState([]);

  const load = useCallback(() => {
    api.get('/booking/all')
      .then(r => setBookings(Array.isArray(r.data) ? r.data : []))
      .catch(() => setBookings([]));
  }, []);

  useEffect(load, [load]);

  // 2-hour auto-finish for serving bookings
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      bookings.forEach(b => {
        if (b.status === 'serving' && b.served_at) {
          if (now - new Date(b.served_at).getTime() >= TWO_HOURS_MS) {
            api.patch(`/booking/${b.booking_id}/finish`).then(() => {
              setNotifications(prev => {
                if (prev.find(n => n.id === b.booking_id)) return prev;
                return [...prev, { id: b.booking_id, msg: `⏰ Booking #${b.booking_id} (Table #${b.table_number}) — 2 hours elapsed. Please collect payment.`, time: new Date().toLocaleTimeString() }];
              });
              load();
            }).catch(() => {});
          }
        }
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [bookings, load]);

  const filtered = useMemo(() => bookings.filter(b => {
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    const term = search.trim().toLowerCase();
    const matchesSearch = term === '' ||
      String(b.booking_id).includes(term) ||
      (b.booking_date && b.booking_date.includes(term)) ||
      (b.booking_time && b.booking_time.includes(term));
    return matchesStatus && matchesSearch;
  }), [bookings, search, statusFilter]);

  async function handleCancel(bookingId) {
    setError('');
    try {
      await api.patch(`/booking/${bookingId}/cancel`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not cancel booking.');
    }
  }

  async function handleMarkServing(bookingId) {
    setError('');
    try {
      await api.patch(`/booking/${bookingId}/arrive`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update status.');
    }
  }

  async function handleMarkPaid(bookingId) {
    setError('');
    try {
      await api.patch(`/booking/${bookingId}/pay`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update status.');
    }
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

  return (
    <div className="page">
      <h1>Bookings</h1>
      <p style={{ color: '#6b6558', fontSize: '0.85rem', marginBottom: 12 }}>
        Check in arrivals to start the 2-hour dining timer. When finished, collect payment.
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

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Search by ID, date or time" value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: '8px 10px', border: '1px solid var(--line)', fontFamily: 'var(--font-body)', fontSize: '0.9rem', width: 220 }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ALL_STATUSES.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={statusFilter === s ? 'btn' : 'btn secondary'}
              style={{ padding: '5px 12px', fontSize: '0.8rem' }}>{s === 'all' ? 'All' : STATUS_LABEL[s] || s}</button>
          ))}
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {filtered.length === 0 && <p style={{ color: '#6b6558' }}>No bookings match your filter.</p>}

      {filtered.map(b => {
        const tr = getTimeRemaining(b.served_at);
        return (
          <div className="ticket-row" key={b.booking_id} style={{ flexWrap: 'wrap', rowGap: 6 }}>
            <span className="name">#{b.booking_id} · {b.booking_date?.slice(0,10)} · {b.booking_time?.slice(0,5)}</span>
            <span className="leader" />
            <span className={`badge ${BADGE[b.status] || 'pending'}`}>{STATUS_LABEL[b.status] || b.status}</span>
            {b.status === 'serving' && tr && (
              <span style={{ fontSize: '0.8rem', color: tr === 'Time up' ? 'var(--rust)' : 'var(--green)', fontWeight: 600, marginLeft: 8 }}>⏱ {tr}</span>
            )}
            <span className="desc" style={{ flexBasis: '100%' }}>
              Table #{b.table_number}, party of {b.party_size}{b.special_request ? ` — "${b.special_request}"` : ''}
            </span>
            {b.status === 'reserved' && (
              <>
                <button className="btn" style={{ padding: '4px 12px', fontSize: '0.8rem', background: 'var(--mustard)' }} onClick={() => handleMarkServing(b.booking_id)}>✓ Check In (Serving)</button>
                <button className="btn secondary" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => handleCancel(b.booking_id)}>Cancel</button>
              </>
            )}
            {b.status === 'finished' && (
              <button className="btn" style={{ padding: '4px 12px', fontSize: '0.8rem', background: 'var(--mustard)' }} onClick={() => handleMarkPaid(b.booking_id)}>Mark as Paid</button>
            )}
          </div>
        );
      })}
    </div>
  );
}
