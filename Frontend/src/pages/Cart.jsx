import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { createOrder } from '../data/mockData';

export default function Cart() {
  const { items, removeItem, clearCart, total } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  function handlePlaceOrder() {
    const orderId = createOrder(user.user_id, items);
    clearCart();
    navigate(`/orders/${orderId}`);
  }

  if (items.length === 0) {
    return <div className="page"><h1>Your order</h1><p>Your cart is empty. Head back to the menu to add something.</p></div>;
  }

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
      <button className="btn" onClick={handlePlaceOrder}>Place order</button>
    </div>
  );
}
