import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Pagination, { usePagination } from '../components/Pagination';

function formatDateTime(value) {
  const dateTime = String(value || '').replace('T', ' ');
  return { date: dateTime.slice(0, 10) || '—', time: dateTime.slice(11, 16) || '—' };
}

function groupOrdersIntoBills(orders) {
  const bills = new Map();
  orders.forEach(order => {
    const paymentStatus = order.payment_status === 'unpaid' ? 'unpaid' : 'paid';
    const tableKey = order.table_id ?? `order-${order.order_id}`;
    const paymentKey = paymentStatus === 'paid' ? order.updated_at || order.order_time || order.order_id : 'unpaid';
    const key = `${tableKey}-${paymentStatus}-${paymentKey}`;
    let bill = bills.get(key);
    if (!bill) {
      bill = {
        key, tableId: order.table_id, paymentStatus, orders: [], partySizes: new Map(),
        total: 0, orderTime: order.order_time, latestOrderTime: order.order_time,
      };
      bills.set(key, bill);
    }
    bill.orders.push(order);
    bill.total += Number(order.total_amount);
    if (new Date(order.order_time) < new Date(bill.orderTime)) bill.orderTime = order.order_time;
    if (new Date(order.order_time) > new Date(bill.latestOrderTime)) bill.latestOrderTime = order.order_time;
    const sessionKey = order.booking_id ? `booking-${order.booking_id}` : order.queue_id ? `queue-${order.queue_id}` : `order-${order.order_id}`;
    if (order.party_size != null && !bill.partySizes.has(sessionKey)) bill.partySizes.set(sessionKey, Number(order.party_size));
  });

  return [...bills.values()]
    .map(bill => ({
      ...bill,
      orders: bill.orders.sort((a, b) => a.order_id - b.order_id),
      partySize: [...bill.partySizes.values()].reduce((total, size) => total + size, 0),
    }))
    .sort((a, b) => new Date(b.latestOrderTime) - new Date(a.latestOrderTime));
}

