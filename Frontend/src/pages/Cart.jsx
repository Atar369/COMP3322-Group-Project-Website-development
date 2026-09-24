import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { createOrder, getBooking, getQueue, isQueueCalled } from '../data/mockData';

export default function Cart() {
  const { items, removeItem, clearCart, total, orderContext } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  function handlePlaceOrder() {
    const bookingId = orderContext?.bookingId || null;
    const queueId = orderContext?.queueId || null;
    const orderId = createOrder(user.user_id, items, bookingId, queueId);
    clearCart();
    navigate(`/orders/${orderId}`);
  }

  function canPlaceOrder() {
    if (!orderContext) return false;
    if (orderContext.type === 'booking') {
      const booking = getBooking(orderContext.bookingId);
      if (!booking) return false;
      const now = new Date();
      const bookingDT = new Date(`${booking.booking_date}T${booking.booking_time}`);
      return now >= bookingDT;
    }
    if (orderContext.type === 'queue') {
      return isQueueCalled(orderContext.queueId);
    }
    return false;
  }

  if (items.length === 0) {
    return <div className="page"><h1>Your order</h1><p>Your cart is empty. Head back to the menu to add something.</p></div>;
  }

  const placeOrderDisabled = !canPlaceOrder();
  const disabledReason = orderContext
    ? (orderContext.type === 'booking'
        ? 'Booking time not reached yet'
        : 'Queue ID not yet called')
    : 'No booking or queue selected';

  return (
    <div className="page">
      <h1>Your order</h1>
      {items.map(i => (
        <div className="ticket-row" key={i.item_id}>
          <span className="name">{i.name}</span>
          <span className="leader" />
          <span className="price">${i.price * i.qty}</span>
          <button className="btn secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => removeItem(i.item_id)}>Remove</button>
          <span className="desc">Qty: {i.qty}</span>
        </div>
      ))}
      <p style={{ marginTop: 20, fontSize: '1.1rem', fontWeight: 600 }}>Total: ${total}</p>
      <button
        className="btn"
        onClick={handlePlaceOrder}
        disabled={placeOrderDisabled}
        title={placeOrderDisabled ? disabledReason : ''}
        style={{ opacity: placeOrderDisabled ? 0.6 : 1, cursor: placeOrderDisabled ? 'not-allowed' : 'pointer' }}
      >
        Place order
      </button>
      {placeOrderDisabled && (
        <p style={{ color: 'var(--rust)', fontSize: '0.85rem', marginTop: 8 }}>
          ⚠️ {disabledReason}
        </p>
      )}
    </div>
  );
}
