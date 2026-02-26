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
  const [onlineUsers, setOnlineUsers] = useState({});
  const [incomingCall, setIncomingCall] = useState(null);
  const [socket, setSocket] = useState(null);

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

    s.on('connect', () => {
      console.log('✅ Socket connected:', s.id);
    });
    s.on('connect_error', err => console.error('Socket error:', err.message));

    // Single user came online
    s.on('user:online', ({ userId }) => {
      setOnlineUsers(prev => ({ ...prev, [userId]: true }));
    });
    s.on('user:offline', ({ userId }) => {
      setOnlineUsers(prev => { const n = { ...prev }; delete n[userId]; return n; });
    });
    // Bulk list of users who were already online when we connected
    s.on('users:online_list', ({ userIds }) => {
      setOnlineUsers(prev => {
        const n = { ...prev };
        userIds.forEach(id => { n[id] = true; });
        return n;
      });
    });

    // Notifications for incoming messages (from other users)
    s.on('message:receive', msg => {
      if (msg.sender_id !== user.id) {
        notify(
          `💬 ${msg.username || 'New message'}`,
          msg.msg_type === 'call' ? '📞 Missed call' : msg.content
        );
        // Play message tone if sound enabled
        if (localStorage.getItem('sound_enabled') !== 'false') {
          playTone(880, 660, 0.3, 0.15);
        }
      }
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

function playTone(freqStart, freqEnd, duration, rampTime) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freqStart, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + rampTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(); osc.stop(ctx.currentTime + duration);
    setTimeout(() => { try { ctx.close(); } catch {} }, (duration + 0.5) * 1000);
  } catch {}
}

export const useSocket = () => useContext(SocketContext);
