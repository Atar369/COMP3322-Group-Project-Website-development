import { useState, useMemo } from 'react';
import { orders as initialOrders, markOrderPaid } from '../../data/mockData';

// arrived is the terminal kitchen state; payment turns it to 'paid'
const NEXT = { pending: 'preparing', preparing: 'ready', ready: 'arrived' };
const ALL_STATUSES = ['all', 'pending', 'preparing', 'ready', 'arrived', 'paid'];

export default function ManagerOrders() {
  const [orders, setOrders] = useState(initialOrders);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  function advance(order_id) {
    setOrders(prev => prev.map(o => o.order_id === order_id ? { ...o, status: NEXT[o.status] || o.status } : o));
  }

  function handleMarkPaid(order_id) {
    markOrderPaid(order_id);
    setOrders(prev => prev.map(o => o.order_id === order_id ? { ...o, status: 'paid', payment_status: 'paid' } : o));
  }

  const filtered = useMemo(() => orders.filter(o => {
    const matchesSearch = search === '' || String(o.order_id).includes(search.trim());
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [orders, search, statusFilter]);

  return (
    <div className="page">
      <h1>Orders</h1>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="Search by order #"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '8px 10px', border: '1px solid var(--line)', fontFamily: 'var(--font-body)', fontSize: '0.9rem', width: 180 }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ALL_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={statusFilter === s ? 'btn' : 'btn secondary'}
              style={{ padding: '5px 12px', fontSize: '0.8rem', textTransform: 'capitalize' }}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <p style={{ color: '#6b6558' }}>No orders match your filter.</p>
      )}

      {filtered.map(o => (
        <div className="ticket-row" key={o.order_id}>
          <span className="name">Order #{o.order_id}</span>
          <span className="leader" />
          <span className={`badge ${o.status === 'paid' ? 'preparing' : o.status}`}>{o.status}</span>
          {NEXT[o.status] && (
            <button className="btn" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => advance(o.order_id)}>
              Advance status
            </button>
          )}
          {o.status === 'arrived' && (
            <button className="btn" style={{ padding: '4px 10px', fontSize: '0.8rem', background: 'var(--mustard)' }} onClick={() => handleMarkPaid(o.order_id)}>
              Mark as paid
            </button>
          )}
          <span className="desc">Total: ${o.total_amount}</span>
        </div>
      ))}
    </div>
  );
}
