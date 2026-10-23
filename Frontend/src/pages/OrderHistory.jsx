import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function OrderHistory() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (!user) return;
    api.get(`/orders/user/${user.user_id}`)
      .then(r => setOrders(Array.isArray(r.data) ? r.data : []))
      .catch(() => setOrders([]));
  }, [user]);

  return (
    <div className="page">
      <h1>Order History</h1>
      {orders.length === 0 ? (
        <p>No orders yet.</p>
      ) : (
        orders.map(o => (
          <div className="ticket-row" key={o.order_id}>
            <span className="name">Order #{o.order_id}</span>
            <span className="leader" />
            <span className={`badge ${o.payment_status === 'paid' ? 'preparing' : 'pending'}`}>{o.payment_status === 'paid' ? 'Paid' : o.status}</span>
            <span className="desc">Total: ${Number(o.total_amount).toFixed(2)}</span>
          </div>
        ))
      )}
    </div>
  );
}
