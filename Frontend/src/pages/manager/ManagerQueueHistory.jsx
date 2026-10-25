import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import Pagination, { usePagination } from '../../components/Pagination';

const STATUS_OPTIONS = [
  ['queued', 'Queuing'],
  ['called', 'Called'],
  ['cancelled', 'Cancelled'],
  ['no_show', 'No show'],
  ['missed', 'Missed'],
  ['serving', 'Seated'],
  ['finished', 'Finished'],
  ['paid', 'Paid'],
];

function groupForPartySize(partySize) {
  if (partySize <= 2) return 'A';
  if (partySize <= 6) return 'B';
  return 'C';
}

function normalizeStatus(status) {
  return String(status || '').toLowerCase().replace(/[\s-]+/g, '_');
}

function statusLabel(status) {
  return STATUS_OPTIONS.find(([value]) => value === normalizeStatus(status))?.[1] || status;
}

function formatDateTime(value) {
  if (!value) return '—';
  const normalized = String(value).replace('T', ' ');
  return `${normalized.slice(0, 10)} ${normalized.slice(11, 16)}`;
}

function formatDate(value) {
  return value ? String(value).slice(0, 10) : '';
}

function dateOf(entry) {
  return formatDate(entry.joined_at || entry.queue_date);
}

function matches(entry, filters, search) {
  const queueNumber = String(entry.queue_number || entry.queue_id);
  const customerName = String(entry.customer_name || '').toLowerCase();
  const group = groupForPartySize(Number(entry.party_size));
  const tableInfo = [entry.table_id, entry.table_number, entry.assigned_table_number]
    .filter(value => value != null)
    .map(String);
  const joinedDate = dateOf(entry);

  if (filters.status && normalizeStatus(entry.status) !== filters.status) return false;
  if (filters.group && group !== filters.group) return false;
  if (filters.dateFrom && joinedDate < filters.dateFrom) return false;
  if (filters.dateTo && joinedDate > filters.dateTo) return false;
  if (filters.customerName && !customerName.includes(filters.customerName.toLowerCase().trim())) return false;
  if (filters.tableId && !tableInfo.some(value => value.includes(filters.tableId.trim()))) return false;
  if (filters.queueId && !queueNumber.toLowerCase().includes(filters.queueId.toLowerCase().trim())) return false;
  if (filters.partySize && Number(entry.party_size) !== Number(filters.partySize)) return false;

  const term = search.trim().toLowerCase();
  if (!term) return true;
  return [
    queueNumber.toLowerCase(),
    customerName,
    group.toLowerCase(),
    entry.status.toLowerCase(),
    String(entry.party_size),
    joinedDate,
    ...tableInfo,
  ].some(value => value.includes(term));
}

