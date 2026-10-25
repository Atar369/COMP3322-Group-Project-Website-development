import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';
import Pagination, { usePagination } from '../../components/Pagination';

const DINING_SESSION_MS = 60 * 60 * 1000;

function formatDateTime(value) {
  if (!value) return '—';
  const normalized = String(value).replace('T', ' ');
  return `${normalized.slice(0, 10)} ${normalized.slice(11, 16)}`;
}

function formatTimeRemaining(remainingMs) {
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')} min ${String(seconds).padStart(2, '0')} sec remaining`;
}

function normalizeDate(value) {
  return value ? String(value).slice(0, 10) : '';
}

function matchesFilters(record, filters, search) {
  const orderDates = record.orders.map(order => normalizeDate(order.order_time));
  const hasDateInRange = orderDates.some(date =>
    (!filters.dateFrom || date >= filters.dateFrom)
    && (!filters.dateTo || date <= filters.dateTo)
  );
  if ((filters.dateFrom || filters.dateTo) && !hasDateInRange) return false;

  const customerName = (record.customerName || '').toLowerCase();
  if (filters.customerName && !customerName.includes(filters.customerName.toLowerCase())) return false;

  const tableIds = [record.tableId, record.tableNumber].filter(value => value != null).map(String);
  if (filters.tableId && !tableIds.some(value => value.includes(filters.tableId.trim()))) return false;

  const orderIds = record.orders.map(order => String(order.order_id));
  if (filters.orderId && !orderIds.some(value => value.includes(filters.orderId.trim()))) return false;

  if (filters.partySize && Number(record.partySize) !== Number(filters.partySize)) return false;
  if (filters.minimumTotal !== '' && record.total < Number(filters.minimumTotal)) return false;
  if (filters.maximumTotal !== '' && record.total > Number(filters.maximumTotal)) return false;

  const allItems = record.orders.flatMap(order => order.items);
  if (filters.foodItem && !allItems.some(item => item.name === filters.foodItem)) return false;

  const term = search.trim().toLowerCase();
  if (!term) return true;
  const searchValues = [
    customerName,
    ...tableIds,
    ...orderIds,
    ...record.orders.flatMap(order => [
      normalizeDate(order.order_time),
      ...order.items.map(item => item.name.toLowerCase()),
    ]),
  ];
  return searchValues.some(value => value.includes(term));
}

function groupByTable(sessions) {
  const tables = new Map();
  sessions.forEach(session => {
    const table = tables.get(session.table_id) || {
      tableId: session.table_id,
      tableNumber: session.table_number,
      customers: new Set(),
      sessions: [],
      orders: new Map(),
    };
    table.sessions.push(session);
    if (session.customer_name) table.customers.add(session.customer_name);
    session.orders.forEach(order => {
      const existing = table.orders.get(order.order_id);
      if (existing) {
        existing.items.push(...order.items);
      } else {
        table.orders.set(order.order_id, { ...order, items: [...order.items] });
      }
    });
    tables.set(session.table_id, table);
  });

  return [...tables.values()]
    .map(table => ({
      ...table,
      customerName: [...table.customers].join(', '),
      sessions: table.sessions.sort((a, b) => new Date(a.served_at) - new Date(b.served_at)),
      orders: [...table.orders.values()].sort((a, b) => a.order_id - b.order_id),
    }))
    .filter(table => table.orders.length > 0)
    .sort((a, b) => a.tableNumber - b.tableNumber);
}

