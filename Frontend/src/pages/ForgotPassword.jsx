import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';

function EyeButton({ isVisible, onClick }) {
  return (
    <button
      className="cl-login01__eye"
      type="button"
      aria-label={isVisible ? 'Hide password' : 'Show password'}
      onClick={onClick}
    >
      {isVisible ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3l18 18M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.9 8.3 2 12 2 12s3.6 7 10 7a9.8 9.8 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        </svg>
      )}
    </button>
  );
}

export default function ForgotPassword() {
  const [searchParams] = useSearchParams();
  const tokenParam = searchParams.get('token');
  const [step, setStep] = useState(tokenParam ? 2 : 1);
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [loading, setLoading] = useState(false);

  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  async function handleStep1Submit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!email.trim()) {
      setError('Email is required.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSuccess('If an account exists with that email, a reset link has been sent. Check your email inbox for further instructions.');
      setEmail('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to process request. Please try again.');
    } finally {
      setLoading(false);
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
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        token: tokenParam,
        newPassword,
      });
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password. Token may have expired.');
    } finally {
      setLoading(false);
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
              disabled={loading}
              required
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          {success && <p style={{ color: 'green', fontSize: '0.9rem', fontWeight: 600 }}>{success}</p>}
          
          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'Sending…' : 'Send Reset Link'}
          </button>
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
            <div className="profile-password">
              <input
                className="profile-password__input"
                type={showNewPw ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                disabled={loading}
                required
              />
              <EyeButton isVisible={showNewPw} onClick={() => setShowNewPw(!showNewPw)} />
            </div>
            <small style={{ color: '#6b6558', marginTop: 4 }}>
              * Manager accounts require at least 12 characters.
            </small>
          </div>

          <div className="field">
            <label>Confirm Password</label>
            <div className="profile-password">
              <input
                className="profile-password__input"
                type={showConfirmPw ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
                disabled={loading}
                required
              />
              <EyeButton isVisible={showConfirmPw} onClick={() => setShowConfirmPw(!showConfirmPw)} />
            </div>
          </div>

          {error && <p className="error-text" style={{ fontWeight: 600 }}>{error}</p>}
          
          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'Resetting…' : 'Reset Password'}
          </button>
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