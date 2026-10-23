import { Link } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

export default function BookingManagement() {
  const { user } = useAuth();
  const [userBookings, setUserBookings] = useState([]);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [preOrder, setPreOrder] = useState([]);
  const [preOrderCategory, setPreOrderCategory] = useState('All');
  const [editForm, setEditForm] = useState(null);
  const [allTables, setAllTables] = useState([]);
  const [availableTables, setAvailableTables] = useState([]);
  const [saveMsg, setSaveMsg] = useState('');

  function load() {
    if (!user) return;
    fetch(`/api/booking/user/${user.user_id}`)
      .then(r => r.json())
      .then(d => setUserBookings(Array.isArray(d) ? d.filter(b => b.status === 'reserved') : []))
      .catch(() => setUserBookings([]));
  }

  useEffect(load, [user]);

  useEffect(() => {
    fetch('/api/booking/menu')
      .then(r => r.json())
      .then(d => setMenuItems(Array.isArray(d) ? d : []))
      .catch(() => setMenuItems([]));
    const token = localStorage.getItem('token');
    fetch('/api/booking/tables', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setAllTables(Array.isArray(d) ? d : []))
      .catch(() => setAllTables([]));
  }, []);

  useEffect(() => {
    if (!editForm?.booking_date || !editForm?.booking_time || !editForm?.party_size) { setAvailableTables([]); return; }
    const token = localStorage.getItem('token');
    fetch(`/api/booking/availability?date=${editForm.booking_date}&time=${editForm.booking_time}&party_size=${editForm.party_size}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setAvailableTables(Array.isArray(d) ? d : []))
      .catch(() => setAvailableTables([]));
  }, [editForm?.booking_date, editForm?.booking_time, editForm?.party_size]);

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

  function startEdit(b) {
    setEditingId(b.booking_id);
    setEditForm({
      table_id: b.table_id,
      booking_date: b.booking_date?.slice(0, 10),
      booking_time: b.booking_time?.slice(0, 5),
      party_size: b.party_size,
      special_request: b.special_request || '',
    });
    try {
      setPreOrder(b.pre_order ? (typeof b.pre_order === 'string' ? JSON.parse(b.pre_order) : b.pre_order) : []);
    } catch { setPreOrder([]); }
    setPreOrderCategory('All');
    setSaveMsg('');
    setError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
    setPreOrder([]);
    setSaveMsg('');
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

  async function handleSaveEdit() {
    setError('');
    setSaveMsg('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/booking/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...editForm,
          pre_order: preOrder.length > 0 ? preOrder : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Could not update booking.'); return; }
      setSaveMsg('Booking updated successfully.');
      cancelEdit();
      load();
    } catch {
      setError('Could not reach the server.');
    }
  }

  const menuCategories = useMemo(() => {
    const cats = [...new Set(menuItems.map(i => i.category))];
    return ['All', ...cats];
  }, [menuItems]);

  const filteredMenu = useMemo(
    () => menuItems.filter(i => i.is_available && (preOrderCategory === 'All' || i.category === preOrderCategory)),
    [menuItems, preOrderCategory]
  );

  const preOrderTotal = preOrder.reduce((sum, i) => sum + i.price * i.qty, 0);

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <h1>Booking Management</h1>
      {error && <p className="error-text">{error}</p>}
      {saveMsg && <p style={{ color: 'var(--green)', fontWeight: 600 }}>{saveMsg}</p>}
      {userBookings.length === 0 && !editingId ? (
        <p>No active bookings. <Link to="/booking">Create a new booking</Link></p>
      ) : (
        userBookings.map(b => (
          <div key={b.booking_id}>
            <div className="ticket-row">
              <span className="name">Booking #{b.booking_id}</span>
              <span className="leader" />
              <span className="price">{b.booking_date?.slice(0, 10)} {b.booking_time?.slice(0, 5)}</span>
              <span className="desc">Party of {b.party_size}</span>
              {b.pre_order && (() => {
                try {
                  const items = typeof b.pre_order === 'string' ? JSON.parse(b.pre_order) : b.pre_order;
                  if (Array.isArray(items) && items.length > 0) {
                    return <span className="desc" style={{ color: 'var(--green)' }}>Pre-order: {items.length} course(s)</span>;
                  }
                } catch { /* ignore */ }
                return null;
              })()}
              <div style={{ display: 'flex', gap: 8, marginLeft: 12 }}>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                  onClick={() => startEdit(b)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ padding: '4px 12px', fontSize: '0.8rem', borderColor: 'var(--rust)', color: 'var(--rust)' }}
                  onClick={() => handleCancel(b.booking_id)}
                >
                  Cancel
                </button>
              </div>
            </div>

            {editingId === b.booking_id && editForm && (
              <div className="card" style={{ marginTop: 12, marginBottom: 24, borderColor: 'var(--mustard)' }}>
                <h3>Edit Booking #{b.booking_id}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div className="field" style={{ margin: 0 }}>
                    <label>Date</label>
                    <input type="date" value={editForm.booking_date} onChange={e => setEditForm(f => ({ ...f, booking_date: e.target.value }))} />
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label>Time</label>
                    <select value={editForm.booking_time} onChange={e => setEditForm(f => ({ ...f, booking_time: e.target.value }))}>
                      {['10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30','22:00'].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label>Party size</label>
                    <input type="number" min={1} max={12} value={editForm.party_size} onChange={e => setEditForm(f => ({ ...f, party_size: Number(e.target.value), table_id: null }))} />
                  </div>
                </div>
                <div className="field">
                  <label>Special request</label>
                  <textarea value={editForm.special_request} onChange={e => setEditForm(f => ({ ...f, special_request: e.target.value }))} rows={2} />
                </div>

                {/* Pre-order course selection */}
                <div style={{ borderTop: '2px solid var(--mustard)', paddingTop: 16, marginTop: 12 }}>
                  <h3 style={{ marginBottom: 4 }}>Edit Pre-order Courses</h3>
                  <p style={{ color: '#6b6558', fontSize: '0.85rem', marginBottom: 12 }}>
                    Add or remove courses for your reservation.
                  </p>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    {menuCategories.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setPreOrderCategory(c)}
                        className={c === preOrderCategory ? 'btn' : 'btn secondary'}
                        style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>

                  <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--line)', padding: 10, marginBottom: 12 }}>
                    {filteredMenu.map(item => (
                      <div className="ticket-row" key={item.item_id} style={{ padding: '6px 0' }}>
                        <span className="name" style={{ fontSize: '0.9rem' }}>{item.name}</span>
                        <span className="leader" />
                        <span className="price">${Number(item.price).toFixed(0)}</span>
                        <button type="button" className="btn" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => addPreOrderItem(item)}>+</button>
                      </div>
                    ))}
                  </div>

                  {preOrder.length > 0 && (
                    <div style={{ background: 'var(--paper-dim)', padding: 12, marginBottom: 12 }}>
                      <strong>Selected Courses:</strong>
                      {preOrder.map(item => (
                        <div key={item.item_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                          <span style={{ flex: 1 }}>{item.name}</span>
                          <button type="button" onClick={() => updatePreOrderQty(item.item_id, -1)} style={{ border: '1px solid var(--ink)', background: 'transparent', borderRadius: '999px', width: 22, height: 22, cursor: 'pointer', fontSize: '0.8rem' }}>−</button>
                          <span style={{ fontWeight: 600, minWidth: 18, textAlign: 'center' }}>{item.qty}</span>
                          <button type="button" onClick={() => updatePreOrderQty(item.item_id, 1)} style={{ border: '1px solid var(--ink)', background: 'transparent', borderRadius: '999px', width: 22, height: 22, cursor: 'pointer', fontSize: '0.8rem' }}>+</button>
                          <span style={{ fontWeight: 600, minWidth: 50, textAlign: 'right' }}>${item.price * item.qty}</span>
                          <button type="button" className="btn secondary" style={{ padding: '2px 6px', fontSize: '0.7rem' }} onClick={() => removePreOrderItem(item.item_id)}>✕</button>
                        </div>
                      ))}
                      <p style={{ marginTop: 8, fontWeight: 600, fontSize: '0.9rem' }}>Pre-order Total: ${preOrderTotal}</p>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button type="button" className="btn" onClick={handleSaveEdit}>Save Changes</button>
                  <button type="button" className="btn secondary" onClick={cancelEdit}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}