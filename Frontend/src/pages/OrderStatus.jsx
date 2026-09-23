import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { orders, order_items, menu_items } from '../data/mockData';
import OrderStatusTracker from '../components/OrderStatusTracker';

const NEXT_STATUS = { pending: 'preparing', preparing: 'ready', ready: 'completed', completed: 'completed' };

export default function OrderStatus() {
  const { id } = useParams();
  const order = orders.find(o => o.order_id === Number(id));
  const [status, setStatus] = useState(order?.status || 'pending');

  // --- Real backend hookup point ---
  // useEffect(() => {
  //   const socket = io('http://localhost:5000');
  //   socket.on(`order:${id}:status`, (newStatus) => setStatus(newStatus));
  //   return () => socket.disconnect();
  // }, [id]);
  //
  // For now, simulate the kitchen advancing the order every few seconds:
  useEffect(() => {
    const timer = setInterval(() => {
      setStatus(prev => NEXT_STATUS[prev]);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  if (!order) return <div className="page"><h1>Order not found</h1></div>;

  const lines = order_items.filter(oi => oi.order_id === order.order_id);

  return (
    <div className="page">
      <h1>Order #{order.order_id}</h1>
      <OrderStatusTracker status={status} />
      <div className="card">
        {lines.map(l => {
          const item = menu_items.find(m => m.item_id === l.item_id);
          return (
            <div className="ticket-row" key={l.order_item_id}>
              <span className="name">{item?.name}</span>
              <span className="leader" />
              <span className="price">${l.subtotal}</span>
            </div>
          );
        })}
        <p style={{ marginTop: 12, fontWeight: 600 }}>Total: ${order.total_amount}</p>
      </div>
    </div>
  );
}
