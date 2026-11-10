import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/me')
      .then(res => setUser(res.data.user ?? res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    try {
      const res = await api.post('/auth/login', { email, password });
      setUser(res.data.user);
      return { user: res.data.user };
    } catch (err) {
      return {
        error: err.response?.data?.error || 'Login failed',
        code: err.response?.data?.code,
      };
    }
  }

  async function register(name, email, phone, password) {
    try {
      const res = await api.post('/auth/register', { name, email, phone, password });
      return { email: res.data.email, message: res.data.message, emailPreviewUrl: res.data.emailPreviewUrl };
    } catch (err) {
      return {
        error: err.response?.data?.error || 'Registration failed',
        email: err.response?.data?.email,
        verificationPending: err.response?.data?.verificationPending,
      };
    }
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore network errors on logout */
    }
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}