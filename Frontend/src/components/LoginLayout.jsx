import { useState } from 'react';
import { Link } from 'react-router-dom';

// Shared visual shell + validation for the customer and manager login pages.
// Styles come from login.css (imported once in main.jsx).
//
// Props:
//   title      heading text, e.g. "Customer login"
//   subtitle   short line under the heading
//   hint       optional small note under the button (e.g. demo accounts)
//   onSubmit   async (email, password) => string | undefined
//              Return an error message to show it, or nothing on success
//              (do your navigate() inside it).
//   children   footer links (Register, Forgot password, Back to choice)
//   image      optional aside image URL, default login-customer.jpg

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(name, value) {
  if (name === 'email') {
    if (!value.trim()) return 'Enter the email you signed up with.';
    if (!EMAIL_RE.test(value.trim())) return 'Enter an email address like name@example.com.';
  }
  if (name === 'password' && !value) return 'Enter your password.';
  return '';
}

export default function LoginLayout({
  title,
  subtitle,
  hint,
  onSubmit,
  children,
  image = '/login-images/login-customer.jpg',
}) {
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({ email: '', password: '' });
  const [touched, setTouched] = useState({ email: false, password: false });
  const [showPw, setShowPw] = useState(false);
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
    if (touched[name]) setErrors((er) => ({ ...er, [name]: validate(name, value) }));
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    if (!value && !touched[name]) return;
    setTouched((t) => ({ ...t, [name]: true }));
    setErrors((er) => ({ ...er, [name]: validate(name, value) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const next = {
      email: validate('email', values.email),
      password: validate('password', values.password),
    };
    setTouched({ email: true, password: true });
    setErrors(next);

    const bad = Object.values(next).filter(Boolean).length;
    if (bad) {
      setFormError(bad === 1 ? 'Please fix the highlighted field.' : `Please fix ${bad} highlighted fields.`);
      return;
    }

    setLoading(true);
    try {
      const message = await onSubmit(values.email.trim(), values.password);
      if (message) setFormError(message);
    } catch (err) {
      setFormError(err?.message || 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="cl-login01" aria-labelledby="cl-login01-title">
      <div className="cl-login01__pane">
        <div className="cl-login01__body">
          <form className="cl-login01__form" onSubmit={handleSubmit} noValidate>
            <h1 className="cl-login01__title" id="cl-login01-title">{title}</h1>
            {subtitle && <p className="cl-login01__sub">{subtitle}</p>}

            <div className={`cl-login01__field${errors.email ? ' is-error' : ''}`}>
              <label className="cl-login01__label" htmlFor="cl-login01-email">Email</label>
              <input
                className="cl-login01__input"
                id="cl-login01-email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="you@example.com"
                value={values.email}
                onChange={handleChange}
                onBlur={handleBlur}
                aria-invalid={errors.email ? 'true' : 'false'}
                aria-describedby="cl-login01-email-err"
              />
              <p className="cl-login01__error" id="cl-login01-email-err">{errors.email}</p>
            </div>

            <div className={`cl-login01__field${errors.password ? ' is-error' : ''}`}>
              <label className="cl-login01__label" htmlFor="cl-login01-pw">Password</label>
              <div className="cl-login01__pw">
                <input
                  className="cl-login01__input"
                  id="cl-login01-pw"
                  name="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={values.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  aria-invalid={errors.password ? 'true' : 'false'}
                  aria-describedby="cl-login01-pw-err"
                />
                <button
                  className="cl-login01__eye"
                  type="button"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  aria-pressed={showPw}
                  aria-controls="cl-login01-pw"
                  onClick={() => setShowPw((s) => !s)}
                >
                  <svg className="cl-login01__eye-on" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <svg className="cl-login01__eye-off" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 3l18 18M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.9 8.3 2 12 2 12s3.6 7 10 7a9.8 9.8 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                  </svg>
                </button>
              </div>
              <p className="cl-login01__error" id="cl-login01-pw-err">{errors.password}</p>
            </div>

            <button className="cl-login01__submit" type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Log in'}
            </button>

            <div className="cl-login01__live" role="status" aria-live="polite">
              {formError && <p>{formError}</p>}
            </div>

            {children && <div className="cl-login01__foot">{children}</div>}
            {hint && <p className="cl-login01__demo">{hint}</p>}
          </form>
        </div>
      </div>

      <aside className="cl-login01__aside" aria-hidden="true">
        <img className="cl-login01__photo" src={image} alt="" />
      </aside>
    </main>
  );
}