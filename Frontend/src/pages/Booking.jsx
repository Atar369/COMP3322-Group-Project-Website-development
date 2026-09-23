import { useState } from 'react';
import { restaurant_tables, createBooking } from '../data/mockData';
import { useAuth } from '../context/AuthContext';

export default function Booking() {
  const { user } = useAuth();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('19:00');
  const [partySize, setPartySize] = useState(2);
  const [tableId, setTableId] = useState(null);
  const [request, setRequest] = useState('');
  const [result, setResult] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    if (!tableId) { setResult({ error: 'Select a table first.' }); return; }
    const res = createBooking(user.user_id, tableId, date, time, partySize, request);
    setResult(res);
  }

  return (
    <div className="page">
      <h1>Book a table</h1>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
        </div>
        <div className="field">
          <label>Time</label>
          <input type="time" value={time} onChange={e => setTime(e.target.value)} required />
        </div>
        <div className="field">
          <label>Party size</label>
          <input type="number" min={1} max={12} value={partySize} onChange={e => setPartySize(Number(e.target.value))} />
        </div>

        <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Table</label>
        <div className="table-grid">
          {restaurant_tables.map(t => (
            <div
              key={t.table_id}
              className={`table-slot ${t.status === 'booked' ? 'taken' : ''} ${tableId === t.table_id ? 'selected' : ''}`}
              onClick={() => t.status !== 'booked' && setTableId(t.table_id)}
            >
              #{t.table_number}<br />seats {t.capacity}
            </div>
          ))}
        </div>

        <div className="field">
          <label>Special request (optional)</label>
          <textarea value={request} onChange={e => setRequest(e.target.value)} rows={2} />
        </div>

        {result?.error && <p className="error-text">{result.error}</p>}
        {result?.booking_id && <p style={{ color: 'var(--green)', fontWeight: 600 }}>Booking confirmed — #{result.booking_id}</p>}

        <button className="btn" type="submit">Confirm booking</button>
      </form>
    </div>
  );
}
