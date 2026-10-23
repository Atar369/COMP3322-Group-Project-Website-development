import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function ForgotPassword() {
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [error, setError] = useState('');
  const [newPassword, setNewPassword] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      setError('All fields are required.');
      return;
    }
    try {
      const res = await api.post('/auth/forgot-password', {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      });
      setNewPassword(res.data.newPassword);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to process request. Please check your details.');
    }
  }

  if (newPassword) {
    return (
      <div className="page" style={{ maxWidth: 480, textAlign: 'center' }}>
        <h1>Password Reset</h1>
        <div className="card" style={{ padding: 32, marginTop: 20 }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔑</div>
          <p style={{ fontSize: '1.05rem', marginBottom: 8 }}>
            Your password has been reset successfully.
          </p>
          <p style={{ color: '#6b6558', fontSize: '0.9rem', marginBottom: 16 }}>
            Here is your new password. Please write it down and change it from your Profile page after logging in.
          </p>
          <div style={{ background: 'var(--paper-dim)', border: '2px solid var(--mustard)', padding: 16, fontSize: '1.4rem', fontWeight: 700, fontFamily: 'monospace', letterSpacing: 3, marginBottom: 24 }}>
            {newPassword}
          </div>
          <Link to="/welcome" className="btn" style={{ textDecoration: 'none', display: 'inline-block' }}>
            ← Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 420 }}>
      <h1>Forgot Password</h1>
      <p style={{ color: '#6b6558', fontSize: '0.9rem', marginBottom: 20 }}>
        Enter your full name, email, and phone number. If they match our records, your password will be reset and displayed here.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Full Name</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Enter your full name" required />
        </div>
        <div className="field">
          <label>Email</label>
          <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Enter your registered email" required />
        </div>
        <div className="field">
          <label>Phone</label>
          <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Enter your registered phone number" required />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn" type="submit">Reset Password</button>
      </form>
      <p style={{ marginTop: 16 }}>
        <Link to="/welcome">← Back to Login</Link>
      </p>
    </div>
  );
}
