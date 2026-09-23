import { useState } from 'react';
import { orders as initialOrders } from '../../data/mockData';

const NEXT = { pending: 'preparing', preparing: 'ready', ready: 'completed' };

export default function ManagerOrders() {
  const [orders, setOrders] = useState(initialOrders);

  function advance(order_id) {
    setOrders(prev => prev.map(o => o.order_id === order_id ? { ...o, status: NEXT[o.status] || o.status } : o));
    // Real backend: PATCH /api/orders/:id { status }, then emit socket event to the customer's order room
  }

  return (
    <div className="page">
      <h1>Orders</h1>
      {orders.map(o => (
        <div className="ticket-row" key={o.order_id}>
          <span className="name">Order #{o.order_id}</span>
          <span className="leader" />
          <span className={`badge ${o.status}`}>{o.status}</span>
          {o.status !== 'completed' && o.status !== 'cancelled' && (
            <button className="btn" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => advance(o.order_id)}>
              Advance status
            </button>
          )}
          <span className="desc">Total: ${o.total_amount}</span>
        </div>
      ))}
    </div>
  );
}
