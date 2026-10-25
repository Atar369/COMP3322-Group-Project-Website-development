import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    setToken(storedToken);
    
    if (!storedToken) {
      setLoading(false);
      return;
    }

    api.get('/auth/me')
      .then(res => setUser(res.data.user ?? res.data))
      .catch(() => {
        localStorage.removeItem('token');
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    try {
      const res = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
      return { user: res.data.user };
    } catch (err) {
      return { error: err.response?.data?.error || 'Login failed' };
    }
  }

  async function register(name, email, phone, password, role) {
    try {
      const res = await api.post('/auth/register', { name, email, phone, password, role });
      localStorage.setItem('token', res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
      return { user: res.data.user };
    } catch (err) {
      return { error: err.response?.data?.error || 'Registration failed' };
    }
  }

  function logout() {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
