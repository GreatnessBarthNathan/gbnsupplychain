import { createContext, useContext, useMemo, useState } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('gbn_user') || 'null');
    } catch {
      return null;
    }
  });

  async function authenticate(path, credentials) {
    const result = await api(path, { method: 'POST', body: JSON.stringify(credentials) });
    localStorage.setItem('gbn_token', result.token);
    localStorage.setItem('gbn_user', JSON.stringify(result.user));
    setUser(result.user);
  }

  function logout() {
    localStorage.removeItem('gbn_token');
    localStorage.removeItem('gbn_user');
    setUser(null);
  }

  const value = useMemo(() => ({ user, authenticate, logout }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
