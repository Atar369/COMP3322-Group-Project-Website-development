import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  function update(field, value) { setForm(prev => ({ ...prev, [field]: value })); }

  function handleSubmit(e) {
    e.preventDefault();
    const result = register(form.name, form.email, form.phone, form.password);
    if (result.error) { setError(result.error); return; }
    navigate('/menu');
  }

  return (
    <div className="page" style={{ maxWidth: 380 }}>
      <h1>Create an account</h1>
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
          <input type="password" value={form.password} onChange={e => update('password', e.target.value)} required />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn" type="submit">Register</button>
      </form>
    </div>
  );
}
