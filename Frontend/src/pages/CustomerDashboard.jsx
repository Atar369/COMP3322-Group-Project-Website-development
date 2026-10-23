import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const actions = [
  { label: 'Book a Table',     desc: 'Reserve a table and pre-order courses',  path: '/booking' },
  { label: 'Join Queue',       desc: 'Get in line for a walk-in table',        path: '/queue'   },
  { label: 'View Menu',        desc: 'Browse our full menu',                   path: '/view-menu' },
  { label: 'Manage Bookings',  desc: 'Edit reservations and pre-order courses', path: '/booking-management' },
  { label: 'Place an Order',   desc: 'Order when checked in — serving state unlocks ordering',  path: '/order-management'    },
  { label: 'View Cart',        desc: 'Review and place your order',            path: '/cart'    },
];

export default function CustomerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="page">
      <h1>Welcome back{user?.name ? `, ${user.name}` : ''}</h1>
      <p style={{ color: '#6b6558', marginBottom: 32 }}>What would you like to do today?</p>

      <div className="dash-grid">
        {actions.map(({ label, desc, path }) => (
          <div key={path} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <h3 style={{ marginBottom: 4 }}>{label}</h3>
              <p style={{ margin: 0, color: '#6b6558', fontSize: '0.88rem' }}>{desc}</p>
            </div>
            <button className="btn" onClick={() => navigate(path)} style={{ alignSelf: 'flex-start' }}>
              {label} →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
