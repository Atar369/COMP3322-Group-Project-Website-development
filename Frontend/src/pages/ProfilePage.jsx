import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function ProfilePage() {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function handleSave() {
    setIsEditing(false);
  }

  return (
    <div className="page">
      <h1>Personal Information</h1>
      {isEditing ? (
        <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
          <div className="field">
            <label>Full Name</label>
            <input value={form.name} onChange={e => handleChange('name', e.target.value)} />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={form.email} onChange={e => handleChange('email', e.target.value)} />
          </div>
          <div className="field">
            <label>Phone</label>
            <input value={form.phone} onChange={e => handleChange('phone', e.target.value)} />
          </div>
          <button className="btn" type="submit">Save</button>
          <button className="btn secondary" style={{ marginLeft: 8 }} onClick={() => setIsEditing(false)}>Cancel</button>
        </form>
      ) : (
        <div className="card">
          <div className="ticket-row">
            <span className="name">Full Name</span>
            <span className="leader" />
            <span className="price">{form.name}</span>
          </div>
          <div className="ticket-row">
            <span className="name">Email</span>
            <span className="leader" />
            <span className="price">{form.email}</span>
          </div>
          <div className="ticket-row">
            <span className="name">Phone</span>
            <span className="leader" />
            <span className="price">{form.phone}</span>
          </div>
          <button className="btn" onClick={() => setIsEditing(true)} style={{ marginTop: 16 }}>Edit Information</button>
        </div>
      )}
    </div>
  );
}
