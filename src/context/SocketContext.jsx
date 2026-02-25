import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);
const BACKEND = 'https://aurachat-server.onrender.com';

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [incomingCall, setIncomingCall] = useState(null);
  // Use state so consumers re-render when socket connects
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
      return;
    }

    const token = localStorage.getItem('socket_token');
    if (!token) {
      console.warn('No socket token found — socket will not connect');
      return;
    }

    const s = io(BACKEND, {
      withCredentials: true,
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
    });

    socketRef.current = s;
    setSocket(s);

    s.on('connect', () => console.log('✅ Socket connected'));
    s.on('connect_error', (err) => console.error('Socket error:', err.message));

    s.on('user:status', ({ userId, isOnline }) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        if (isOnline) next.add(userId);
        else next.delete(userId);
        return next;
      });
    });

    s.on('call:incoming', (data) => setIncomingCall(data));
    s.on('call:rejected', () => setIncomingCall(null));
    s.on('call:ended', () => setIncomingCall(null));

    return () => {
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [user]);

  const isOnline = (userId) => onlineUsers.has(userId);

  return (
    <SocketContext.Provider value={{ socket, isOnline, onlineUsers, incomingCall, setIncomingCall }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
