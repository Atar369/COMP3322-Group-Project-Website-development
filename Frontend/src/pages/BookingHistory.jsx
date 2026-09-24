import { bookings } from '../data/mockData';
import { useAuth } from '../context/AuthContext';

export default function BookingHistory() {
  const { user } = useAuth();
  const userBookings = bookings.filter(b => b.user_id === user.user_id);

  return (
    <div className="page">
      <h1>Booking History</h1>
      {userBookings.length === 0 ? (
        <p>No bookings yet.</p>
      ) : (
        userBookings.map(b => (
          <div className="ticket-row" key={b.booking_id}>
            <span className="name">Booking #{b.booking_id}</span>
            <span className="leader" />
            <span className={`badge ${b.status}`}>{b.status}</span>
            <span className="desc">{b.booking_date} {b.booking_time} — Party of {b.party_size}</span>
          </div>
        ))
      )}
    </div>
  );
}
