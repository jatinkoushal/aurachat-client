import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);
const BACKEND = 'https://aurachat-server.onrender.com';

function notify(title, body) {
  if (localStorage.getItem('notif_enabled') === 'false') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  // Only notify when tab not focused
  if (document.visibilityState === 'visible') return;
  new Notification(title, { body, icon: '/favicon.ico' });
}

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [incomingCall, setIncomingCall] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      return;
    }
    const token = localStorage.getItem('socket_token');
    if (!token) return;

    const s = io(BACKEND, {
      withCredentials: true,
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    });
    socketRef.current = s;
    setSocket(s);

    s.on('connect',       () => console.log('✅ Socket connected', s.id));
    s.on('connect_error', err => console.error('Socket error:', err.message));

    // FIX: separate events = accurate online/offline tracking
    s.on('user:online',  ({ userId }) => setOnlineUsers(p => { const n = new Set(p); n.add(userId);    return n; }));
    s.on('user:offline', ({ userId }) => setOnlineUsers(p => { const n = new Set(p); n.delete(userId); return n; }));

    // Notifications for incoming messages
    s.on('message:receive', msg => {
      if (msg.sender_id !== user.id) {
        notify(`💬 ${msg.username || 'New message'}`, msg.msg_type === 'call' ? '📞 Missed call' : msg.content);
      }
    });

    // Incoming call
    s.on('call:incoming', data => {
      setIncomingCall(data);
      notify(`📞 Incoming ${data.callType} call`, `${data.fromUsername} is calling you`);
    });
    s.on('call:rejected', () => setIncomingCall(null));
    s.on('call:ended',    () => setIncomingCall(null));

    return () => { s.disconnect(); socketRef.current = null; setSocket(null); };
  }, [user]);

  const isOnline = useCallback(uid => onlineUsers.has(uid), [onlineUsers]);

  return (
    <SocketContext.Provider value={{ socket, isOnline, onlineUsers, incomingCall, setIncomingCall }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
