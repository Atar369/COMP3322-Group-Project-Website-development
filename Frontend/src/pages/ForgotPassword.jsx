import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';

export default function ForgotPassword() {
  const [searchParams] = useSearchParams();
  const tokenParam = searchParams.get('token');
  const [step, setStep] = useState(tokenParam ? 2 : 1);
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleStep1Submit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!email.trim()) {
      setError('Email is required.');
      return;
    }
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSuccess('If an account exists with that email, a reset link has been sent. Check your email inbox for further instructions.');
      setEmail('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to process request. Please try again.');
    }
  }

  async function handleStep2Submit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newPassword || !confirmPassword) {
      setError('Both password fields are required.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      await api.post('/auth/reset-password', {
        token: tokenParam,
        newPassword,
      });
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password. Token may have expired.');
    }
  }

  if (step === 1) {
    return (
      <div className="page" style={{ maxWidth: 420 }}>
        <h1>Forgot Password</h1>
        <p style={{ color: '#6b6558', fontSize: '0.9rem', marginBottom: 20 }}>
          Enter your email address and we'll send you a link to reset your password.
        </p>
        <form onSubmit={handleStep1Submit}>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Enter your registered email"
              required
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          {success && <p style={{ color: 'green', fontSize: '0.9rem' }}>{success}</p>}
          <button className="btn" type="submit">Send Reset Link</button>
        </form>
        <p style={{ marginTop: 16 }}>
          <Link to="/welcome">← Back to Login</Link>
        </p>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="page" style={{ maxWidth: 420 }}>
        <h1>Reset Password</h1>
        <p style={{ color: '#6b6558', fontSize: '0.9rem', marginBottom: 20 }}>
          Enter your new password below.
        </p>
        <form onSubmit={handleStep2Submit}>
          <div className="field">
            <label>New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
            />
          </div>
          <div className="field">
            <label>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              required
            />
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

  return (
    <div className="page" style={{ maxWidth: 480, textAlign: 'center' }}>
      <h1>Password Reset Successful</h1>
      <div className="card" style={{ padding: 32, marginTop: 20 }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>✓</div>
        <p style={{ fontSize: '1.05rem', marginBottom: 16 }}>
          Your password has been reset successfully.
        </p>
        <p style={{ color: '#6b6558', fontSize: '0.9rem', marginBottom: 24 }}>
          You can now log in with your new password.
        </p>
        <Link to="/welcome" className="btn" style={{ textDecoration: 'none', display: 'inline-block' }}>
          ← Back to Login
        </Link>
      </div>
    </div>
  );
}
