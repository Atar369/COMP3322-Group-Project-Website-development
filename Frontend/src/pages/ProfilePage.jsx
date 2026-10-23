import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function ProfilePage() {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [showPwForm, setShowPwForm] = useState(false);

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function handleSave() {
    setIsEditing(false);
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (pwForm.newPassword.length < 6) {
      setPwError('New password must be at least 6 characters.');
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError('Passwords do not match.');
      return;
    }
    try {
      const res = await api.post('/auth/change-password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      setPwSuccess('Password changed successfully.');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPwForm(false);
    } catch (err) {
      setPwError(err.response?.data?.error || 'Failed to change password.');
    }
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

      {/* Change Password Section */}
      <div style={{ marginTop: 32, borderTop: '2px solid var(--line)', paddingTop: 24 }}>
        <h2>Change Password</h2>
        {pwSuccess && <p style={{ color: 'var(--green)', fontWeight: 600 }}>{pwSuccess}</p>}
        {!showPwForm ? (
          <button className="btn secondary" onClick={() => setShowPwForm(true)}>Change Password</button>
        ) : (
          <form onSubmit={handlePasswordChange}>
            <div className="field">
              <label>Current Password</label>
              <input
                type="password"
                value={pwForm.currentPassword}
                onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label>New Password</label>
              <input
                type="password"
                value={pwForm.newPassword}
                onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label>Confirm New Password</label>
              <input
                type="password"
                value={pwForm.confirmPassword}
                onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
                required
              />
            </div>
            {pwError && <p className="error-text">{pwError}</p>}
            <button className="btn" type="submit">Update Password</button>
            <button className="btn secondary" type="button" style={{ marginLeft: 8 }} onClick={() => { setShowPwForm(false); setPwError(''); }}>Cancel</button>
          </form>
        )}
      </div>
    </div>
  );
}
