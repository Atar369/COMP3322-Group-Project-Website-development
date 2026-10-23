import { useState, useMemo, useEffect } from 'react';
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
  const [menuItems, setMenuItems] = useState([]);
  const [preOrder, setPreOrder] = useState([]);
  const [preOrderCategory, setPreOrderCategory] = useState('All');

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/booking/tables', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setAllTables(Array.isArray(d) ? d : []))
      .catch(() => setAllTables([]));
  }, []);

  useEffect(() => {
    fetch('/api/booking/menu')
      .then(r => r.json())
      .then(d => setMenuItems(Array.isArray(d) ? d : []))
      .catch(() => setMenuItems([]));
  }, []);

  useEffect(() => {
    if (!date || !time || !partySize) { setAvailableTables([]); return; }
    let stale = false;
    const token = localStorage.getItem('token');
    fetch(`/api/booking/availability?date=${date}&time=${time}&party_size=${partySize}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (!stale) setAvailableTables(Array.isArray(d) ? d : []); })
      .catch(() => { if (!stale) setAvailableTables([]); });
    return () => { stale = true; };
  }, [date, time, partySize, refresh]);

  const effectiveTableId = noPreference && availableTables.length > 0 ? availableTables[0].table_id : tableId;

  function handlePartySizeChange(val) {
    setPartySize(val);
    setTableId(null);
  }

  function addPreOrderItem(item) {
    setPreOrder(prev => {
      const existing = prev.find(i => i.item_id === item.item_id);
      if (existing) return prev.map(i => i.item_id === item.item_id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { item_id: item.item_id, name: item.name, price: Number(item.price), qty: 1 }];
    });
  }

  function removePreOrderItem(item_id) {
    setPreOrder(prev => prev.filter(i => i.item_id !== item_id));
  }

  function updatePreOrderQty(item_id, delta) {
    setPreOrder(prev => prev.map(i => {
      if (i.item_id !== item_id) return i;
      const newQty = i.qty + delta;
      return newQty <= 0 ? null : { ...i, qty: newQty };
    }).filter(Boolean));
  }

  const preOrderTotal = preOrder.reduce((sum, i) => sum + i.price * i.qty, 0);

  const menuCategories = useMemo(() => {
    const cats = [...new Set(menuItems.map(i => i.category))];
    return ['All', ...cats];
  }, [menuItems]);

  const filteredMenu = useMemo(
    () => menuItems.filter(i => i.is_available && (preOrderCategory === 'All' || i.category === preOrderCategory)),
    [menuItems, preOrderCategory]
  );

  async function handleSubmit(e) {
    e.preventDefault();
    if (!date || !time) { setResult({ error: 'Select date and time first.' }); return; }
    if (!effectiveTableId) { setResult({ error: noPreference ? 'No available tables for this slot.' : 'Select a table first.' }); return; }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          user_id: user.user_id,
          table_id: effectiveTableId,
          booking_date: date,
          booking_time: time,
          party_size: partySize,
          special_request: request,
          pre_order: preOrder.length > 0 ? preOrder : null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ bookingId: data.bookingId });
        setTableId(null);
        setPreOrder([]);
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

  const todayStr = new Date().toISOString().slice(0, 10);
  const tomorrowStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <h1>Book a table</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 4 }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Date</label>
            <input type="date" min={tomorrowStr} value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Time</label>
            <select value={time} onChange={e => setTime(e.target.value)} required>
              {['10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30','22:00'].map(t => (
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

        {/* Pre-order Course Selection */}
        <div style={{ marginTop: 24, marginBottom: 20, borderTop: '2px solid var(--mustard)', paddingTop: 20 }}>
          <h2 style={{ marginBottom: 4 }}>Pre-order Courses (Optional)</h2>
          <p style={{ color: '#6b6558', fontSize: '0.85rem', marginBottom: 16 }}>
            Select courses in advance so your meal is prepared when you arrive. You can also edit these later from Booking Management.
          </p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {menuCategories.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setPreOrderCategory(c)}
                className={c === preOrderCategory ? 'btn' : 'btn secondary'}
                style={{ padding: '5px 12px', fontSize: '0.8rem' }}
              >
                {c}
              </button>
            ))}
          </div>

          <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--line)', padding: 12, marginBottom: 16 }}>
            {filteredMenu.length === 0 ? (
              <p style={{ color: '#6b6558', fontSize: '0.85rem' }}>No available items in this category.</p>
            ) : filteredMenu.map(item => (
              <div className="ticket-row" key={item.item_id} style={{ padding: '10px 0' }}>
                <span className="name" style={{ fontSize: '0.95rem' }}>{item.name}</span>
                <span className="leader" />
                <span className="price">${Number(item.price).toFixed(0)}</span>
                <button
                  type="button"
                  className="btn"
                  style={{ padding: '3px 10px', fontSize: '0.8rem' }}
                  onClick={() => addPreOrderItem(item)}
                >
                  +
                </button>
              </div>
            ))}
          </div>

          {preOrder.length > 0 && (
            <div className="card" style={{ borderColor: 'var(--mustard)', marginBottom: 16 }}>
              <h3 style={{ marginBottom: 8 }}>Selected Courses</h3>
              {preOrder.map(item => (
                <div className="ticket-row" key={item.item_id} style={{ padding: '8px 0' }}>
                  <span className="name" style={{ fontSize: '0.95rem' }}>{item.name}</span>
                  <span className="leader" />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button type="button" className="qty-btn" onClick={() => updatePreOrderQty(item.item_id, -1)} style={{ border: '1px solid var(--ink)', background: 'transparent', borderRadius: '999px', width: 26, height: 26, cursor: 'pointer' }}>−</button>
                    <span style={{ fontWeight: 600, minWidth: 20, textAlign: 'center' }}>{item.qty}</span>
                    <button type="button" className="qty-btn" onClick={() => updatePreOrderQty(item.item_id, 1)} style={{ border: '1px solid var(--ink)', background: 'transparent', borderRadius: '999px', width: 26, height: 26, cursor: 'pointer' }}>+</button>
                  </div>
                  <span className="price">${item.price * item.qty}</span>
                  <button type="button" className="btn secondary" style={{ padding: '3px 8px', fontSize: '0.75rem' }} onClick={() => removePreOrderItem(item.item_id)}>Remove</button>
                </div>
              ))}
              <p style={{ marginTop: 12, fontWeight: 600 }}>Pre-order Total: ${preOrderTotal}</p>
            </div>
          )}
        </div>

        {result?.error && <p className="error-text">{result.error}</p>}
        {result?.bookingId && <p style={{ color: 'var(--green)', fontWeight: 600 }}>Booking confirmed — #{result.bookingId}</p>}

        <button className="btn" type="submit">Confirm booking</button>
      </form>
    </div>
  );
}
