import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const storeToken = (token) => {
    if (token) localStorage.setItem('socket_token', token);
  };

  useEffect(() => {
    api.get('/api/auth/me')
      .then(res => {
        setUser(res.data.user);
        storeToken(res.data.socketToken);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await api.post('/api/auth/login', { username: username.trim(), password });
    setUser(res.data.user);
    storeToken(res.data.socketToken);
  }, []);

  const register = useCallback(async (username, password) => {
    const res = await api.post('/api/auth/register', { username: username.trim(), password });
    setUser(res.data.user);
    storeToken(res.data.socketToken);
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/api/auth/logout'); } catch {}
    localStorage.removeItem('socket_token');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