export default function ManagerQueueHistory() {
  const [entries, setEntries] = useState([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    status: '',
    group: '',
    customerName: '',
    tableId: '',
    queueId: '',
    partySize: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await api.get('/queue/manager/history');
      setEntries(Array.isArray(response.data) ? response.data : []);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to load queue history. Please retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const refresh = setInterval(load, 15000);
    return () => clearInterval(refresh);
  }, [load]);

  const filteredEntries = useMemo(() => entries
    .filter(entry => matches(entry, filters, search))
    .sort((a, b) => {
      if (sortBy === 'oldest') {
        return new Date(a.joined_at || a.queue_date) - new Date(b.joined_at || b.queue_date);
      }
      if (sortBy === 'partySmall') return Number(a.party_size) - Number(b.party_size);
      if (sortBy === 'partyLarge') return Number(b.party_size) - Number(a.party_size);
      if (sortBy === 'queueId') return String(a.queue_number || '').localeCompare(String(b.queue_number || ''));
      if (sortBy === 'customer') return String(a.customer_name || '').localeCompare(String(b.customer_name || ''));
      return new Date(b.joined_at || b.queue_date) - new Date(a.joined_at || a.queue_date);
    }), [entries, filters, search, sortBy]);
  const pagination = usePagination(filteredEntries, `${JSON.stringify(filters)}|${search}|${sortBy}`);

  function updateFilter(name, value) {
    setFilters(previous => ({ ...previous, [name]: value }));
  }

  function clearFilters() {
    setSearch('');
    setSortBy('newest');
    setFilters({
      dateFrom: '',
      dateTo: '',
      status: '',
      group: '',
      customerName: '',
      tableId: '',
      queueId: '',
      partySize: '',
    });
  }

  return (
    <div className="page manager-queue-history-page">
      <h1>Queue History</h1>
      <p className="manager-queue-history-intro">
        Review queue tickets across their current statuses. Records refresh automatically.
      </p>

      <div className="manager-orders-workspace">
        <aside className="manager-orders-filter-panel" aria-label="Filter queue history">
          <div className="manager-orders-filter-heading">
            <div>
              <span className="manager-orders-filter-eyebrow">REFINE</span>
              <h2>Find tickets</h2>
            </div>
            <button type="button" onClick={clearFilters}>Clear</button>
          </div>
          <label className="manager-orders-filter-field">
            Date from
            <input type="date" value={filters.dateFrom} onChange={event => updateFilter('dateFrom', event.target.value)} />
          </label>
          <label className="manager-orders-filter-field">
            Date to
            <input type="date" value={filters.dateTo} onChange={event => updateFilter('dateTo', event.target.value)} />
          </label>
          <label className="manager-orders-filter-field">
            Status
            <select value={filters.status} onChange={event => updateFilter('status', event.target.value)}>
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="manager-orders-filter-field">
            Party group
            <select value={filters.group} onChange={event => updateFilter('group', event.target.value)}>
              <option value="">All groups</option>
              <option value="A">Group A · 1–2 people</option>
              <option value="B">Group B · 3–6 people</option>
              <option value="C">Group C · 7+ people</option>
            </select>
          </label>
          <label className="manager-orders-filter-field">
            Customer name
            <input type="search" placeholder="Name" value={filters.customerName} onChange={event => updateFilter('customerName', event.target.value)} />
          </label>
          <label className="manager-orders-filter-field">
            Table ID
            <input type="search" inputMode="numeric" placeholder="Any table" value={filters.tableId} onChange={event => updateFilter('tableId', event.target.value)} />
          </label>
          <label className="manager-orders-filter-field">
            Queue ID
            <input type="search" placeholder="Any ticket" value={filters.queueId} onChange={event => updateFilter('queueId', event.target.value)} />
          </label>
          <label className="manager-orders-filter-field">
            Party size
            <input type="number" min="1" placeholder="Any size" value={filters.partySize} onChange={event => updateFilter('partySize', event.target.value)} />
          </label>
          <p className="manager-orders-dinein-note">Queue status reflects each ticket’s current state.</p>
        </aside>

        <section className="manager-orders-results" aria-label="Queue history results" data-pagination-anchor>
          <div className="manager-orders-searchbar">
            <label>
              <span aria-hidden="true">⌕</span>
              <span className="visually-hidden">Search queue history</span>
              <input
                type="search"
                placeholder="Search customer, queue ID, table, group or status"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
            </label>
            <label className="manager-orders-sort">
              <span>Sort by</span>
              <select aria-label="Sort queue history" value={sortBy} onChange={event => setSortBy(event.target.value)}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="queueId">Queue ID</option>
                <option value="partyLarge">Party size: large to small</option>
                <option value="partySmall">Party size: small to large</option>
                <option value="customer">Customer name</option>
              </select>
            </label>
          </div>
          <p className="manager-orders-result-count">
            {filteredEntries.length} {filteredEntries.length === 1 ? 'ticket' : 'tickets'}
          </p>

          {error && <p className="error-text">{error} <button className="btn secondary" onClick={load}>Retry</button></p>}
          {loading && !error && <p className="manager-queue-history-empty">Loading queue history…</p>}
          {!loading && !error && filteredEntries.length === 0 && (
            <p className="manager-queue-history-empty">No queue tickets match these filters.</p>
          )}
          <div className="manager-queue-history-list">
            {pagination.pageItems.map(entry => (
              <article className="manager-queue-history-card" key={entry.queue_id}>
                <div className="manager-queue-history-primary">
                  <strong>{entry.queue_number || `Queue #${entry.queue_id}`}</strong>
                  <span>{entry.customer_name || 'Customer name unavailable'}</span>
                  <span className="manager-queue-history-group">Group {groupForPartySize(Number(entry.party_size))}</span>
                </div>
                <div className="manager-queue-history-details">
                  <span><strong>Party size:</strong> {entry.party_size} {Number(entry.party_size) === 1 ? 'person' : 'people'}</span>
                  <span><strong>Joined:</strong> {formatDateTime(entry.joined_at || entry.queue_date)}</span>
                  <span><strong>Called:</strong> {formatDateTime(entry.called_at)}</span>
                  <span><strong>Seated:</strong> {formatDateTime(entry.served_at)}</span>
                </div>
                <div className="manager-queue-history-meta">
                  <span className={`manager-queue-status manager-queue-status-${normalizeStatus(entry.status)}`}>
                    {statusLabel(entry.status)}
                  </span>
                  <strong>
                    {entry.table_number
                      ? `Table ${entry.table_number}`
                      : entry.assigned_table_number
                        ? `Assigned table ${entry.assigned_table_number}`
                        : 'No table assigned'}
                  </strong>
                </div>
              </article>
            ))}
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
