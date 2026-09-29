import { createContext, useContext, useState, useEffect } from 'react';
// import { users } from '../data/mockData';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    api.get('/auth/me')
      .then(res => setUser(res.data.user ?? res.data))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    try {
      const res = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', res.data.token);
      setUser(res.data.user);
      return { user: res.data.user };
    } catch (err) {
      return { error: err.response?.data?.error || 'Login failed' };
    }
  }

  async function register(name, email, phone, password, role) {
    try {
      const res = await api.post('/auth/register', { name, email, phone, password, role });
      return { user: res.data };
    } catch (err) {
      return { error: err.response?.data?.error || 'Registration failed' };
    }
  }

  function logout() {
    localStorage.removeItem('token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
