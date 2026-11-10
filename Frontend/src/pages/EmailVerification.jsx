import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';

const RESEND_COOLDOWN_SECONDS = 60;

export default function EmailVerification() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [email, setEmail] = useState(location.state?.email || '');
  const [previewUrl, setPreviewUrl] = useState(location.state?.emailPreviewUrl || '');
  const [deliveryError, setDeliveryError] = useState(location.state?.deliveryError || '');
  const [needsVerification, setNeedsVerification] = useState(location.state?.needsVerification || false);
  const [emailSent, setEmailSent] = useState(location.state?.emailSent || false);
  const [status, setStatus] = useState(location.state?.verified ? 'verified' : token ? 'verifying' : 'pending');
  const [message, setMessage] = useState(location.state?.message || '');
  const [error, setError] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resendRequested, setResendRequested] = useState(false);
  const attemptedToken = useRef('');

  useEffect(() => {
    if (!token || attemptedToken.current === token) return;
    attemptedToken.current = token;
    setStatus('verifying');
    api.post('/auth/verify-email', { token })
      .then(response => {
        setStatus('verified');
        setMessage(response.data.message);
        navigate('/verify-email', {
          replace: true,
          state: { verified: true, message: response.data.message },
        });
      })
      .catch(requestError => {
        setStatus('invalid');
        setVerificationError(requestError.response?.data?.error || 'Unable to verify your email right now.');
        navigate('/verify-email', { replace: true });
      });
  }, [token, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setTimeout(() => setCooldown(seconds => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function handleResend(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setPreviewUrl('');
    setDeliveryError('');
    setNeedsVerification(false);
    setEmailSent(false);
    setResendRequested(false);
    setResending(true);

    try {
      const response = await api.post('/auth/resend-verification', { email });
      setMessage(response.data.message);
      setPreviewUrl(response.data.emailPreviewUrl || '');
      setResendRequested(true);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to resend the verification email. Please try again.');
    } finally {
      setResending(false);
    }
  }

  function getPendingMessage() {
    if (status === 'invalid') return verificationError;
    if (deliveryError) return deliveryError;
    if (needsVerification) return 'Your account email is not verified yet. Request a new verification link below.';
    if (resendRequested) return 'If an unverified account exists for this email, a verification link will be sent.';
    if (emailSent && email) return `We sent a verification link to ${email}. It expires in 24 hours.`;
    return 'Enter the email address you used to register and we will send a verification link if an unverified account exists.';
  }

  return (
    <main className="cl-login01" aria-labelledby="email-verification-title">
      <div className="cl-login01__pane">
        <div className="cl-login01__body">
          <section className="cl-login01__done">
            {status === 'verifying' && (
              <>
                <h1 className="cl-login01__title" id="email-verification-title">Verifying your email</h1>
                <p className="cl-login01__sub">Please wait while we verify your one-time link.</p>
              </>
            )}

            {status === 'verified' && (
              <>
                <h1 className="cl-login01__title" id="email-verification-title">Email verified</h1>
                <p className="cl-login01__sub">{message}</p>
                <p><Link className="cl-login01__ghost" to="/login/customer">Continue to login</Link></p>
              </>
            )}

            {(status === 'pending' || status === 'invalid') && (
              <>
                <h1 className="cl-login01__title" id="email-verification-title">
                  {status === 'invalid' ? 'Link invalid or expired' : 'Check your email'}
                </h1>
                <p className="cl-login01__sub">
                  {getPendingMessage()}
                </p>
                {previewUrl && (
                  <p>
                    <a className="cl-login01__link" href={previewUrl} target="_blank" rel="noreferrer">
                      Preview verification email
                    </a>
                  </p>
                )}
                <form onSubmit={handleResend}>
                  <div className="cl-login01__field">
                    <label className="cl-login01__label" htmlFor="verification-email">Email</label>
                    <input
                      className="cl-login01__input"
                      id="verification-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={event => {
                        setEmail(event.target.value);
                        setEmailSent(false);
                        setNeedsVerification(false);
                        setResendRequested(false);
                      }}
                      required
                    />
                  </div>
                  {error && <p className="cl-login01__error" role="alert">{error}</p>}
                  {message && <p role="status">{message}</p>}
                  <button
                    className="cl-login01__submit"
                    type="submit"
                    disabled={resending || cooldown > 0}
                  >
                    {resending ? 'Sending…' : cooldown > 0 ? `Resend available in ${cooldown}s` : 'Resend verification email'}
                  </button>
                </form>
                <p className="cl-login01__foot">
                  Already verified? <Link className="cl-login01__link" to="/login/customer">Log in</Link>
                </p>
              </>
            )}
          </section>
        </div>
      </div>

      <aside className="cl-login01__aside" aria-hidden="true">
        <img className="cl-login01__photo" src="/login-images/login-customer.jpg" alt="" />
      </aside>
    </main>
  );
}
