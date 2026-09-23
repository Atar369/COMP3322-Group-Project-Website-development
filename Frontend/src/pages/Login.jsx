import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  function handleSubmit(e) {
    e.preventDefault();
    const result = login(email, password);
    if (result.error) { setError(result.error); return; }
    navigate(result.user.role === 'manager' ? '/manager/dashboard' : '/menu');
  }

  return (
    <div className="page" style={{ maxWidth: 380 }}>
      <h1>Log in</h1>
      <p style={{ color: '#6b6558', fontSize: '0.9rem' }}>
        Demo accounts — customer: alice@example.com, manager: manager@example.com (any password)
      </p>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn" type="submit">Log in</button>
      </form>
      <p style={{ marginTop: 16 }}>No account? <Link to="/register">Register</Link></p>
    </div>
  );
}
