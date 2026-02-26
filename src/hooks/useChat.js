import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

// Soft message notification tone
function playMsgTone() {
  if (localStorage.getItem('sound_enabled') === 'false') return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Two-note chime: ascending
    [[880, 0], [1100, 0.12]].forEach(([freq, when]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + when);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + when + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + 0.25);
      osc.start(ctx.currentTime + when);
      osc.stop(ctx.currentTime + when + 0.25);
    });
    setTimeout(() => { try { ctx.close(); } catch {} }, 800);
  } catch {}
}

export const useChat = (targetId, isGroup = false) => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);
  const typingTimeout = useRef(null);

  // Load history
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

  // Socket listeners
  useEffect(() => {
    if (!socket || !targetId) return;

    const msgEvent = isGroup ? 'group:message:receive' : 'message:receive';

    const onMessage = (msg) => {
      const relevant = isGroup
        ? msg.groupId === targetId
        : (msg.sender_id === targetId || msg.sender_id === user?.id);
      if (!relevant) return;
      setMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // Play tone for incoming messages only (not own)
      if (msg.sender_id !== user?.id && msg.msg_type !== 'call') {
        playMsgTone();
      }
      if (!isGroup && msg.sender_id === targetId) {
        socket.emit('message:read', { from: targetId });
      }
    };

    const onUpdated = (msg) => {
      const relevant = isGroup ? msg.groupId === targetId : true;
      if (!relevant) return;
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: msg.content, edited: true } : m));
    };

    const onDeleted = ({ msgId }) => {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: 'This message was deleted', deleted: true } : m));
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

  const sendMessage = useCallback((content) => {
    if (!socket || !content.trim()) return;
    if (isGroup) socket.emit('group:message:send', { groupId: targetId, content });
    else         socket.emit('message:send', { to: targetId, content });
  }, [socket, targetId, isGroup]);

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
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: 'This message was deleted', deleted: true } : m));
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
