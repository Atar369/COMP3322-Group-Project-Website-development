import { bookings, restaurant_tables } from '../../data/mockData';

export default function ManagerBookings() {
  return (
    <div className="page">
      <h1>Bookings</h1>
      {bookings.map(b => {
        const table = restaurant_tables.find(t => t.table_id === b.table_id);
        return (
          <div className="ticket-row" key={b.booking_id}>
            <span className="name">{b.booking_date} · {b.booking_time}</span>
            <span className="leader" />
            <span className="badge preparing">{b.status}</span>
            <span className="desc">Table #{table?.table_number}, party of {b.party_size}{b.special_request ? ` — "${b.special_request}"` : ''}</span>
          </div>
        );
      })}
    </div>
  );
}
