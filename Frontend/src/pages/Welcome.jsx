import { Link } from 'react-router-dom';
import '../welcome.css';

export default function Welcome() {
  return (
    <div className="welcome-page">
      <div className="welcome-inner">
        <header className="welcome-header">
          <span className="welcome-eyebrow">EMBER &amp; OAK · WESTERN FINE DINING</span>
          <h1 className="welcome-title">Welcome</h1>
          <p className="welcome-subtitle">Choose how you would like to continue.</p>
          <span className="welcome-rule" aria-hidden="true" />
        </header>

        <div className="welcome-grid">
          <Link className="welcome-card welcome-card-customer" to="/login/customer">
            <span className="welcome-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="3.6" />
                <path d="M4.5 20c.9-3.6 3.8-5.5 7.5-5.5s6.6 1.9 7.5 5.5" />
              </svg>
            </span>
            <span className="welcome-role">FOR GUESTS</span>
            <h2 className="welcome-card-title">Customer</h2>
            <p className="welcome-card-text">Reserve your evening, skip the wait and order from your table.</p>
            <span className="welcome-cta">
              Customer login <span className="welcome-arrow" aria-hidden="true">→</span>
            </span>
          </Link>

          <Link className="welcome-card welcome-card-manager" to="/login/manager">
            <span className="welcome-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 20v-7M12 20V5M19 20v-10M3 20h18" />
              </svg>
            </span>
            <span className="welcome-role">FOR STAFF</span>
            <h2 className="welcome-card-title">Manager</h2>
            <p className="welcome-card-text">Run the floor, the kitchen queue and the numbers in one place.</p>
            <span className="welcome-cta">
              Manager login <span className="welcome-arrow" aria-hidden="true">→</span>
            </span>
          </Link>
        </div>

        <p className="welcome-foot">
          New to Ember &amp; Oak?{' '}
          <Link className="welcome-link" to="/register/customer">Register as a member</Link>
          <span className="welcome-foot-note">Manager accounts are created by an existing manager.</span>
        </p>
      </div>
    </div>
  );
}
