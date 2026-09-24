import { Link } from 'react-router-dom';
import { bookings } from '../data/mockData';
import { useAuth } from '../context/AuthContext';

export default function BookingManagement() {
  const { user } = useAuth();
  const userBookings = bookings.filter(b => b.user_id === user.user_id && b.status === 'confirmed');

  return (
    <div className="page">
      <h1>Booking Management</h1>
      {userBookings.length === 0 ? (
        <p>No active bookings. <Link to="/booking">Create a new booking</Link></p>
      ) : (
        userBookings.map(b => (
          <div className="ticket-row" key={b.booking_id}>
            <span className="name">Booking #{b.booking_id}</span>
            <span className="leader" />
            <span className="price">{b.booking_date} {b.booking_time}</span>
            <span className="desc">Party of {b.party_size}</span>
          </div>
        ))
      )}
    </div>
  );
}
