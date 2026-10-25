import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import useOrderWindow from '../hooks/useOrderWindow';
import OrderWindowNotice from '../components/OrderWindowNotice';
import Pagination, { usePagination } from '../components/Pagination';

export default function Cart() {
  const { items, removeItem, clearCart, total, orderContext } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const orderWindow = useOrderWindow(user, orderContext);
  const pagination = usePagination(items);

  async function handlePlaceOrder() {
    if (!orderWindow.canOrder) return;
    const orderItems = items.map(i => ({
      item_id: i.item_id,
      quantity: i.qty,
      unit_price: i.price,
    }));
    try {
      const res = await api.post('/orders', {
        user_id: user.user_id,
        booking_id: orderContext?.bookingId || null,
        queue_id: orderContext?.queueId || null,
        items: orderItems,
      });
      clearCart();
      navigate(`/orders/${res.data.orderId}`);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to place order. Please try again.');
    }
  }

  if (items.length === 0) {
    return (
      <div className="page">
        <h1>Your cart</h1>
        <OrderWindowNotice orderWindow={orderWindow} />
        <p>Your cart is empty. Head back to the menu to add something.</p>
      </div>
    );
  }

  const canOrder = orderWindow.canOrder;

  return (
    <div className="page">
      <h1>Your cart</h1>
      <OrderWindowNotice orderWindow={orderWindow} />
      <div data-pagination-anchor>
      {pagination.pageItems.map(i => (
        <div className="ticket-row" key={i.item_id}>
          <span className="name">{i.name}</span>
          <span className="leader" />
          <span className="price">${i.price * i.qty}</span>
          <button className="btn secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => removeItem(i.item_id)}>Remove</button>
          <span className="desc">Qty: {i.qty}</span>
        </div>
      ))}
      <Pagination
        page={pagination.page}
        pageCount={pagination.pageCount}
        totalItems={items.length}
        onPageChange={pagination.setPage}
      />
      </div>
      <p style={{ marginTop: 20, fontSize: '1.1rem', fontWeight: 600 }}>Total: ${total}</p>
      <button
        className="btn"
        onClick={handlePlaceOrder}
        disabled={!canOrder}
        style={{ opacity: canOrder ? 1 : 0.6, cursor: canOrder ? 'pointer' : 'not-allowed' }}
      >
        Place order
      </button>
      {!canOrder && (
        <p style={{ color: 'var(--rust)', fontSize: '0.85rem', marginTop: 8 }}>
          {orderWindow.hasOrderContext
            ? 'Ordering is unavailable because this session has ended, the last-order window is closed, or it is past 21:00.'
            : '⚠️ Unlock ordering from the Orders & Cart page first'}
        </p>
      )}
    </div>
  );
}
