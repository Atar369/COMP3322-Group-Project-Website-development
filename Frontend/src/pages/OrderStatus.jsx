import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import OrderStatusTracker from '../components/OrderStatusTracker';

export default function OrderStatus() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  function load() {
    api.get(`/orders/${id}`)
      .then(r => setOrder(r.data))
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  // Derive session status from the linked booking or queue
  function getSessionStatus() {
    if (!order) return 'serving';
    if (order.booking_status) return order.booking_status;
    if (order.queue_status) return order.queue_status;
    return 'serving';
  }

  async function handleFinishAndPay() {
    // Tell the backend to mark the booking/queue as finished
    if (order.booking_id) {
      await api.patch(`/booking/${order.booking_id}/finish`);
    }
    if (order.queue_id) {
      await api.patch(`/queue/${order.queue_id}/finish`);
    }
    load();
  }

  if (loading) return <div className="page"><p>Loading...</p></div>;
  if (!order) return <div className="page"><h1>Order not found</h1></div>;

  const sessionStatus = getSessionStatus();

  return (
    <div className="page">
      <h1>Order #{order.order_id}</h1>
      <OrderStatusTracker status={sessionStatus} />
      <div className="card">
        {order.items?.map(l => (
          <div className="ticket-row" key={l.order_item_id}>
            <span className="name">{l.name}</span>
            <span className="leader" />
            <span className="price">${Number(l.subtotal).toFixed(2)}</span>
            <span className="desc">Qty: {l.quantity}</span>
          </div>
        ))}
        <div className="ticket-row" style={{ borderBottom: 'none', marginTop: 4 }}>
          <span className="name" style={{ fontWeight: 700 }}>Total</span>
          <span className="leader" />
          <span className="price" style={{ fontWeight: 700 }}>${Number(order.total_amount).toFixed(2)}</span>
        </div>
      </div>

      {sessionStatus === 'serving' && (
        <div style={{ marginTop: 20 }}>
          <button className="btn" onClick={handleFinishAndPay} style={{ width: '100%', padding: '12px', fontSize: '1rem' }}>
            Finish &amp; Pay
          </button>
          <p style={{ color: '#6b6558', fontSize: '0.82rem', marginTop: 8, textAlign: 'center' }}>
            Click when you are ready to pay. The manager will be notified to come to your table.
          </p>
        </div>
      )}

      {sessionStatus === 'finished' && (
        <div className="card" style={{ marginTop: 20, borderColor: 'var(--mustard)', textAlign: 'center', padding: 20 }}>
          <p style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>⏳ Awaiting Payment</p>
          <p style={{ color: '#6b6558', fontSize: '0.88rem', marginTop: 6 }}>The manager has been notified and will be with you shortly to collect payment.</p>
        </div>
      )}

      {sessionStatus === 'paid' && (
        <div className="card" style={{ marginTop: 20, borderColor: 'var(--green)', textAlign: 'center', padding: 20 }}>
          <p style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0, color: 'var(--green)' }}>✓ Paid — Thank you for dining with us!</p>
        </div>
      )}
    </div>
  );
}
