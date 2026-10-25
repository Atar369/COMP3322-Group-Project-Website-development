import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function CreateManager() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', managerId: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  if (user?.role !== 'manager') {
    return (
      <div className="page">
        <h1>Access Denied</h1>
        <p>Only managers can create other managers.</p>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!form.name.trim() || !form.managerId.trim() || !form.email.trim() || !form.password.trim() || !form.phone.trim()) {
      setError('Name, manager ID, email, password, and phone number are required.');
      setLoading(false);
      return;
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      setLoading(false);
      return;
    }

    try {
      await api.post('/auth/create-manager', {
        name: form.name.trim(),
        manager_id: form.managerId.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim(),
      });
      setSuccess(`Manager created successfully. Manager ID: ${form.managerId.trim()}`);
      setForm({ name: '', managerId: '', email: '', password: '', phone: '' });
      setTimeout(() => navigate('/manager/dashboard'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create manager.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page" style={{ maxWidth: 480 }}>
      <h1>New Manager Registration</h1>
      <p style={{ color: '#6b6558', fontSize: '0.9rem', marginBottom: 20 }}>
        Register a manager account. Managers sign in using their email address.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Manager Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Full name"
            required
          />
        </div>
        <div className="field">
          <label>Manager ID *</label>
          <input
            type="text"
            value={form.managerId}
            onChange={e => setForm(f => ({ ...f, managerId: e.target.value }))}
            placeholder="Unique manager ID"
            maxLength={50}
            required
          />
        </div>
        <div className="field">
          <label>Email *</label>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="Email address"
            required
          />
        </div>
        <div className="field">
          <label>Phone Number *</label>
          <input
            type="tel"
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="Phone number"
            required
          />
        </div>
        <div className="field">
          <label>Password *</label>
          <input
            type="password"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            placeholder="At least 6 characters"
            required
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        {success && <p style={{ color: 'green', fontSize: '0.9rem' }}>{success}</p>}
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Registering...' : 'Register Manager'}
        </button>
      </form>
    </div>
  );
}
