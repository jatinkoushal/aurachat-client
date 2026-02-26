import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);
const BACKEND = 'https://aurachat-server.onrender.com';

function notify(title, body) {
  if (localStorage.getItem('notif_enabled') === 'false') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;
  new Notification(title, { body, icon: '/favicon.ico' });
}

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [onlineUsers,  setOnlineUsers]  = useState({});
  const [incomingCall, setIncomingCall] = useState(null);
  const [socket,       setSocket]       = useState(null);

  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      setOnlineUsers({});
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
      transports: ['websocket', 'polling'],
    });
    socketRef.current = s;
    setSocket(s);

    s.on('connect',       () => console.log('✅ Socket connected:', s.id));
    s.on('connect_error', err => console.error('Socket error:', err.message));

    s.on('user:online',  ({ userId }) => setOnlineUsers(p => ({ ...p, [userId]: true })));
    s.on('user:offline', ({ userId }) => setOnlineUsers(p => { const n = { ...p }; delete n[userId]; return n; }));
    s.on('users:online_list', ({ userIds }) => setOnlineUsers(p => {
      const n = { ...p };
      userIds.forEach(id => { n[id] = true; });
      return n;
    }));

    // Show OS notification for incoming DM/group messages when tab is in background
    // NOTE: we do NOT play a sound here — useChat hook handles sound for active conversations
    // Playing sound here would cause double-beep or beep during calls
    s.on('message:receive', msg => {
      // Skip call logs and own messages
      if (!msg || msg.sender_id === user.id || msg.msg_type === 'call') return;
      notify(`💬 ${msg.username || 'New message'}`, msg.content);
    });

    s.on('group:message:receive', msg => {
      if (!msg || msg.sender_id === user.id) return;
      notify(`💬 ${msg.username || 'New message'}`, msg.content);
    });

    s.on('call:incoming', data => {
      setIncomingCall(data);
      notify(
        `📞 Incoming ${data.callType === 'voice' ? 'Voice' : 'Video'} Call`,
        `${data.fromUsername} is calling you`
      );
    });

    s.on('call:rejected', () => setIncomingCall(null));
    s.on('call:ended',    () => setIncomingCall(null));

    return () => {
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
      setOnlineUsers({});
    };
  }, [user]);

  const isOnline = useCallback(uid => !!onlineUsers[uid], [onlineUsers]);

  return (
    <SocketContext.Provider value={{ socket, isOnline, onlineUsers, incomingCall, setIncomingCall }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
