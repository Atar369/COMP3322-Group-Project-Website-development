import { createContext, useContext, useState } from 'react';
import { users } from '../data/mockData';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // Swap this for: await axios.post('/api/auth/login', { email, password })
  function login(email, password) {
    const found = users.find(u => u.email === email);
    if (!found) return { error: 'No account with that email.' };
    setUser(found);
    return { user: found };
  }

  function register(name, email, phone, password, role = 'customer') {
    const exists = users.some(u => u.email === email);
    if (exists) return { error: 'Email already registered.' };
    const newUser = { user_id: users.length + 1, name, email, phone, password_hash: password, role };
    users.push(newUser);
    return { user: newUser };
  }

  function logout() { setUser(null); }

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
