import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../services/api';
import { isBookingCheckInAvailable } from '../../utils/bookingCheckIn';
import Pagination, { usePagination } from '../../components/Pagination';

const BOOKING_FILTERS = ['booked', 'seated', 'cancelled', 'no_show'];
const STATUS_LABEL = { booked: 'Booked', serving: 'Serving', finished: 'Finished', paid: 'Paid', cancelled: 'Cancelled', no_show: 'No show' };
const ONE_HOUR_MS = 60 * 60 * 1000;
const SEATED_STATUSES = new Set(['serving', 'finished', 'paid']);

function getPreOrderItems(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function bookingDate(booking) {
  return String(booking.booking_date || '').slice(0, 10);
}

function bookingTime(booking) {
  return String(booking.booking_time || '').slice(0, 5);
}

export default function ManagerBookings() {
  const [bookings, setBookings] = useState([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('soonest');
  const [filters, setFilters] = useState({
    status: 'booked',
    dateFrom: '',
    dateTo: '',
    tableId: '',
    bookingId: '',
    partySize: '',
  });
  const [error, setError] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(() => {
    api.get('/booking/all')
      .then(response => {
        setBookings(Array.isArray(response.data) ? response.data : []);
        setError('');
      })
      .catch(requestError => setError(requestError.response?.data?.error || 'Could not load bookings.'));
  }, []);

  useEffect(() => {
    load();
    const refresh = setInterval(load, 15000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(refresh);
      clearInterval(clock);
    };
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => {
      bookings.forEach(booking => {
        if (booking.status === 'serving' && booking.served_at
          && Date.now() - new Date(booking.served_at).getTime() >= ONE_HOUR_MS) {
          api.patch(`/booking/${booking.booking_id}/finish`).then(() => {
            setNotifications(previous => {
              if (previous.some(notification => notification.id === booking.booking_id)) return previous;
              return [...previous, {
                id: booking.booking_id,
                msg: `Booking #${booking.booking_id} (Table #${booking.table_number}) — 1 hour elapsed. Please collect payment.`,
                time: new Date().toLocaleTimeString(),
              }];
            });
            load();
          }).catch(() => {
            setError('Unable to finish a seated booking. Please retry.');
          });
        }
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [bookings, load]);

  const filtered = useMemo(() => bookings
    .filter(booking => {
      const statusMatches = filters.status === 'seated'
        ? SEATED_STATUSES.has(booking.status)
        : !filters.status || booking.status === filters.status;
      const date = bookingDate(booking);
      const id = String(booking.booking_id);
      const tableId = String(booking.table_id ?? booking.table_number ?? '');
      const term = search.trim().toLowerCase();
      const searchMatches = !term || [
        id,
        date,
        bookingTime(booking),
        tableId,
        String(booking.party_size),
        booking.status,
        booking.special_request || '',
      ].some(value => value.toLowerCase().includes(term));
      return statusMatches
        && (!filters.dateFrom || date >= filters.dateFrom)
        && (!filters.dateTo || date <= filters.dateTo)
        && (!filters.tableId || tableId.includes(filters.tableId.trim()))
        && (!filters.bookingId || id.includes(filters.bookingId.trim()))
        && (!filters.partySize || Number(booking.party_size) === Number(filters.partySize))
        && searchMatches;
    })
    .sort((a, b) => {
      const timeA = new Date(`${bookingDate(a)}T${bookingTime(a)}`).getTime();
      const timeB = new Date(`${bookingDate(b)}T${bookingTime(b)}`).getTime();
      if (sortBy === 'latest') return timeB - timeA;
      if (sortBy === 'partyLarge') return Number(b.party_size) - Number(a.party_size);
      if (sortBy === 'table') return Number(a.table_number || a.table_id) - Number(b.table_number || b.table_id);
      return timeA - timeB;
    }), [bookings, filters, search, sortBy]);
  const pagination = usePagination(filtered, `${JSON.stringify(filters)}|${search}|${sortBy}`);

  function updateFilter(name, value) {
    setFilters(previous => ({ ...previous, [name]: value }));
  }

  function clearFilters() {
    setSearch('');
    setSortBy('soonest');
    setFilters({ status: '', dateFrom: '', dateTo: '', tableId: '', bookingId: '', partySize: '' });
  }

  async function handleCancel(bookingId) {
    setError('');
    try {
      await api.patch(`/booking/${bookingId}/cancel`);
      load();
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not cancel booking.');
    }
  }

  async function handleMarkServing(bookingId) {
    setError('');
    try {
      await api.patch(`/booking/${bookingId}/arrive`);
      load();
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Could not update status.');
    }
  }

  function getTimeRemaining(servedAt) {
    if (!servedAt) return null;
    const remaining = ONE_HOUR_MS - (Date.now() - new Date(servedAt).getTime());
    if (remaining <= 0) return 'Time up';
    const minutes = Math.floor(remaining / 60000);
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return hours > 0 ? `${hours}h ${remainder}m` : `${remainder}m`;
  }

  return (
    <div className="page manager-bookings-page">
      <h1>Bookings</h1>
      <p className="manager-queue-history-intro">
        Check in from the booked time until 15 minutes afterward. Unchecked bookings then become no show.
      </p>

      {notifications.length > 0 && (
        <div className="manager-booking-notifications">
          {notifications.map(notification => (
            <div className="manager-booking-notification" key={notification.id}>
              <div>
                <p>{notification.msg}</p>
                <span>At {notification.time}</span>
              </div>
              <button type="button" className="btn secondary" onClick={() => setNotifications(previous => previous.filter(item => item.id !== notification.id))}>Dismiss</button>
            </div>
          ))}
        </div>
      )}

      <div className="manager-orders-workspace">
        <aside className="manager-orders-filter-panel" aria-label="Filter bookings">
          <div className="manager-orders-filter-heading">
            <div><span className="manager-orders-filter-eyebrow">REFINE</span><h2>Find bookings</h2></div>
            <button type="button" onClick={clearFilters}>Clear</button>
          </div>
          <label className="manager-orders-filter-field">
            Status
            <select value={filters.status} onChange={event => updateFilter('status', event.target.value)}>
              <option value="">All statuses</option>
              {BOOKING_FILTERS.map(status => <option key={status} value={status}>{status === 'no_show' ? 'No show' : status === 'seated' ? 'Seated' : STATUS_LABEL[status]}</option>)}
            </select>
          </label>
          <label className="manager-orders-filter-field">
            Date from
            <input type="date" value={filters.dateFrom} onChange={event => updateFilter('dateFrom', event.target.value)} />
          </label>
          <label className="manager-orders-filter-field">
            Date to
            <input type="date" value={filters.dateTo} onChange={event => updateFilter('dateTo', event.target.value)} />
          </label>
          <label className="manager-orders-filter-field">
            Table ID
            <input type="search" inputMode="numeric" placeholder="Any table" value={filters.tableId} onChange={event => updateFilter('tableId', event.target.value)} />
          </label>
          <label className="manager-orders-filter-field">
            Booking ID
            <input type="search" inputMode="numeric" placeholder="Any booking" value={filters.bookingId} onChange={event => updateFilter('bookingId', event.target.value)} />
          </label>
          <label className="manager-orders-filter-field">
            Party size
            <input type="number" min="1" placeholder="Any size" value={filters.partySize} onChange={event => updateFilter('partySize', event.target.value)} />
          </label>
          <p className="manager-orders-dinein-note">Check-in is available only during the 15-minute window after the booked time.</p>
        </aside>

        <section className="manager-orders-results" aria-label="Booking results" data-pagination-anchor>
          <div className="manager-orders-searchbar">
            <label>
              <span aria-hidden="true">⌕</span>
              <span className="visually-hidden">Search bookings</span>
              <input type="search" placeholder="Search booking ID, table, date, time or request" value={search} onChange={event => setSearch(event.target.value)} />
            </label>
            <label className="manager-orders-sort">
              <span>Sort by</span>
              <select aria-label="Sort bookings" value={sortBy} onChange={event => setSortBy(event.target.value)}>
                <option value="soonest">Soonest first</option>
                <option value="latest">Latest first</option>
                <option value="partyLarge">Party size: large to small</option>
                <option value="table">Table ID</option>
              </select>
            </label>
          </div>
          <p className="manager-orders-result-count">{filtered.length} {filtered.length === 1 ? 'booking' : 'bookings'}</p>
          {error && <p className="error-text">{error} <button className="btn secondary" onClick={load}>Retry</button></p>}
          {!error && filtered.length === 0 && <p className="manager-queue-history-empty">No bookings match these filters.</p>}

          <div className="manager-queue-history-list">
            {pagination.pageItems.map(booking => {
              const remaining = getTimeRemaining(booking.served_at);
              const checkInAvailable = booking.status === 'booked'
                && isBookingCheckInAvailable(booking.booking_date, booking.booking_time, now);
              const preOrderItems = getPreOrderItems(booking.pre_order);
              return (
                <article className="manager-booking-card" key={booking.booking_id}>
                  <div className="manager-queue-history-primary">
                    <strong>Booking #{booking.booking_id}</strong>
                    <span>{bookingDate(booking)} · {bookingTime(booking)}</span>
                    <span className={`manager-queue-status manager-queue-status-${booking.status}`}>
                      {STATUS_LABEL[booking.status] || booking.status}
                    </span>
                  </div>
                  <div className="manager-queue-history-details">
                    <span><strong>Table:</strong> #{booking.table_number || booking.table_id}</span>
                    <span><strong>Party size:</strong> {booking.party_size} {Number(booking.party_size) === 1 ? 'person' : 'people'}</span>
                    {booking.special_request && <span><strong>Special request:</strong> {booking.special_request}</span>}
                    {booking.status === 'serving' && remaining && <span className="manager-booking-time-left"><strong>Dining time:</strong> {remaining}</span>}
                    {filters.status === 'seated' && preOrderItems.length > 0 && (
                      <span className="manager-booking-preorder">
                        <strong>Pre-order courses:</strong>
                        {preOrderItems.map(item => <span key={item.item_id || item.name}>{item.name} × {Number(item.qty) || 1}</span>)}
                      </span>
                    )}
                  </div>
                  <div className="manager-queue-history-meta">
                    {booking.status === 'booked' && (
                      <div className="manager-booking-actions">
                        {checkInAvailable && <button type="button" className="btn" onClick={() => handleMarkServing(booking.booking_id)}>Check in</button>}
                        <button type="button" className="btn secondary" onClick={() => handleCancel(booking.booking_id)}>Cancel</button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          <Pagination
            page={pagination.page}
            pageCount={pagination.pageCount}
            totalItems={filtered.length}
            onPageChange={pagination.setPage}
          />
        </section>
      </div>
    </div>
  );
}
