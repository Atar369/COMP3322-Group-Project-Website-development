import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <nav className="nav">
      <Link to="/" className="brand">The Kitchen Ledger</Link>
      <div className="nav-links">
        {!user && <>
          <Link to="/login">Log in</Link>
          <Link to="/register">Register</Link>
        </>}
        {user && user.role === 'customer' && <>
          <Link to="/menu">Menu</Link>
          <Link to="/cart">Cart</Link>
          <Link to="/queue">Queue</Link>
          <Link to="/booking">Book a table</Link>
          <button onClick={handleLogout}>Log out</button>
        </>}
        {user && user.role === 'manager' && <>
          <Link to="/manager/menu">Menu</Link>
          <Link to="/manager/orders">Orders</Link>
          <Link to="/manager/queue">Queue</Link>
          <Link to="/manager/bookings">Bookings</Link>
          <Link to="/manager/dashboard">Dashboard</Link>
          <button onClick={handleLogout}>Log out</button>
        </>}
      </div>
    </nav>
  );
}
