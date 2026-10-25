import { Link } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import Pagination, { usePagination } from '../components/Pagination';

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
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('soonest');
  const [bookingFilters, setBookingFilters] = useState({ dateFrom: '', dateTo: '', partySize: '' });

  function load() {
    if (!user) return;
    fetch(`/api/booking/user/${user.user_id}`)
      .then(r => r.json())
      .then(d => setUserBookings(Array.isArray(d) ? d.filter(b => b.status === 'booked') : []))
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
  const preOrderPagination = usePagination(filteredMenu, preOrderCategory);

  const preOrderTotal = preOrder.reduce((sum, i) => sum + i.price * i.qty, 0);
  const filteredBookings = useMemo(() => {
    const term = search.trim().toLowerCase();
    return userBookings.filter(booking => {
      const date = String(booking.booking_date || '').slice(0, 10);
      const searchable = [
        String(booking.booking_id),
        date,
        String(booking.booking_time || '').slice(0, 5),
        String(booking.table_number || booking.table_id || ''),
        String(booking.party_size),
        booking.special_request || '',
      ];
      return (!bookingFilters.dateFrom || date >= bookingFilters.dateFrom)
        && (!bookingFilters.dateTo || date <= bookingFilters.dateTo)
        && (!bookingFilters.partySize || Number(booking.party_size) === Number(bookingFilters.partySize))
        && (!term || searchable.some(value => value.toLowerCase().includes(term)));
    }).sort((a, b) => {
      const timeA = new Date(`${String(a.booking_date).slice(0, 10)}T${String(a.booking_time || '').slice(0, 5)}`).getTime();
      const timeB = new Date(`${String(b.booking_date).slice(0, 10)}T${String(b.booking_time || '').slice(0, 5)}`).getTime();
      return sortBy === 'latest' ? timeB - timeA : timeA - timeB;
    });
  }, [userBookings, search, bookingFilters, sortBy]);
  const bookingsPagination = usePagination(filteredBookings, `${JSON.stringify(bookingFilters)}|${search}|${sortBy}`);

  function clearBookingFilters() {
    setSearch('');
    setSortBy('soonest');
    setBookingFilters({ dateFrom: '', dateTo: '', partySize: '' });
  }

  return (
    <div className="page customer-history-page booking-management-page">
      <h1>Booking Management</h1>
      <p className="customer-history-intro">Manage upcoming bookings and edit their pre-order courses.</p>
      {error && <p className="error-text">{error}</p>}
      {saveMsg && <p style={{ color: 'var(--green)', fontWeight: 600 }}>{saveMsg}</p>}
      <div className="manager-orders-workspace">
        <aside className="manager-orders-filter-panel" aria-label="Filter active bookings">
          <div className="manager-orders-filter-heading">
            <div><span className="manager-orders-filter-eyebrow">REFINE</span><h2>Find bookings</h2></div>
            <button type="button" onClick={clearBookingFilters}>Clear</button>
          </div>
          <label className="manager-orders-filter-field">Date from<input type="date" value={bookingFilters.dateFrom} onChange={event => setBookingFilters(previous => ({ ...previous, dateFrom: event.target.value }))} /></label>
          <label className="manager-orders-filter-field">Date to<input type="date" value={bookingFilters.dateTo} onChange={event => setBookingFilters(previous => ({ ...previous, dateTo: event.target.value }))} /></label>
          <label className="manager-orders-filter-field">Party size<input type="number" min="1" placeholder="Any size" value={bookingFilters.partySize} onChange={event => setBookingFilters(previous => ({ ...previous, partySize: event.target.value }))} /></label>
          <p className="manager-orders-dinein-note">Only upcoming bookings can be edited or cancelled.</p>
        </aside>
        <section className="manager-orders-results" aria-label="Active booking results" data-pagination-anchor>
          <div className="manager-orders-searchbar">
            <label><span aria-hidden="true">⌕</span><span className="visually-hidden">Search bookings</span>
              <input type="search" placeholder="Search booking, table, date, time or request" value={search} onChange={event => setSearch(event.target.value)} />
            </label>
            <label className="manager-orders-sort"><span>Sort by</span>
              <select aria-label="Sort bookings" value={sortBy} onChange={event => setSortBy(event.target.value)}>
                <option value="soonest">Soonest first</option><option value="latest">Latest first</option>
              </select>
            </label>
          </div>
          <p className="manager-orders-result-count">{filteredBookings.length} {filteredBookings.length === 1 ? 'booking' : 'bookings'}</p>
      {filteredBookings.length === 0 && !editingId ? (
        <p className="manager-queue-history-empty">
          {userBookings.length === 0 ? <>No active bookings. <Link to="/booking">Create a new booking</Link></> : 'No bookings match these filters.'}
        </p>
      ) : (
        <div className="booking-management-list">{bookingsPagination.pageItems.map(b => (
          <div key={b.booking_id}>
            <article className="manager-booking-customer-card">
              <div className="manager-booking-customer-primary">
                <strong>Booking #{b.booking_id}</strong>
                <span>{b.booking_date?.slice(0, 10)} · {b.booking_time?.slice(0, 5)}</span>
              </div>
              <div className="manager-booking-customer-details">
                <span><strong>Table:</strong> #{b.table_number || b.table_id}</span>
                <span><strong>Party:</strong> {b.party_size} people</span>
              {b.pre_order && (() => {
                try {
                  const items = typeof b.pre_order === 'string' ? JSON.parse(b.pre_order) : b.pre_order;
                  if (Array.isArray(items) && items.length > 0) {
                    return <span className="manager-booking-preorder-count">{items.length} pre-order course(s)</span>;
                  }
                } catch { /* ignore */ }
                return null;
              })()}
              </div>
              <div className="manager-booking-customer-actions">
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
              </article>

            {editingId === b.booking_id && editForm && (
              <div className="card" style={{ marginTop: 12, marginBottom: 24, borderColor: 'var(--mustard)' }}>
                <h3>Edit Pre-order Courses for Booking #{b.booking_id}</h3>
                <div style={{ background: 'var(--paper-dim)', padding: 12, marginBottom: 16, borderLeft: '3px solid var(--mustard)' }}>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: '#6b6558' }}>
                    <strong>Note:</strong> You can only edit the pre-order courses. To change the date, time, party size, or special request, please cancel this booking and create a new one.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Date</div>
                      <div style={{ fontSize: '0.95rem' }}>{editForm.booking_date}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Time</div>
                      <div style={{ fontSize: '0.95rem' }}>{editForm.booking_time}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Party Size</div>
                      <div style={{ fontSize: '0.95rem' }}>{editForm.party_size} people</div>
                    </div>
                  </div>
                  {editForm.special_request && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Special Request</div>
                      <div style={{ fontSize: '0.95rem' }}>{editForm.special_request}</div>
                    </div>
                  )}
                </div>

                {/* Pre-order course selection */}
                <div style={{ borderTop: '2px solid var(--mustard)', paddingTop: 16, marginTop: 0 }}>
                  <h3 style={{ marginBottom: 4 }}>Edit Pre-order Courses</h3>
                  <p style={{ color: '#6b6558', fontSize: '0.85rem', marginBottom: 12 }}>
                    Add or remove courses for your booking.
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

                  <div className="booking-preorder-grid">
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
        ))}</div>
      )}
          <Pagination
            page={bookingsPagination.page}
            pageCount={bookingsPagination.pageCount}
            totalItems={filteredBookings.length}
            onPageChange={bookingsPagination.setPage}
          />
        </section>
      </div>
    </div>
  );
}