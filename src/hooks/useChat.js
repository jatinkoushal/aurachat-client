import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

// Two-note chime — only for real text messages, never call logs
function playMsgTone() {
  if (localStorage.getItem('sound_enabled') === 'false') return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [[880, 0], [1100, 0.14]].forEach(([freq, when]) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + when);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + when + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + 0.25);
      osc.start(ctx.currentTime + when);
      osc.stop(ctx.currentTime  + when + 0.25);
    });
    setTimeout(() => { try { ctx.close(); } catch {} }, 800);
  } catch {}
}

let _tmpCounter = 0;
const makeTmpId = () => `tmp_${Date.now()}_${++_tmpCounter}`;

export const useChat = (targetId, isGroup = false) => {
  const { socket } = useSocket();
  const { user }   = useAuth();

  const [messages,    setMessages]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [typing,      setTyping]      = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const typingTimeout = useRef(null);
  const offlineQueue  = useRef([]);
  const flushLock     = useRef(false);

  // ── Load history ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!targetId) return;
    setLoading(true); setMessages([]); setUnreadCount(0);
    const url = isGroup
      ? `/api/messages/group/${targetId}`
      : `/api/messages/dm/${targetId}`;
    api.get(url)
      .then(res => {
        const msgs = res.data.messages || [];
        setMessages(msgs);
        const unread = msgs.filter(m => !m.is_read && m.sender_id !== user?.id).length;
        setUnreadCount(unread);
      })
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [targetId, isGroup]);

  // ── Flush offline queue on reconnect ─────────────────────────────────────
  const flushQueue = useCallback(() => {
    if (flushLock.current || !socket?.connected || !offlineQueue.current.length) return;
    flushLock.current = true;
    const batch = [...offlineQueue.current];
    offlineQueue.current = [];
    batch.forEach(({ tmpId, content }) => {
      if (isGroup) socket.emit('group:message:send', { groupId: targetId, content, tmpId });
      else         socket.emit('message:send',       { to: targetId,      content, tmpId });
    });
    flushLock.current = false;
  }, [socket, targetId, isGroup]);

  useEffect(() => {
    if (!socket) return;
    socket.on('connect', flushQueue);
    return () => socket.off('connect', flushQueue);
  }, [socket, flushQueue]);

  // ── Socket listeners ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !targetId) return;

    const inboundEvent = isGroup ? 'group:message:receive' : 'message:receive';
    const sentEvent    = isGroup ? 'group:message:sent'    : 'message:sent';

    // Sender's own message confirmed by server — replace optimistic
    const onSent = (msg) => {
      setMessages(prev => {
        const idx = prev.findIndex(m => m._tmp && m._tmpId === msg.tmpId);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...msg, _tmp: false, _pending: false };
        return next;
      });
      offlineQueue.current = offlineQueue.current.filter(q => q.tmpId !== msg.tmpId);
    };

    // Message from the other person
    const onReceive = (msg) => {
      // FIX: skip call-log messages — they should not play a tone or show as chat message
      if (msg.msg_type === 'call') {
        // Still append call log to messages list but don't play tone
        const relevant = isGroup ? msg.groupId === targetId : msg.sender_id === targetId;
        if (!relevant) return;
        setMessages(prev => {
          if (prev.find(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        return;
      }

      const relevant = isGroup
        ? msg.groupId === targetId
        : msg.sender_id === targetId;
      if (!relevant) return;

      setMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setUnreadCount(c => c + 1);
      playMsgTone(); // only plays for text messages (call type skipped above)
      if (!isGroup) socket.emit('message:read', { from: targetId });
    };

    const onUpdated = (msg) => {
      const relevant = isGroup ? msg.groupId === targetId : true;
      if (!relevant) return;
      setMessages(prev =>
        prev.map(m => m.id === msg.id ? { ...m, content: msg.content, edited: true } : m)
      );
    };

    const onDeleted = ({ msgId }) => {
      setMessages(prev =>
        prev.map(m => m.id === msgId
          ? { ...m, content: 'This message was deleted', deleted: true }
          : m
        )
      );
    };

    const onReadAck = ({ by }) => {
      if (by === targetId) {
        setMessages(prev => prev.map(m =>
          m.sender_id === user?.id ? { ...m, is_read: true } : m
        ));
      }
    };

    const onTypingStart = ({ from }) => { if (from === targetId) setTyping(true); };
    const onTypingStop  = ({ from }) => { if (from === targetId) setTyping(false); };

    const onError = ({ tmpId }) => {
      setMessages(prev =>
        prev.map(m => m._tmp && m._tmpId === tmpId
          ? { ...m, _failed: true, _pending: false }
          : m
        )
      );
    };

    socket.on(sentEvent,          onSent);
    socket.on(inboundEvent,       onReceive);
    socket.on('message:updated',  onUpdated);
    socket.on('message:deleted',  onDeleted);
    socket.on('message:read_ack', onReadAck);
    socket.on('typing:start',     onTypingStart);
    socket.on('typing:stop',      onTypingStop);
    socket.on('message:error',    onError);

    return () => {
      socket.off(sentEvent,          onSent);
      socket.off(inboundEvent,       onReceive);
      socket.off('message:updated',  onUpdated);
      socket.off('message:deleted',  onDeleted);
      socket.off('message:read_ack', onReadAck);
      socket.off('typing:start',     onTypingStart);
      socket.off('typing:stop',      onTypingStop);
      socket.off('message:error',    onError);
    };
  }, [socket, targetId, isGroup, user]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const sendMessage = useCallback((content) => {
    if (!content.trim()) return;
    const tmpId = makeTmpId();
    const optimistic = {
      id: tmpId, _tmp: true, _tmpId: tmpId,
      _pending: true, _failed: false,
      sender_id: user?.id, username: user?.username,
      content: content.trim(), created_at: new Date().toISOString(),
      is_read: false, edited: false, deleted: false,
      msg_type: 'text', groupId: isGroup ? targetId : undefined,
    };
    setMessages(prev => [...prev, optimistic]);
    if (socket?.connected) {
      if (isGroup) socket.emit('group:message:send', { groupId: targetId, content: content.trim(), tmpId });
      else         socket.emit('message:send',       { to: targetId,      content: content.trim(), tmpId });
    } else {
      offlineQueue.current.push({ tmpId, content: content.trim() });
    }
  }, [socket, targetId, isGroup, user]);

  // ── Edit / Delete (only confirmed, non-tmp messages) ─────────────────────
  const editMessage = useCallback((msgId, content) => {
    if (!socket || !content.trim()) return;
    if (String(msgId).startsWith('tmp_')) return;
    if (isGroup) socket.emit('group:message:edit', { msgId, content, groupId: targetId });
    else         socket.emit('message:edit',       { msgId, content, to: targetId });
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content, edited: true } : m));
  }, [socket, targetId, isGroup]);

  const deleteMessage = useCallback((msgId) => {
    if (!socket) return;
    if (String(msgId).startsWith('tmp_')) return;
    if (isGroup) socket.emit('group:message:delete', { msgId, groupId: targetId });
    else         socket.emit('message:delete',       { msgId, to: targetId });
    setMessages(prev => prev.map(m => m.id === msgId
      ? { ...m, content: 'This message was deleted', deleted: true } : m
    ));
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

  const markRead = useCallback(() => { setUnreadCount(0); }, []);

  return { messages, loading, sendMessage, editMessage, deleteMessage, emitTyping, typing, unreadCount, markRead };
};
