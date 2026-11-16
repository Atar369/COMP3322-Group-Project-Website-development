import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [showPwForm, setShowPwForm] = useState(false);

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  // Saves name and phone to the server, then updates the logged-in user in memory.
  async function handleSave() {
    setProfileError('');
    setProfileSuccess('');

    const name = form.name.trim();
    const phone = form.phone.trim();
    if (!name || !phone) {
      setProfileError('Name and phone are required.');
      return;
    }

    setSaving(true);
    try {
      const res = await api.patch('/auth/profile', { name, phone });
      const saved = res.data?.user || { name, phone };
      updateUser(saved);
      setForm(prev => ({
        ...prev,
        name: saved.name ?? name,
        phone: saved.phone ?? phone,
      }));
      setIsEditing(false);
      setProfileSuccess('Your information has been updated.');
    } catch (err) {
      setProfileError(err.response?.data?.error || 'Could not save your changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // Discards edits and restores the values stored on the server.
  function handleCancel() {
    setForm({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
    });
    setProfileError('');
    setIsEditing(false);
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    const minPasswordLength = user?.role === 'manager' ? 12 : 8;
    if (pwForm.newPassword.length < minPasswordLength) {
      setPwError(`New password must be at least ${minPasswordLength} characters.`);
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError('Passwords do not match.');
      return;
    }
    try {
      await api.post('/auth/change-password', {
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
      {user?.role === 'customer' && (
        <div className="card" style={{ marginBottom: 20 }}>
          <strong>Booking cancellation flags: {user.cancellation_flags || 0} / 4</strong>
          <p style={{ margin: '6px 0 0' }}>
            Flags for cancelling confirmed bookings do not expire. At 4 flags, your account will be disabled and this email cannot be used to register another account.
          </p>
        </div>
      )}

      {profileSuccess && <p style={{ color: 'var(--green)', fontWeight: 600 }}>{profileSuccess}</p>}
      {profileError && <p className="error-text">{profileError}</p>}

      {isEditing ? (
        <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
          <div className="field">
            <label>Full Name</label>
            <input value={form.name} onChange={e => handleChange('name', e.target.value)} required />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={form.email} readOnly style={{ background: 'var(--paper-dim)' }} />
            <small style={{ color: '#6b6558' }}>Your email is used to sign in and cannot be changed here.</small>
          </div>
          <div className="field">
            <label>Phone</label>
            <input value={form.phone} onChange={e => handleChange('phone', e.target.value)} required />
          </div>
          <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          <button className="btn secondary" type="button" style={{ marginLeft: 8 }} onClick={handleCancel} disabled={saving}>Cancel</button>
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
          <button className="btn" onClick={() => { setProfileSuccess(''); setIsEditing(true); }} style={{ marginTop: 16 }}>Edit Information</button>
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