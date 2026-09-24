import { useNavigate } from 'react-router-dom';

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="page" style={{ maxWidth: 600, textAlign: 'center' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '0.8em' }}>Welcome</h1>
      <p style={{ color: '#6b6558', fontSize: '1.1rem', marginBottom: 40 }}>Choose your access to continue</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card" style={{ padding: 24, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
          <div style={{ fontSize: '3rem' }}>👤</div>
          <div>
            <h3 style={{ marginBottom: 4 }}>Customer</h3>
          </div>
          <button className="btn" onClick={() => navigate('/login/customer')} style={{ marginTop: 'auto' }}>
            Customer Login
          </button>
        </div>

        <div className="card" style={{ padding: 24, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
          <div style={{ fontSize: '3rem' }}>👨‍💼</div>
          <div>
            <h3 style={{ marginBottom: 4 }}>Staff</h3>
          </div>
          <button className="btn" onClick={() => navigate('/login/staff')} style={{ marginTop: 'auto' }}>
            Staff Login
          </button>
        </div>
      </div>
    </div>
  );
}
