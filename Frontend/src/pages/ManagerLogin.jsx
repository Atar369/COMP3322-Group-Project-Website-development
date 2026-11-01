import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoginLayout from '../components/LoginLayout';

export default function ManagerLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleLogin(email, password) {
    const result = await login(email, password);
    if (result.error) return result.error;
    if (result.user.role !== 'manager') return 'This account is not a manager account.';
    navigate('/manager/dashboard');
  }

  return (
    <LoginLayout
      title="Manager login"
      subtitle="Sign in to manage the menu, orders, queue and bookings."
      hint="Demo manager: manager@example.com (password: password)"
      image="/login-images/login-manager.jpg"
      onSubmit={handleLogin}
    >
      <p><Link className="cl-login01__link" to="/forgot-password">Forgot password?</Link></p>
      <p style={{ marginTop: 8 }}><Link className="cl-login01__link" to="/welcome">Back to choice</Link></p>
    </LoginLayout>
  );
}