export default function ManagerOrders() {
  const [sessions, setSessions] = useState([]);
  const [paidOrders, setPaidOrders] = useState([]);
  const [activeView, setActiveView] = useState('active');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    foodItem: '',
    minimumTotal: '',
    maximumTotal: '',
    customerName: '',
    tableId: '',
    orderId: '',
    partySize: '',
  });
  const [error, setError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [paying, setPaying] = useState({});
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      const response = await api.get('/orders');
      setSessions(Array.isArray(response.data) ? response.data : []);
      setError('');
    } catch {
      setError('Unable to load active table orders. Please retry.');
    }
  }, []);

  const loadPaidOrders = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await api.get('/orders/manager/history');
      setPaidOrders(Array.isArray(response.data) ? response.data : []);
      setHistoryError('');
    } catch (requestError) {
      setHistoryError(requestError.response?.data?.error || 'Unable to load paid order history. Please retry.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const refresh = setInterval(load, 5000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(refresh);
      clearInterval(clock);
    };
  }, [load]);

  useEffect(() => {
    if (activeView !== 'history') return undefined;
    loadPaidOrders();
    const refresh = setInterval(loadPaidOrders, 15000);
    return () => clearInterval(refresh);
  }, [activeView, loadPaidOrders]);

  async function handleMarkPaid(table) {
    if (paying[table.tableId]) return;
    const bookings = table.sessions.filter(session => session.session_type === 'booking');
    const queues = table.sessions.filter(session => session.session_type === 'queue');
    if (table.sessions.some(session => session.session_status !== 'finished')) return;

    setPaying(previous => ({ ...previous, [table.tableId]: true }));
    setError('');
    try {
      const payments = [];
      if (bookings.length > 0) {
        payments.push(api.patch(`/booking/${bookings[0].session_id}/pay`));
      }
      queues.forEach(session => payments.push(api.patch(`/queue/${session.session_id}/pay`)));
      await Promise.all(payments);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to mark this table as paid. Please retry.');
      await load();
    } finally {
      setPaying(previous => ({ ...previous, [table.tableId]: false }));
    }
  }

  const activeTables = groupByTable(sessions);
  const allMenuItemNames = useMemo(() => [...new Set([
    ...sessions.flatMap(session => session.orders.flatMap(order => order.items.map(item => item.name))),
    ...paidOrders.flatMap(order => order.items.map(item => item.name)),
  ])].sort((a, b) => a.localeCompare(b)), [sessions, paidOrders]);
  const activeTableRecords = useMemo(() => activeTables.map(table => ({
    ...table,
    total: table.orders.reduce((sum, order) => sum + Number(order.total_amount), 0),
    partySize: table.sessions.reduce((sum, session) => sum + Number(session.party_size), 0),
    firstOrderTime: Math.min(...table.orders.map(order => new Date(order.order_time).getTime())),
    lastOrderTime: Math.max(...table.orders.map(order => new Date(order.order_time).getTime())),
  })).filter(table => matchesFilters(table, filters, search))
    .sort((a, b) => {
      if (sortBy === 'oldest') return a.firstOrderTime - b.firstOrderTime;
      if (sortBy === 'totalHigh') return b.total - a.total;
      if (sortBy === 'totalLow') return a.total - b.total;
      if (sortBy === 'table') return Number(a.tableNumber || a.tableId) - Number(b.tableNumber || b.tableId);
      return b.lastOrderTime - a.lastOrderTime;
    }), [activeTables, filters, search, sortBy]);
  const filteredPaidOrders = useMemo(() => paidOrders.map(order => ({
    ...order,
    total: Number(order.total_amount),
    partySize: Number(order.party_size) || 0,
    customerName: order.customer_name,
    tableId: order.table_id,
    tableNumber: order.table_number,
    orders: [order],
  })).filter(order => matchesFilters(order, filters, search))
    .sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.order_time) - new Date(b.order_time);
      if (sortBy === 'totalHigh') return b.total - a.total;
      if (sortBy === 'totalLow') return a.total - b.total;
      if (sortBy === 'customer') return a.customerName.localeCompare(b.customerName);
      if (sortBy === 'table') return Number(a.tableNumber || a.tableId) - Number(b.tableNumber || b.tableId);
      return new Date(b.order_time) - new Date(a.order_time);
    }), [paidOrders, filters, search, sortBy]);
  const paginationResetKey = `${activeView}|${JSON.stringify(filters)}|${search}|${sortBy}`;
  const activePagination = usePagination(activeTableRecords, paginationResetKey);
  const historyPagination = usePagination(filteredPaidOrders, paginationResetKey);

  function updateFilter(key, value) {
    setFilters(previous => ({ ...previous, [key]: value }));
  }

  function clearFilters() {
    setSearch('');
    setSortBy('newest');
    setFilters({
      dateFrom: '',
      dateTo: '',
      foodItem: '',
      minimumTotal: '',
      maximumTotal: '',
      customerName: '',
      tableId: '',
      orderId: '',
      partySize: '',
    });
  }

  return (
    <div className="page manager-orders-page">
      <h1>Orders</h1>
      <p style={{ color: '#6b6558', fontSize: '0.85rem', marginBottom: 20 }}>
        Active table orders and accumulated totals refresh automatically. Mark a table as paid after collecting payment.
      </p>

      <div className="manager-orders-tabs" role="tablist" aria-label="Order views">
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'active'}
          className={activeView === 'active' ? 'is-active' : ''}
          onClick={() => {
            setActiveView('active');
            if (sortBy === 'customer') setSortBy('newest');
          }}
        >
          Active Orders
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'history'}
          className={activeView === 'history' ? 'is-active' : ''}
          onClick={() => setActiveView('history')}
        >
          Order History
        </button>
      </div>

      <div className="manager-orders-workspace">
        <aside className="manager-orders-filter-panel" aria-label="Filter orders">
          <div className="manager-orders-filter-heading">
            <div>
              <span className="manager-orders-filter-eyebrow">REFINE</span>
              <h2>Find orders</h2>
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
            Food item
            <select value={filters.foodItem} onChange={event => updateFilter('foodItem', event.target.value)}>
              <option value="">Any food item</option>
              {allMenuItemNames.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <div className="manager-orders-filter-field">
            <span>Total charge</span>
            <div className="manager-orders-range-fields">
              <label>
                <span className="visually-hidden">Minimum total</span>
                <input type="number" min="0" step="0.01" placeholder="Min $" value={filters.minimumTotal} onChange={event => updateFilter('minimumTotal', event.target.value)} />
              </label>
              <label>
                <span className="visually-hidden">Maximum total</span>
                <input type="number" min="0" step="0.01" placeholder="Max $" value={filters.maximumTotal} onChange={event => updateFilter('maximumTotal', event.target.value)} />
              </label>
            </div>
          </div>
          <label className="manager-orders-filter-field">
            Customer name
            <input type="search" placeholder="Name" value={filters.customerName} onChange={event => updateFilter('customerName', event.target.value)} />
          </label>
          <label className="manager-orders-filter-field">
            Table ID
            <input type="search" inputMode="numeric" placeholder="Any table" value={filters.tableId} onChange={event => updateFilter('tableId', event.target.value)} />
          </label>
          <label className="manager-orders-filter-field">
            Order ID
            <input type="search" inputMode="numeric" placeholder="Any order" value={filters.orderId} onChange={event => updateFilter('orderId', event.target.value)} />
          </label>
          <label className="manager-orders-filter-field">
            Party size
            <input type="number" min="1" placeholder="Any size" value={filters.partySize} onChange={event => updateFilter('partySize', event.target.value)} />
          </label>
          <p className="manager-orders-dinein-note">Dine-in service · table details are shown where recorded.</p>
        </aside>

        <div className="manager-orders-results" data-pagination-anchor>
          <div className="manager-orders-searchbar">
            <label>
              <span aria-hidden="true">⌕</span>
              <span className="visually-hidden">Search orders</span>
              <input type="search" placeholder="Search customer, dish, table, order ID or date" value={search} onChange={event => setSearch(event.target.value)} />
            </label>
            <label className="manager-orders-sort">
              <span>Sort by</span>
              <select aria-label="Sort results" value={sortBy} onChange={event => setSortBy(event.target.value)}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="totalHigh">Total: high to low</option>
                <option value="totalLow">Total: low to high</option>
                <option value="table">Table ID</option>
                {activeView === 'history' && <option value="customer">Customer name</option>}
              </select>
            </label>
          </div>
          <p className="manager-orders-result-count">
            {activeView === 'active'
              ? `${activeTableRecords.length} active ${activeTableRecords.length === 1 ? 'table' : 'tables'}`
              : `${filteredPaidOrders.length} paid ${filteredPaidOrders.length === 1 ? 'order' : 'orders'}`}
          </p>

      {activeView === 'active' ? (
        <>
          {error && <p className="error-text">{error}</p>}
          {activeTableRecords.length === 0 && !error && <p style={{ color: '#6b6558' }}>No active orders match these filters.</p>}
          <div className="manager-table-orders">
            {activePagination.pageItems.map(table => {
          const tableOrders = table.orders;
          const total = table.total;
          const partySize = table.partySize;
          const specialRequests = table.sessions
            .map(session => session.special_request?.trim())
            .filter(Boolean);
          const allFinished = table.sessions.every(session => session.session_status === 'finished');
          const earliestServedAt = table.sessions
            .map(session => session.served_at ? new Date(session.served_at).getTime() : NaN)
            .filter(servedAt => Number.isFinite(servedAt))
            .reduce((earliest, servedAt) => Math.min(earliest, servedAt), Infinity);
          const hasSeatingTime = Number.isFinite(earliestServedAt);
          const remainingMs = hasSeatingTime
            ? Math.max(0, DINING_SESSION_MS - (now - earliestServedAt))
            : null;
          const diningTimeLabel = !hasSeatingTime
            ? 'Payment requested — collect payment.'
            : remainingMs > 0
              ? formatTimeRemaining(remainingMs)
              : '⚠ Customer has been seated for 1 hour — collect payment.';
          const orderDateTimes = tableOrders.map(order => formatDateTime(order.order_time)).join(', ');
          const foodItems = new Map();
          tableOrders.forEach(order => order.items.forEach(item => {
            const existing = foodItems.get(item.name);
            if (existing) existing.quantity += Number(item.quantity);
            else foodItems.set(item.name, { quantity: Number(item.quantity) });
          }));

              return (
                <article className="manager-table-order-card" key={table.tableId}>
              <div className="manager-table-order-primary">
                <strong className="manager-table-order-title">Table {table.tableId}</strong>
                {tableOrders.map(order => (
                  <span className="manager-table-order-line" key={order.order_id}>
                    Order #{order.order_id} · ${Number(order.total_amount).toFixed(2)}
                  </span>
                ))}
              </div>

              <div className="manager-table-order-details">
                <span><strong>Customer:</strong> {table.customerName || '—'}</span>
                <span><strong>Date / Time:</strong> {orderDateTimes || '—'}</span>
                <span><strong>Party size:</strong> {partySize} people</span>
                {specialRequests.map((request, index) => (
                  <span key={`${request}-${index}`}><strong>Special request:</strong> {request}</span>
                ))}
                <div className="manager-table-food">
                  <strong>Food items</strong>
                  {foodItems.size === 0
                    ? <span>No food items on active orders.</span>
                    : [...foodItems].map(([name, item]) => (
                      <span key={name}>{name} × {item.quantity}</span>
                    ))}
                </div>
              </div>

              <div className="manager-table-order-controls">
                <strong>Accumulated Total: ${total.toFixed(2)}</strong>
                <span className={remainingMs > 0 ? 'manager-table-time' : 'manager-table-time warning'}>
                  {diningTimeLabel}
                </span>
                <button
                  className="order-btn pay"
                  disabled={!allFinished || paying[table.tableId]}
                  onClick={() => handleMarkPaid(table)}
                  title={allFinished ? 'Mark this table as paid' : 'Available after this table requests payment'}
                >
                  {paying[table.tableId] ? 'Processing…' : 'Mark as paid'}
                </button>
              </div>
                </article>
              );
            })}
          </div>
          <Pagination
            page={activePagination.page}
            pageCount={activePagination.pageCount}
            totalItems={activeTableRecords.length}
            onPageChange={activePagination.setPage}
          />
        </>
      ) : (
        <section role="tabpanel" aria-label="Order History">
          <p style={{ color: '#6b6558', fontSize: '0.85rem', margin: '0 0 16px' }}>
            Paid orders for review, including table, customer, items, and payment time.
          </p>
          {historyError && <p className="error-text">{historyError}</p>}
          {historyLoading && paidOrders.length === 0 && !historyError && (
            <p style={{ color: '#6b6558' }}>Loading paid orders…</p>
          )}
          {!historyLoading && filteredPaidOrders.length === 0 && !historyError && (
            <p style={{ color: '#6b6558' }}>No paid orders match these filters.</p>
          )}
          <div className="manager-table-orders">
            {historyPagination.pageItems.map(order => (
              <article className="manager-order-history-card" key={order.order_id}>
                <div className="manager-table-order-primary">
                  <strong className="manager-table-order-title">
                    {order.table_number ? `Table ${order.table_number}` : order.table_id ? `Table ${order.table_id}` : 'Table not recorded'}
                  </strong>
                  <span className="manager-table-order-line">Order #{order.order_id}</span>
                  <span className="manager-table-order-line">{order.customer_name}</span>
                </div>
                <div className="manager-table-order-details">
                  <span><strong>Paid:</strong> {formatDateTime(order.paid_at)}</span>
                  <span><strong>Ordered:</strong> {formatDateTime(order.order_time)}</span>
                  {order.booking_date && (
                    <span><strong>Booking:</strong> {String(order.booking_date).slice(0, 10)} {String(order.booking_time || '').slice(0, 5)}</span>
                  )}
                  {order.queue_number && <span><strong>Queue:</strong> {order.queue_number}</span>}
                  {order.party_size && <span><strong>Party size:</strong> {order.party_size} people</span>}
                  {order.special_request && <span><strong>Special request:</strong> {order.special_request}</span>}
                  <div className="manager-table-food">
                    <strong>Food items</strong>
                    {order.items.length === 0
                      ? <span>No items recorded.</span>
                      : order.items.map(item => (
                        <span key={item.order_item_id}>
                          {item.name} × {item.quantity} · ${Number(item.subtotal).toFixed(2)}
                        </span>
                      ))}
                  </div>
                </div>
                <div className="manager-order-history-total">
                  <strong>Total: ${Number(order.total_amount).toFixed(2)}</strong>
                  <span className="manager-order-paid-badge">Paid</span>
                </div>
              </article>
            ))}
          </div>
          <Pagination
            page={historyPagination.page}
            pageCount={historyPagination.pageCount}
            totalItems={filteredPaidOrders.length}
            onPageChange={historyPagination.setPage}
          />
        </section>
      )}
        </div>
      </div>
    </div>
  );
}
