import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Dropdown({ label, links }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="nav-dropdown" ref={ref}>
      <button className={`nav-dropdown-toggle${open ? ' open' : ''}`} onClick={() => setOpen(o => !o)}>
        {label} ▾
      </button>
      {open && (
        <div className="nav-dropdown-menu" onClick={() => setOpen(false)}>
          {links.map(({ to, label: l }) => (
            <Link key={to} to={to}>{l}</Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/welcome');
  }

  return (
    <nav className="nav">
      <Link to="/" className="brand">The Kitchen Ledger</Link>
      <div className="nav-links">
        {!user && <Link to="/welcome">Log in</Link>}

        {user?.role === 'customer' && <>
          <Dropdown label="Menu" links={[
            { to: '/view-menu', label: 'View Menu' }
          ]} />
          <Dropdown label="Order" links={[
            { to: '/menu', label: 'New Order' },
            { to: '/order-management', label: 'Order Management' },
            { to: '/order-history', label: 'Order History' },
          ]} />
          <Dropdown label="Queue" links={[
            { to: '/queue', label: 'Join Queue' },
            { to: '/queue-history', label: 'Queue History' },
          ]} />
          <Dropdown label="Book a Table" links={[
            { to: '/booking', label: 'New Booking' },
            { to: '/booking-management', label: 'Booking Management' },
            { to: '/booking-history', label: 'Booking History' },
          ]} />
          <Link to="/profile">Personal Information</Link>
          <button onClick={handleLogout}>Log out</button>
        </>}

        {user?.role === 'manager' && <>
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
