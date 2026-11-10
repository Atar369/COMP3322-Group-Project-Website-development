import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function CustomerRegister() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const result = await register(form.name, form.email, form.phone, form.password);
      if (result.error) {
        if (result.verificationPending) {
          navigate('/verify-email', { state: { email: result.email, deliveryError: result.error } });
          return;
        }
        setError(result.error);
        return;
      }

      navigate('/verify-email', {
        state: { email: result.email, emailPreviewUrl: result.emailPreviewUrl, emailSent: true },
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page" style={{ maxWidth: 380 }}>
      <h1>Customer Registration</h1>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Full name</label>
          <input value={form.name} onChange={e => update('name', e.target.value)} required />
        </div>
        <div className="field">
          <label>Email</label>
          <input type="email" value={form.email} onChange={e => update('email', e.target.value)} required />
        </div>
        <div className="field">
          <label>Phone</label>
          <input value={form.phone} onChange={e => update('phone', e.target.value)} required />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            type="password"
            minLength={6}
            value={form.password}
            onChange={e => update('password', e.target.value)}
            required
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Register'}
        </button>
      </form>
      <p style={{ marginTop: 16 }}>
        Already have an account? <Link to="/login/customer">Log in</Link>
      </p>
    </div>
  );
}