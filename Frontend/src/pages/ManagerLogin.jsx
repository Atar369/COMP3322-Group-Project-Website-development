import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ManagerLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await login(email, password);
    if (result.error) { setError(result.error); return; }
    if (result.user.role === 'manager') {
      navigate('/manager/dashboard');
    } else {
      setError('This account is not a manager account.');
    }
  }

  return (
    <div className="page" style={{ maxWidth: 380 }}>
      <h1>Manager Login</h1>
      <p style={{ color: '#6b6558', fontSize: '0.9rem' }}>
        Demo accounts — manager: manager@example.com (pw: testing004)
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
      <p style={{ marginTop: 16 }}>New Manager? <Link to="/register/manager">Register</Link></p>
      <p style={{ marginTop: 12 }}><Link to="/login">Back to choice</Link></p>
    </div>
  );
}