export default function OrderHistory() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', paymentStatus: '', tableId: '', orderId: '', minimumTotal: '', maximumTotal: '' });

  useEffect(() => {
    if (!user) return;
    api.get(`/orders/history/${user.user_id}`)
      .then(response => {
        setOrders(Array.isArray(response.data) ? response.data : []);
        setError('');
      })
      .catch(() => {
        setOrders([]);
        setError('Unable to load order history. Please retry.');
      });
  }, [user]);

  const bills = useMemo(() => {
    const term = search.trim().toLowerCase();
    return groupOrdersIntoBills(orders).filter(bill => {
      const dates = bill.orders.map(order => String(order.order_time || '').slice(0, 10));
      const orderIds = bill.orders.map(order => String(order.order_id));
      const tableId = String(bill.tableId ?? '');
      const searchValues = [
        tableId,
        bill.paymentStatus,
        ...orderIds,
        ...dates,
      ];
      return (!(filters.dateFrom || filters.dateTo) || dates.some(date =>
        (!filters.dateFrom || date >= filters.dateFrom)
        && (!filters.dateTo || date <= filters.dateTo)
      ))
        && (!filters.paymentStatus || bill.paymentStatus === filters.paymentStatus)
        && (!filters.tableId || tableId.includes(filters.tableId.trim()))
        && (!filters.orderId || orderIds.some(id => id.includes(filters.orderId.trim())))
        && (filters.minimumTotal === '' || bill.total >= Number(filters.minimumTotal))
        && (filters.maximumTotal === '' || bill.total <= Number(filters.maximumTotal))
        && (!term || searchValues.some(value => value.toLowerCase().includes(term)));
    }).sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.orderTime) - new Date(b.orderTime);
      if (sortBy === 'totalHigh') return b.total - a.total;
      if (sortBy === 'totalLow') return a.total - b.total;
      if (sortBy === 'table') return Number(a.tableId || 0) - Number(b.tableId || 0);
      return new Date(b.latestOrderTime) - new Date(a.latestOrderTime);
    });
  }, [orders, filters, search, sortBy]);
  const pagination = usePagination(bills, `${JSON.stringify(filters)}|${search}|${sortBy}`);

  function updateFilter(name, value) {
    setFilters(previous => ({ ...previous, [name]: value }));
  }

  function clearFilters() {
    setSearch('');
    setSortBy('newest');
    setFilters({ dateFrom: '', dateTo: '', paymentStatus: '', tableId: '', orderId: '', minimumTotal: '', maximumTotal: '' });
  }

  return (
    <div className="page customer-history-page">
      <h1>Order History</h1>
      <p className="customer-history-intro">Review your dine-in orders and combined table bills.</p>
      <div className="manager-orders-workspace">
        <aside className="manager-orders-filter-panel" aria-label="Filter order history">
          <div className="manager-orders-filter-heading">
            <div><span className="manager-orders-filter-eyebrow">REFINE</span><h2>Find orders</h2></div>
            <button type="button" onClick={clearFilters}>Clear</button>
          </div>
          <label className="manager-orders-filter-field">Date from<input type="date" value={filters.dateFrom} onChange={event => updateFilter('dateFrom', event.target.value)} /></label>
          <label className="manager-orders-filter-field">Date to<input type="date" value={filters.dateTo} onChange={event => updateFilter('dateTo', event.target.value)} /></label>
          <label className="manager-orders-filter-field">
            Payment status
            <select value={filters.paymentStatus} onChange={event => updateFilter('paymentStatus', event.target.value)}>
              <option value="">All statuses</option><option value="paid">Paid</option><option value="unpaid">Unpaid</option>
            </select>
          </label>
          <label className="manager-orders-filter-field">Table ID<input type="search" inputMode="numeric" placeholder="Any table" value={filters.tableId} onChange={event => updateFilter('tableId', event.target.value)} /></label>
          <label className="manager-orders-filter-field">Order ID<input type="search" inputMode="numeric" placeholder="Any order" value={filters.orderId} onChange={event => updateFilter('orderId', event.target.value)} /></label>
          <div className="manager-orders-filter-field">
            <span>Total charge</span>
            <div className="manager-orders-range-fields">
              <label><span className="visually-hidden">Minimum total</span><input type="number" min="0" placeholder="Min $" value={filters.minimumTotal} onChange={event => updateFilter('minimumTotal', event.target.value)} /></label>
              <label><span className="visually-hidden">Maximum total</span><input type="number" min="0" placeholder="Max $" value={filters.maximumTotal} onChange={event => updateFilter('maximumTotal', event.target.value)} /></label>
            </div>
          </div>
          <p className="manager-orders-dinein-note">Orders are grouped by table bill and payment status.</p>
        </aside>
        <section className="manager-orders-results" aria-label="Order history results" data-pagination-anchor>
          <div className="manager-orders-searchbar">
            <label><span aria-hidden="true">⌕</span><span className="visually-hidden">Search order history</span>
              <input type="search" placeholder="Search table, order ID, date or status" value={search} onChange={event => setSearch(event.target.value)} />
            </label>
            <label className="manager-orders-sort"><span>Sort by</span>
              <select aria-label="Sort order history" value={sortBy} onChange={event => setSortBy(event.target.value)}>
                <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
                <option value="totalHigh">Total: high to low</option><option value="totalLow">Total: low to high</option><option value="table">Table ID</option>
              </select>
            </label>
          </div>
          <p className="manager-orders-result-count">{bills.length} {bills.length === 1 ? 'bill' : 'bills'}</p>
          {error && <p className="error-text">{error}</p>}
          {!error && bills.length === 0 && <p className="manager-queue-history-empty">{orders.length ? 'No orders match these filters.' : 'No orders yet.'}</p>}
          <div className="order-history-list">
            {pagination.pageItems.map(bill => {
              const { date, time } = formatDateTime(bill.orderTime);
              return (
                <article className="customer-order-history-card" key={bill.key}>
                  <div className="order-history-identity">
                    <strong>Table {bill.tableId ?? '—'}</strong>
                    <span>{bill.orders.map(order => `Order #${order.order_id}`).join(', ')}</span>
                  </div>
                  <div className="order-history-details">
                    <span><strong>Date:</strong> {date}</span><span><strong>Time:</strong> {time}</span>
                    <span><strong>Party:</strong> {bill.partySize || '—'} people</span>
                    <span><strong>Orders:</strong> {bill.orders.length}</span>
                  </div>
                  <div className="order-history-total">
                    <strong>Total: ${bill.total.toFixed(2)}</strong>
                    <span className={`badge ${bill.paymentStatus}`}>{bill.paymentStatus}</span>
                  </div>
                </article>
              );
            })}
          </div>
          <Pagination
            page={pagination.page}
            pageCount={pagination.pageCount}
            totalItems={bills.length}
            onPageChange={pagination.setPage}
          />
        </section>
      </div>
    </div>
  );
}
