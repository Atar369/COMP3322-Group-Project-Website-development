import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';

export default function OrderManagement() {
  const { items } = useCart();

  return (
    <div className="page">
      <h1>Order Management</h1>
      {items.length === 0 ? (
        <p>No active orders. <Link to="/menu">Start ordering</Link></p>
      ) : (
        <div className="card">
          <p>{items.length} item(s) in your cart</p>
          <Link to="/cart" style={{ color: 'var(--green)', fontWeight: 600 }}>View cart</Link>
        </div>
      )}
    </div>
  );
}
