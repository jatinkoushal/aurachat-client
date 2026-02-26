import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

// Soft two-note chime for incoming messages
function playMsgTone() {
  if (localStorage.getItem('sound_enabled') === 'false') return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [[880, 0], [1100, 0.13]].forEach(([freq, when]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + when);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + when + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + 0.26);
      osc.start(ctx.currentTime + when);
      osc.stop(ctx.currentTime + when + 0.26);
    });
    setTimeout(() => { try { ctx.close(); } catch {} }, 900);
  } catch {}
}

// Generate a temporary ID for optimistic messages
const tmpId = () => `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;

export const useChat = (targetId, isGroup = false) => {
  const { socket } = useSocket();
  const { user }   = useAuth();

  const [messages, setMessages] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [typing,   setTyping]   = useState(false);

  const typingTimeout  = useRef(null);
  // Offline queue: array of { tmpId, content } waiting to be sent
  const offlineQueue   = useRef([]);
  const flushingRef    = useRef(false);

  // ── Load message history ──────────────────────────────────────────────────
  useEffect(() => {
    if (!targetId) return;
    setLoading(true);
    setMessages([]);
    const url = isGroup ? `/api/messages/group/${targetId}` : `/api/messages/dm/${targetId}`;
    api.get(url)
      .then(res => setMessages(res.data.messages || []))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [targetId, isGroup]);

  // ── Flush offline queue when socket reconnects ────────────────────────────
  const flushQueue = useCallback(() => {
    if (flushingRef.current || !socket?.connected || offlineQueue.current.length === 0) return;
    flushingRef.current = true;
    const queue = [...offlineQueue.current];
    offlineQueue.current = [];
    queue.forEach(({ content }) => {
      if (isGroup) socket.emit('group:message:send', { groupId: targetId, content });
      else         socket.emit('message:send', { to: targetId, content });
    });
    flushingRef.current = false;
  }, [socket, targetId, isGroup]);

  // Listen for socket reconnect → flush queue
  useEffect(() => {
    if (!socket) return;
    socket.on('connect', flushQueue);
    return () => socket.off('connect', flushQueue);
  }, [socket, flushQueue]);

  // ── Socket message listeners ──────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !targetId) return;

    const msgEvent = isGroup ? 'group:message:receive' : 'message:receive';

    const onMessage = (msg) => {
      const relevant = isGroup
        ? msg.groupId === targetId
        : (msg.sender_id === targetId || msg.sender_id === user?.id);
      if (!relevant) return;

      setMessages(prev => {
        // Replace temporary optimistic message if IDs match by content+sender
        const tmpIdx = prev.findIndex(m => m._tmp && m.content === msg.content && m.sender_id === msg.sender_id);
        if (tmpIdx !== -1) {
          const next = [...prev];
          next[tmpIdx] = msg; // replace tmp with real confirmed message
          return next;
        }
        if (prev.find(m => m.id === msg.id)) return prev; // dedup
        return [...prev, msg];
      });

      // Remove from pending queue if confirmed
      offlineQueue.current = offlineQueue.current.filter(q => q.content !== msg.content);

      if (msg.sender_id !== user?.id && msg.msg_type !== 'call') playMsgTone();
      if (!isGroup && msg.sender_id === targetId) socket.emit('message:read', { from: targetId });
    };

    const onUpdated = (msg) => {
      const relevant = isGroup ? msg.groupId === targetId : true;
      if (!relevant) return;
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: msg.content, edited: true } : m));
    };

    const onDeleted = ({ msgId }) => {
      setMessages(prev => prev.map(m => m.id === msgId
        ? { ...m, content: 'This message was deleted', deleted: true } : m));
    };

    const onReadAck = ({ by }) => {
      if (by === targetId) {
        setMessages(prev => prev.map(m => m.sender_id === user?.id ? { ...m, is_read: true } : m));
      }
    };

    const onTypingStart = ({ from }) => { if (from === targetId) setTyping(true); };
    const onTypingStop  = ({ from }) => { if (from === targetId) setTyping(false); };

    socket.on(msgEvent,           onMessage);
    socket.on('message:updated',  onUpdated);
    socket.on('message:deleted',  onDeleted);
    socket.on('message:read_ack', onReadAck);
    socket.on('typing:start',     onTypingStart);
    socket.on('typing:stop',      onTypingStop);

    return () => {
      socket.off(msgEvent,           onMessage);
      socket.off('message:updated',  onUpdated);
      socket.off('message:deleted',  onDeleted);
      socket.off('message:read_ack', onReadAck);
      socket.off('typing:start',     onTypingStart);
      socket.off('typing:stop',      onTypingStop);
    };
  }, [socket, targetId, isGroup, user]);

  // ── Send message (with offline queue fallback) ────────────────────────────
  const sendMessage = useCallback((content) => {
    if (!content.trim()) return;

    // Optimistic: add message immediately to UI with a tmp flag
    const optimistic = {
      id: tmpId(),
      _tmp: true,
      sender_id: user?.id,
      username: user?.username,
      content: content.trim(),
      created_at: new Date().toISOString(),
      is_read: false,
      edited: false,
      deleted: false,
      msg_type: 'text',
      // indicate pending send
      _pending: !socket?.connected,
    };
    setMessages(prev => [...prev, optimistic]);

    if (socket?.connected) {
      if (isGroup) socket.emit('group:message:send', { groupId: targetId, content: content.trim() });
      else         socket.emit('message:send', { to: targetId, content: content.trim() });
    } else {
      // Store in offline queue, will retry on reconnect
      offlineQueue.current.push({ content: content.trim() });
    }
  }, [socket, targetId, isGroup, user]);

  const editMessage = useCallback((msgId, content) => {
    if (!socket || !content.trim()) return;
    if (isGroup) socket.emit('group:message:edit', { msgId, content, groupId: targetId });
    else         socket.emit('message:edit', { msgId, content, to: targetId });
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content, edited: true } : m));
  }, [socket, targetId, isGroup]);

  const deleteMessage = useCallback((msgId) => {
    if (!socket) return;
    if (isGroup) socket.emit('group:message:delete', { msgId, groupId: targetId });
    else         socket.emit('message:delete', { msgId, to: targetId });
    setMessages(prev => prev.map(m => m.id === msgId
      ? { ...m, content: 'This message was deleted', deleted: true } : m));
  }, [socket, targetId, isGroup]);

  const emitTyping = useCallback((isTyping) => {
    if (!socket) return;
    const to = isGroup ? 'group:' + targetId : targetId;
    if (isTyping) {
      socket.emit('typing:start', { to });
      clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => socket.emit('typing:stop', { to }), 2000);
    } else {
      socket.emit('typing:stop', { to });
    }
  }, [socket, targetId, isGroup]);

  return { messages, loading, sendMessage, editMessage, deleteMessage, emitTyping, typing };
};
