import { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    api.get('/api/auth/me')
      .then(res => {
        setUser(res.data.user);
        // Store socket token so SocketContext can authenticate
        if (res.data.socketToken) {
          localStorage.setItem('socket_token', res.data.socketToken);
        }
      })
      .catch(() => {
        setUser(null);
        localStorage.removeItem('socket_token');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    // FIX: trim username before sending
    const res = await api.post('/api/auth/login', { username: username.trim(), password });
    setUser(res.data.user);
    if (res.data.socketToken) localStorage.setItem('socket_token', res.data.socketToken);
    return res.data.user;
  };

  const register = async (username, password) => {
    const res = await api.post('/api/auth/register', { username: username.trim(), password });
    setUser(res.data.user);
    if (res.data.socketToken) localStorage.setItem('socket_token', res.data.socketToken);
    return res.data.user;
  };

  const logout = async () => {
    try { await api.post('/api/auth/logout'); } catch {}
    localStorage.removeItem('socket_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
