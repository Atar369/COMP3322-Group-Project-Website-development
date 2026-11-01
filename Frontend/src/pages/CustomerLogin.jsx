import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoginLayout from '../components/LoginLayout';

export default function CustomerLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleLogin(email, password) {
    const result = await login(email, password);
    if (result.error) return result.error;
    if (result.user.role !== 'customer') return 'This account is not a customer account.';
    navigate('/home', { replace: true });
  }

  return (
    <LoginLayout
      title="Customer login"
      subtitle="Sign in to book a table, order food and join the queue."
      hint="Demo customer: alice@example.com (password: password)"
      image="/login-images/login-customer.jpg"
      onSubmit={handleLogin}
    >
      <p>No account? <Link className="cl-login01__link" to="/register/customer">Register</Link></p>
      <p style={{ marginTop: 8 }}><Link className="cl-login01__link" to="/forgot-password">Forgot password?</Link></p>
      <p style={{ marginTop: 8 }}><Link className="cl-login01__link" to="/login">Back to choice</Link></p>
    </LoginLayout>
  );
}