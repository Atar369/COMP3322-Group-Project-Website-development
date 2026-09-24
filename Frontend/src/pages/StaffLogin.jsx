import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function StaffLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  function handleSubmit(e) {
    e.preventDefault();
    const result = login(email, password);
    if (result.error) { setError(result.error); return; }
    if (result.user.role === 'manager') {
      navigate('/manager/dashboard');
    } else {
      setError('This account is not a staff account.');
    }
  }

  return (
    <div className="page" style={{ maxWidth: 380 }}>
      <h1>Staff Login</h1>
      <p style={{ color: '#6b6558', fontSize: '0.9rem' }}>
        Demo accounts — manager: manager@example.com (any password)
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
      <p style={{ marginTop: 16 }}>New staff? <Link to="/register/staff">Register</Link></p>
      <p style={{ marginTop: 12 }}><Link to="/login">Back to choice</Link></p>
    </div>
  );
}
