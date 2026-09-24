import { orders } from '../data/mockData';
import { useAuth } from '../context/AuthContext';

export default function OrderHistory() {
  const { user } = useAuth();
  const userOrders = orders.filter(o => o.user_id === user.user_id);

  return (
    <div className="page">
      <h1>Order History</h1>
      {userOrders.length === 0 ? (
        <p>No orders yet.</p>
      ) : (
        userOrders.map(o => (
          <div className="ticket-row" key={o.order_id}>
            <span className="name">Order #{o.order_id}</span>
            <span className="leader" />
            <span className={`badge ${o.status}`}>{o.status}</span>
            <span className="desc">Total: ${o.total_amount}</span>
          </div>
        ))
      )}
    </div>
  );
}
