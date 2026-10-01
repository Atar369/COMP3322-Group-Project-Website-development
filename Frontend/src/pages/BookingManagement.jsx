import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function BookingManagement() {
  const { user } = useAuth();
  const [userBookings, setUserBookings] = useState([]);
  const [error, setError] = useState('');

  function load() {
    if (!user) return;
    fetch(`/api/booking/user/${user.user_id}`)
      .then(r => r.json())
      .then(d => setUserBookings(Array.isArray(d) ? d.filter(b => b.status === 'confirmed') : []))
      .catch(() => setUserBookings([]));
  }

  useEffect(load, [user]);

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
      <h1>Booking Management</h1>
      {error && <p className="error-text">{error}</p>}
      {userBookings.length === 0 ? (
        <p>No active bookings. <Link to="/booking">Create a new booking</Link></p>
      ) : (
        userBookings.map(b => (
          <div className="ticket-row" key={b.booking_id}>
            <span className="name">Booking #{b.booking_id}</span>
            <span className="leader" />
            <span className="price">{b.booking_date} {b.booking_time}</span>
            <span className="desc">Party of {b.party_size}</span>
            <button
              type="button"
              className="btn secondary"
              style={{ padding: '4px 12px', fontSize: '0.8rem', marginLeft: 12 }}
              onClick={() => handleCancel(b.booking_id)}
            >
              Cancel
            </button>
          </div>
        ))
      )}
    </div>
  );
}