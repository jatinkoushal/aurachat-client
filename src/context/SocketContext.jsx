import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [incomingCall, setIncomingCall] = useState(null);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

   const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://aurachat-server.onrender.com';

    // Get token from cookie is not possible client-side (httpOnly)
    // Instead, pass userId and let server verify session via a short-lived token
    // For simplicity, request a socket token from the server
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => res.json())
      .then(() => {
        // We'll use a workaround: pass userId in handshake and re-verify on server
        // In production, issue a separate short-lived socket token
        const socket = io(SOCKET_URL, {
          withCredentials: true,
          auth: { token: localStorage.getItem('socket_token') || '' },
        });

        socketRef.current = socket;

        socket.on('user:status', ({ userId, isOnline }) => {
          setOnlineUsers(prev => {
            const next = new Set(prev);
            if (isOnline) next.add(userId);
            else next.delete(userId);
            return next;
          });
        });

        socket.on('call:incoming', (data) => {
          setIncomingCall(data);
        });

        socket.on('call:rejected', () => setIncomingCall(null));
        socket.on('call:ended', () => setIncomingCall(null));
      });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user]);

  const isOnline = (userId) => onlineUsers.has(userId);

  return (
    <SocketContext.Provider value={{
      socket: socketRef.current,
      isOnline,
      onlineUsers,
      incomingCall,
      setIncomingCall,
    }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
