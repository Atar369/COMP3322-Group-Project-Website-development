import { useState, useMemo, useEffect } from 'react';
// import { restaurant_tables, createBooking, getAvailableTablesFor } from '../data/mockData';
import { useAuth } from '../context/AuthContext';

export default function Booking() {
  const { user } = useAuth();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('19:00');
  const [partySize, setPartySize] = useState(2);
  const [tableId, setTableId] = useState(null);
  const [noPreference, setNoPreference] = useState(false);
  const [request, setRequest] = useState('');
  const [result, setResult] = useState(null);
  const [allTables, setAllTables] = useState([]);
  const [availableTables, setAvailableTables] = useState([]);
  const [refresh, setRefresh] = useState(0);
  

  useEffect(() => {
    fetch('/api/booking/tables')
      .then(r => r.json())
      .then(d => setAllTables(Array.isArray(d) ? d : []))
      .catch(() => setAllTables([]));
  }, []);

  useEffect(() => {
    if (!date || !time || !partySize) { setAvailableTables([]); return; }
    let stale = false;
    fetch(`/api/booking/availability?date=${date}&time=${time}&party_size=${partySize}`)
      .then(r => r.json())
      .then(d => { if (!stale) setAvailableTables(Array.isArray(d) ? d : []); })
      .catch(() => { if (!stale) setAvailableTables([]); });
    return () => { stale = true; };
  }, [date, time, partySize, refresh]);

//  const availableTables = useMemo(
//    () => date && time && partySize ? getAvailableTablesFor(date, time, partySize) : [],
//    [date, time, partySize]
//  );

  // When no preference is checked, auto-assign the first available table
  const effectiveTableId = noPreference && availableTables.length > 0 ? availableTables[0].table_id : tableId;

  // Clear selected table when party size changes and it no longer fits
  function handlePartySizeChange(val) {
    setPartySize(val);
    setTableId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!date || !time) { setResult({ error: 'Select date and time first.' }); return; }
    if (!effectiveTableId) { setResult({ error: noPreference ? 'No available tables for this slot.' : 'Select a table first.' }); return; }

    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.user_id,
          table_id: effectiveTableId,
          booking_date: date,
          booking_time: time,
          party_size: partySize,
          special_request: request,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ bookingId: data.bookingId });
        setTableId(null);
        setRefresh(n => n + 1);
      } else {
        setResult({ error: data.error || 'Booking failed.' });
      }
    } catch {
      setResult({ error: 'Could not reach the server.' });
    }
  }

  const displayTables = useMemo(
    () => allTables.slice().sort((a, b) => a.table_number - b.table_number),
    [allTables]
  );

  const todayStr = new Date().toISOString().slice(0, 10); // "2026-09-30"

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <h1>Book a table</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 4 }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Date</label>
            <input type="date" min={todayStr} value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Time</label>
            {/*<input type="time" value={time} onChange={e => setTime(e.target.value)} required /> */}
            <select value={time} onChange={e => setTime(e.target.value)} required>
              {[
                '10:00', '10:30', '11:00', '11:30',
                '12:00', '12:30', '13:00', '13:30',
                '14:00', '14:30', '15:00', '15:30',
                '16:00', '16:30', '17:00', '17:30',
                '18:00', '18:30', '19:00', '19:30',
                '20:00', '20:30', '21:00', '21:30',
                '22:00',
              ].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Party size</label>
            <input type="number" min={1} max={12} value={partySize} onChange={e => handlePartySizeChange(Number(e.target.value))} />
          </div>
        </div>

        <div style={{ marginTop: 24, marginBottom: 20 }}>
          <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>Restaurant Floor Plan — Tables scaled to size</p>
          <div style={{ display: 'flex', gap: 16, fontSize: '0.78rem', color: '#6b6558', marginBottom: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 12, background: 'var(--green)', display: 'inline-block', borderRadius: 2 }} /> Available for your party size</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 12, background: '#ddd', display: 'inline-block', borderRadius: 2 }} /> Not a match / booked</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {displayTables.map(t => {
              const isAvailable = !!availableTables.find(at => at.table_id === t.table_id);
              const isSelected = effectiveTableId === t.table_id;
              const isTooSmall = t.capacity < partySize;
              const isTooBig = t.capacity > partySize * 2;
              const isOutOfRange = isTooSmall || isTooBig;
              const isBookedSlot = !isOutOfRange && date && time && !isAvailable;
              const selectable = isAvailable && !noPreference;

              return (
                <div
                  key={t.table_id}
                  onClick={() => selectable && setTableId(t.table_id)}
                  style={{
                    border: `2px solid ${isSelected ? 'var(--green-dim)' : isAvailable ? 'var(--green)' : 'var(--line)'}`,
                    borderRadius: 8,
                    padding: '12px 8px',
                    textAlign: 'center',
                    cursor: selectable ? 'pointer' : 'default',
                    background: isSelected ? 'var(--paper-dim)' : isAvailable ? 'white' : '#f5f5f5',
                    opacity: isAvailable ? 1 : 0.5,
                  }}
                >
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2em', fontWeight: 700 }}>#{t.table_number}</div>
                  <div style={{ color: '#6b6558', marginBottom: 6 }}>{t.capacity} guests</div>
                  {date && time && (
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, marginBottom: 6, color: isOutOfRange ? '#9a9484' : isBookedSlot ? 'var(--rust)' : 'var(--green)' }}>
                      {isTooSmall ? 'Too small' : isTooBig ? 'Too large' : isBookedSlot ? 'Booked' : 'Available'}
                    </div>
                  )}
                  {selectable && (
                    <button
                      type="button"
                      className={isSelected ? 'btn' : 'btn secondary'}
                      style={{ padding: '3px 10px', fontSize: '0.75rem', width: '100%' }}
                      onClick={e => { e.stopPropagation(); setTableId(t.table_id); }}
                    >
                      {isSelected ? '✓ Selected' : 'Book'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
            <input
              type="checkbox"
              id="no-pref"
              checked={noPreference}
              onChange={e => { setNoPreference(e.target.checked); if (e.target.checked) setTableId(null); }}
            />
            <label htmlFor="no-pref" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
              No preference — auto-assign an available table for my party size
            </label>
          </div>
        </div>

        <div className="field">
          <label>Special request (optional)</label>
          <textarea value={request} onChange={e => setRequest(e.target.value)} rows={2} />
        </div>

        {result?.error && <p className="error-text">{result.error}</p>}
        {result?.bookingId && <p style={{ color: 'var(--green)', fontWeight: 600 }}>Booking confirmed — #{result.bookingId}</p>}

        <button className="btn" type="submit">Confirm booking</button>
      </form>
    </div>
  );
}
