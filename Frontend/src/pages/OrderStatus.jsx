import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { orders, order_items, menu_items } from '../data/mockData';
import OrderStatusTracker from '../components/OrderStatusTracker';

const NEXT_STATUS = { pending: 'preparing', preparing: 'ready', ready: 'arrived' };

export default function OrderStatus() {
  const { id } = useParams();
  const order = orders.find(o => o.order_id === Number(id));
  const [status, setStatus] = useState(order?.status || 'pending');
  const [requestedPay, setRequestedPay] = useState(false);
  const [paid, setPaid] = useState(false);

  // Simulate kitchen advancing through pending → preparing → ready → arrived
  useEffect(() => {
    const timer = setInterval(() => {
      setStatus(prev => NEXT_STATUS[prev] || prev);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // After customer taps Finish & Pay, auto-transition to paid after 3 seconds
  useEffect(() => {
    if (!requestedPay) return;
    const timer = setTimeout(() => setPaid(true), 3000);
    return () => clearTimeout(timer);
  }, [requestedPay]);

  if (!order) return <div className="page"><h1>Order not found</h1></div>;

  const lines = order_items.filter(oi => oi.order_id === order.order_id);

  return (
    <div className="page">
      <h1>Order #{order.order_id}</h1>
      <OrderStatusTracker status={requestedPay ? 'pay now' : status} />
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
        <div className="ticket-row" style={{ borderBottom: 'none', marginTop: 4 }}>
          <span className="name" style={{ fontWeight: 700 }}>Total</span>
          <span className="leader" />
          <span className="price" style={{ fontWeight: 700 }}>${order.total_amount}</span>
          {status === 'arrived' && !requestedPay && (
            <button className="btn" style={{ padding: '6px 16px', fontSize: '0.85rem' }} onClick={() => setRequestedPay(true)}>
              Finish &amp; Pay
            </button>
          )}
          {requestedPay && (
            paid
              ? <span className="badge preparing">✓ Paid — See you again!</span>
              : <span className="badge preparing">Awaiting payment</span>
          )}
        </div>
      </div>
    </div>
  );
}
