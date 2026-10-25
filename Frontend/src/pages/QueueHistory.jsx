import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Pagination, { usePagination } from '../components/Pagination';

const STATUS_LABELS = {
  queued: 'Queuing', called: 'Called', serving: 'Seated', finished: 'Finished',
  paid: 'Paid', cancelled: 'Cancelled', missed: 'Missed', no_show: 'No show',
};

function normalizeStatus(status) {
  return String(status || '').toLowerCase().replace(/[\s-]+/g, '_');
}

function groupForPartySize(size) {
  if (size <= 2) return 'A';
  if (size <= 6) return 'B';
  return 'C';
}

function formatDateTime(value) {
  if (!value) return '—';
  const normalized = String(value).replace('T', ' ');
  return `${normalized.slice(0, 10)} ${normalized.slice(11, 16)}`;
}

export default function QueueHistory() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [filters, setFilters] = useState({ status: '', dateFrom: '', dateTo: '', partyGroup: '' });

  useEffect(() => {
    if (!user) return;
    api.get(`/queue/user/${user.user_id}`)
      .then(response => {
        setEntries(Array.isArray(response.data) ? response.data : []);
        setError('');
      })
      .catch(() => {
        setEntries([]);
        setError('Unable to load your queue history. Please retry.');
      });
  }, [user]);

  const filteredEntries = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries.filter(entry => {
      const number = String(entry.queue_number || entry.queue_id);
      const group = groupForPartySize(Number(entry.party_size));
      const date = String(entry.joined_at || entry.queue_date || '').slice(0, 10);
      const status = normalizeStatus(entry.status);
      const searchValues = [number, group.toLowerCase(), status, date, String(entry.party_size)];
      return (!filters.status || status === filters.status)
        && (!filters.dateFrom || date >= filters.dateFrom)
        && (!filters.dateTo || date <= filters.dateTo)
        && (!filters.partyGroup || group === filters.partyGroup)
        && (!term || searchValues.some(value => value.toLowerCase().includes(term)));
    }).sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.joined_at || a.queue_date) - new Date(b.joined_at || b.queue_date);
      if (sortBy === 'queueId') return String(a.queue_number || '').localeCompare(String(b.queue_number || ''));
      return new Date(b.joined_at || b.queue_date) - new Date(a.joined_at || a.queue_date);
    });
  }, [entries, filters, search, sortBy]);
  const pagination = usePagination(filteredEntries, `${JSON.stringify(filters)}|${search}|${sortBy}`);

  function updateFilter(name, value) {
    setFilters(previous => ({ ...previous, [name]: value }));
  }

  function clearFilters() {
    setSearch('');
    setSortBy('newest');
    setFilters({ status: '', dateFrom: '', dateTo: '', partyGroup: '' });
  }

  return (
    <div className="page customer-history-page">
      <h1>Queue History</h1>
      <p className="customer-history-intro">Review the status and details of your queue tickets.</p>
      <div className="manager-orders-workspace">
        <aside className="manager-orders-filter-panel" aria-label="Filter queue history">
          <div className="manager-orders-filter-heading">
            <div><span className="manager-orders-filter-eyebrow">REFINE</span><h2>Find tickets</h2></div>
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
          <label className="manager-orders-filter-field">
            Party group
            <select value={filters.partyGroup} onChange={event => updateFilter('partyGroup', event.target.value)}>
              <option value="">All groups</option><option value="A">Group A · 1–2 people</option>
              <option value="B">Group B · 3–6 people</option><option value="C">Group C · 7+ people</option>
            </select>
          </label>
          <p className="manager-orders-dinein-note">Your queue history is private to your account.</p>
        </aside>
        <section className="manager-orders-results" aria-label="Queue history results" data-pagination-anchor>
          <div className="manager-orders-searchbar">
            <label><span aria-hidden="true">⌕</span><span className="visually-hidden">Search queue history</span>
              <input type="search" placeholder="Search queue ID, date, party size or status" value={search} onChange={event => setSearch(event.target.value)} />
            </label>
            <label className="manager-orders-sort"><span>Sort by</span>
              <select aria-label="Sort queue history" value={sortBy} onChange={event => setSortBy(event.target.value)}>
                <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="queueId">Queue ID</option>
              </select>
            </label>
          </div>
          <p className="manager-orders-result-count">{filteredEntries.length} {filteredEntries.length === 1 ? 'ticket' : 'tickets'}</p>
          {error && <p className="error-text">{error}</p>}
          {!error && filteredEntries.length === 0 && <p className="manager-queue-history-empty">{entries.length ? 'No queue tickets match these filters.' : 'No queue entries yet.'}</p>}
          <div className="manager-queue-history-list">
            {pagination.pageItems.map(entry => {
              const status = normalizeStatus(entry.status);
              return (
                <article className="manager-queue-history-card" key={entry.queue_id}>
                  <div className="manager-queue-history-primary">
                    <strong>{entry.queue_number || `Queue #${entry.queue_id}`}</strong>
                    <span>Party of {entry.party_size}</span>
                    <span className="manager-queue-history-group">Group {groupForPartySize(Number(entry.party_size))}</span>
                  </div>
                  <div className="manager-queue-history-details">
                    <span><strong>Joined:</strong> {formatDateTime(entry.joined_at || entry.queue_date)}</span>
                    <span><strong>Called:</strong> {formatDateTime(entry.called_at)}</span>
                    <span><strong>Seated:</strong> {formatDateTime(entry.served_at)}</span>
                  </div>
                  <div className="manager-queue-history-meta">
                    <span className={`manager-queue-status manager-queue-status-${status}`}>{STATUS_LABELS[status] || entry.status}</span>
                    <strong>{entry.table_number ? `Table ${entry.table_number}` : 'No table assigned'}</strong>
                  </div>
                </article>
              );
            })}
          </div>
          <Pagination
            page={pagination.page}
            pageCount={pagination.pageCount}
            totalItems={filteredEntries.length}
            onPageChange={pagination.setPage}
          />
        </section>
      </div>
    </div>
  );
}
