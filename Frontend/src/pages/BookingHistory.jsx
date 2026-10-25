import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Pagination, { usePagination } from '../components/Pagination';

const STATUS_LABELS = {
  booked: 'Booked', serving: 'Serving', finished: 'Finished', paid: 'Paid',
  cancelled: 'Cancelled', no_show: 'No show', seated: 'Seated',
};

function normalizedStatus(status) {
  return String(status || '').toLowerCase().replace(/[\s-]+/g, '_');
}

export default function BookingHistory() {
  const { user } = useAuth();
  const [userBookings, setUserBookings] = useState([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [filters, setFilters] = useState({ status: '', dateFrom: '', dateTo: '', partySize: '' });

  useEffect(() => {
    if (!user) return;
    api.get(`/booking/user/${user.user_id}`)
      .then(response => {
        setUserBookings(Array.isArray(response.data) ? response.data : []);
        setError('');
      })
      .catch(() => {
        setUserBookings([]);
        setError('Unable to load your booking history. Please retry.');
      });
  }, [user]);

  const bookings = useMemo(() => {
    const term = search.trim().toLowerCase();
    return userBookings.filter(booking => {
      const date = String(booking.booking_date || '').slice(0, 10);
      const status = normalizedStatus(booking.status);
      const values = [
        String(booking.booking_id), String(booking.table_number || booking.table_id || ''),
        date, String(booking.booking_time || '').slice(0, 5), String(booking.party_size),
        status, booking.special_request || '',
      ];
      return (!filters.status || status === filters.status)
        && (!filters.dateFrom || date >= filters.dateFrom)
        && (!filters.dateTo || date <= filters.dateTo)
        && (!filters.partySize || Number(booking.party_size) === Number(filters.partySize))
        && (!term || values.some(value => value.toLowerCase().includes(term)));
    }).sort((a, b) => {
      const dateA = new Date(`${String(a.booking_date).slice(0, 10)}T${String(a.booking_time || '').slice(0, 5)}`);
      const dateB = new Date(`${String(b.booking_date).slice(0, 10)}T${String(b.booking_time || '').slice(0, 5)}`);
      return sortBy === 'oldest' ? dateA - dateB : dateB - dateA;
    });
  }, [userBookings, filters, search, sortBy]);
  const pagination = usePagination(bookings, `${JSON.stringify(filters)}|${search}|${sortBy}`);

  function updateFilter(name, value) {
    setFilters(previous => ({ ...previous, [name]: value }));
  }

  function clearFilters() {
    setSearch('');
    setSortBy('newest');
    setFilters({ status: '', dateFrom: '', dateTo: '', partySize: '' });
  }

  return (
    <div className="page customer-history-page">
      <h1>Booking History</h1>
      <p className="customer-history-intro">Review your past and upcoming dine-in bookings.</p>
      <div className="manager-orders-workspace">
        <aside className="manager-orders-filter-panel" aria-label="Filter booking history">
          <div className="manager-orders-filter-heading">
            <div><span className="manager-orders-filter-eyebrow">REFINE</span><h2>Find bookings</h2></div>
            <button type="button" onClick={clearFilters}>Clear</button>
          </div>
          <label className="manager-orders-filter-field">
            Status
            <select value={filters.status} onChange={event => updateFilter('status', event.target.value)}>
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="manager-orders-filter-field">Date from<input type="date" value={filters.dateFrom} onChange={event => updateFilter('dateFrom', event.target.value)} /></label>
          <label className="manager-orders-filter-field">Date to<input type="date" value={filters.dateTo} onChange={event => updateFilter('dateTo', event.target.value)} /></label>
          <label className="manager-orders-filter-field">Party size<input type="number" min="1" placeholder="Any size" value={filters.partySize} onChange={event => updateFilter('partySize', event.target.value)} /></label>
          <p className="manager-orders-dinein-note">Your booking history is private to your account.</p>
        </aside>
        <section className="manager-orders-results" aria-label="Booking history results" data-pagination-anchor>
          <div className="manager-orders-searchbar">
            <label><span aria-hidden="true">⌕</span><span className="visually-hidden">Search booking history</span>
              <input type="search" placeholder="Search booking ID, table, date, time or request" value={search} onChange={event => setSearch(event.target.value)} />
            </label>
            <label className="manager-orders-sort"><span>Sort by</span>
              <select aria-label="Sort booking history" value={sortBy} onChange={event => setSortBy(event.target.value)}>
                <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
              </select>
            </label>
          </div>
          <p className="manager-orders-result-count">{bookings.length} {bookings.length === 1 ? 'booking' : 'bookings'}</p>
          {error && <p className="error-text">{error}</p>}
          {!error && bookings.length === 0 && <p className="manager-queue-history-empty">{userBookings.length ? 'No bookings match these filters.' : 'No bookings yet.'}</p>}
          <div className="manager-queue-history-list">
            {pagination.pageItems.map(booking => {
              const status = normalizedStatus(booking.status);
              return (
                <article className="manager-booking-card customer-booking-history-card" key={booking.booking_id}>
                  <div className="manager-queue-history-primary">
                    <strong>Booking #{booking.booking_id}</strong>
                    <span>{String(booking.booking_date || '').slice(0, 10)} · {String(booking.booking_time || '').slice(0, 5)}</span>
                  </div>
                  <div className="manager-queue-history-details">
                    <span><strong>Table:</strong> #{booking.table_number || booking.table_id || '—'}</span>
                    <span><strong>Party size:</strong> {booking.party_size} {Number(booking.party_size) === 1 ? 'person' : 'people'}</span>
                    {booking.special_request && <span><strong>Special request:</strong> {booking.special_request}</span>}
                  </div>
                  <div className="manager-queue-history-meta">
                    <span className={`manager-queue-status manager-queue-status-${status}`}>{STATUS_LABELS[status] || booking.status}</span>
                    {booking.pre_order && <strong>Pre-order saved</strong>}
                  </div>
                </article>
              );
            })}
          </div>
          <Pagination
            page={pagination.page}
            pageCount={pagination.pageCount}
            totalItems={bookings.length}
            onPageChange={pagination.setPage}
          />
        </section>
      </div>
    </div>
  );
}
