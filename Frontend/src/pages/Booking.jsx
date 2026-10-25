import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Pagination, { usePagination } from '../components/Pagination';

export default function Booking() {
  const { user } = useAuth();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('18:00');
  const [partySize, setPartySize] = useState(2);
  const [request, setRequest] = useState('');
  const [result, setResult] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [preOrder, setPreOrder] = useState([]);
  const [preOrderCategory, setPreOrderCategory] = useState('All');

  useEffect(() => {
    fetch('/api/booking/menu').then(r => r.json()).then(d => setMenuItems(Array.isArray(d) ? d : [])).catch(() => setMenuItems([]));
  }, []);

  function addPreOrderItem(item) {
    setPreOrder(prev => {
      const existing = prev.find(i => i.item_id === item.item_id);
      if (existing) return prev.map(i => i.item_id === item.item_id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { item_id: item.item_id, name: item.name, price: Number(item.price), qty: 1 }];
    });
  }
  function removePreOrderItem(item_id) { setPreOrder(prev => prev.filter(i => i.item_id !== item_id)); }
  function updatePreOrderQty(item_id, delta) {
    setPreOrder(prev => prev.map(i => { if (i.item_id !== item_id) return i; const q = i.qty + delta; return q <= 0 ? null : { ...i, qty: q }; }).filter(Boolean));
  }

  const preOrderTotal = preOrder.reduce((s, i) => s + i.price * i.qty, 0);
  const menuCategories = useMemo(() => ['All', ...[...new Set(menuItems.map(i => i.category))]], [menuItems]);
  const filteredMenu = useMemo(() => menuItems.filter(i => i.is_available && (preOrderCategory === 'All' || i.category === preOrderCategory)), [menuItems, preOrderCategory]);
  const preOrderPagination = usePagination(filteredMenu, preOrderCategory);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!date || !time) { setResult({ error: 'Select date and time first.' }); return; }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ user_id: user.user_id, booking_date: date, booking_time: time, party_size: partySize, special_request: request, pre_order: preOrder.length > 0 ? preOrder : null }),
      });
      const data = await res.json();
      if (res.ok) { setResult({ bookingId: data.bookingId }); setPreOrder([]); }
      else { setResult({ error: data.error || 'Booking failed.' }); }
    } catch { setResult({ error: 'Could not reach the server.' }); }
  }

  const tomorrowStr = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();
  const allowedTimes = ['10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00'];

  return (
    <div className="page" style={{ maxWidth: 680 }}>
      <h1>Book a Table</h1>
      <div className="card" style={{ background: 'var(--paper-dim)', marginBottom: 20, fontSize: '0.88rem', color: '#6b6558' }}>
        <p style={{ margin: 0 }}>Dining time: <strong>1 hour</strong> per booking. Place orders within 45 minutes after seating; new orders stop at <strong>21:00</strong>. Last entry: <strong>21:00</strong>. Restaurant closes: <strong>22:00</strong>. A table will be auto-assigned.</p>
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Date</label>
            <input type="date" min={tomorrowStr} value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Time</label>
            <select value={time} onChange={e => setTime(e.target.value)} required>
              {allowedTimes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Party size</label>
            <input type="number" min={1} max={12} value={partySize} onChange={e => setPartySize(Number(e.target.value))} />
          </div>
        </div>
        <div className="field">
          <label>Special request (optional)</label>
          <textarea value={request} onChange={e => setRequest(e.target.value)} rows={2} />
        </div>
        <div style={{ marginTop: 24, marginBottom: 20, borderTop: '2px solid var(--mustard)', paddingTop: 20 }}>
          <h2 style={{ marginBottom: 4 }}>Pre-order Courses (Optional)</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {menuCategories.map(c => <button key={c} type="button" onClick={() => setPreOrderCategory(c)} className={c === preOrderCategory ? 'btn' : 'btn secondary'} style={{ padding: '5px 12px', fontSize: '0.8rem' }}>{c}</button>)}
          </div>
          <div className="booking-preorder-grid" data-pagination-anchor>
            {preOrderPagination.pageItems.map(item => (
              <article className="menu-food-card" key={item.item_id}>
                <div className="menu-food-photo">
                  <div className="menu-food-photo-placeholder" aria-hidden="true">
                    <span>{item.category}</span>
                    <small>Food photo</small>
                  </div>
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      onError={event => { event.currentTarget.style.display = 'none'; }}
                    />
                  )}
                  <span className="menu-food-status is-available">On sale</span>
                </div>
                <div className="menu-food-content">
                  <div className="menu-food-heading">
                    <h2>{item.name}</h2>
                    <span className="menu-food-type">{item.category}</span>
                  </div>
                  <p className="menu-food-description">
                    {item.description || 'A thoughtfully prepared Ember & Oak favorite.'}
                  </p>
                  <div className="menu-food-footer">
                    <span className="menu-food-price">${Number(item.price).toFixed(2)}</span>
                    <button
                      type="button"
                      className="menu-food-add"
                      onClick={() => addPreOrderItem(item)}
                      aria-label={`Add ${item.name} to pre-order`}
                      title={`Add ${item.name} to pre-order`}
                    >
                      <span aria-hidden="true">+</span>
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {filteredMenu.length === 0 && (
              <p className="menu-empty-state">No available dishes in this category.</p>
            )}
          </div>
          <Pagination
            page={preOrderPagination.page}
            pageCount={preOrderPagination.pageCount}
            totalItems={filteredMenu.length}
            onPageChange={preOrderPagination.setPage}
          />
          {preOrder.length > 0 && (
            <div className="card" style={{ borderColor: 'var(--mustard)', marginBottom: 14 }}>
              <h3 style={{ marginBottom: 8 }}>Selected</h3>
              {preOrder.map(item => (
                <div className="ticket-row" key={item.item_id} style={{ padding: '6px 0' }}>
                  <span className="name">{item.name}</span>
                  <span className="leader" />
                  <button type="button" onClick={() => updatePreOrderQty(item.item_id, -1)} style={{ border: '1px solid var(--ink)', background: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer' }}>-</button>
                  <span style={{ fontWeight: 600, minWidth: 20, textAlign: 'center' }}>{item.qty}</span>
                  <button type="button" onClick={() => updatePreOrderQty(item.item_id, 1)} style={{ border: '1px solid var(--ink)', background: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer' }}>+</button>
                  <span className="price"></span>
                  <button type="button" className="btn secondary" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => removePreOrderItem(item.item_id)}>Remove</button>
                </div>
              ))}
              <p style={{ marginTop: 10, fontWeight: 600 }}>Total: </p>
            </div>
          )}
        </div>
        {result && result.error && <p className="error-text">{result.error}</p>}
        {result && result.bookingId && <p style={{ color: 'var(--green)', fontWeight: 600 }}>Booking confirmed — #{result.bookingId}</p>}
        <button className="btn" type="submit">Confirm Booking</button>
      </form>
    </div>
  );
}