import { useState } from 'react';
import { orders as initialOrders, markOrderPaid } from '../../data/mockData';

// arrived is the terminal kitchen state; payment turns it to 'paid'
const NEXT = { pending: 'preparing', preparing: 'ready', ready: 'arrived' };

export default function ManagerOrders() {
  const [orders, setOrders] = useState(initialOrders);

  function advance(order_id) {
    setOrders(prev => prev.map(o => o.order_id === order_id ? { ...o, status: NEXT[o.status] || o.status } : o));
  }

  function handleMarkPaid(order_id) {
    markOrderPaid(order_id);
    setOrders(prev => prev.map(o => o.order_id === order_id ? { ...o, status: 'paid', payment_status: 'paid' } : o));
  }

  return (
    <div className="page">
      <h1>Orders</h1>
      {orders.map(o => (
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
